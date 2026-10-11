/**
 * @file telemetrySimulator.js
 * @description Real-time Simulation Engine & Telemetry Streamer.
 * Manages automated movement scenarios, continuous overtime ticking,
 * and live WebSocket broadcasting.
 */

import { evaluateTelemetryFix } from '../engine/spatialGeofence.js';
import { calculateOvertime } from '../engine/overtimeEngine.js';
import { applyPrivacyFirewall, createEphemeralRemoteZone } from '../engine/privacyFirewall.js';

export class TelemetrySimulator {
  constructor(workers, geofences, alerts, io) {
    this.workers = workers;
    this.geofences = geofences;
    this.alerts = alerts;
    this.io = io;
    this.intervalId = null;
    this.simulationSpeed = 1; // 1x, 5x, 10x, 30x
    this.activeScenario = null;
    this.scenarioStep = 0;
  }

  start() {
    if (this.intervalId) return;
    // Tick every 1000ms
    this.intervalId = setInterval(() => this.tick(), 1000);
    console.log('[TelemetrySimulator] Started background engine.');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setSpeed(speedMultiplier) {
    this.simulationSpeed = Math.max(1, Math.min(60, speedMultiplier));
    console.log(`[TelemetrySimulator] Speed set to ${this.simulationSpeed}x`);
  }

  /**
   * Main periodic tick: updates overtime and dwell/grace states
   */
  tick() {
    const now = Date.now();
    let hasUpdates = false;

    for (const worker of this.workers) {
      // 1. If worker is checked in or in overtime, update overtime calculations
      if (
        worker.shift &&
        worker.shift.isFormallyCheckedIn &&
        worker.shift.checkInTime &&
        worker.status !== 'MEDICAL_LEAVE'
      ) {
        // Increment virtual time based on simulation speed
        if (this.simulationSpeed > 1) {
          // Adjust check-in time backward to simulate elapsed time
          worker.shift.checkInTime -= (this.simulationSpeed - 1) * 1000;
        }

        const ot = calculateOvertime({
          checkInTimeMs: worker.shift.checkInTime,
          checkOutTimeMs: now,
          baseHourlyWage: worker.baseWage,
          isRestDayOrHoliday: false,
        });

        worker.overtime = ot;

        // Auto transition between normal and overtime tiers
        if (ot.totalDurationSeconds >= 12 * 3600 && worker.status !== 'OVERTIME_TIER_2') {
          worker.status = 'OVERTIME_TIER_2';
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'OVERTIME_TIER_2',
            severity: 'CRITICAL',
            message: `${worker.name} escalated to Tier 2 Overtime (2.0x rate multiplier). Total worked: ${Math.floor(ot.totalDurationSeconds / 3600)}h.`,
          });
        } else if (
          ot.totalDurationSeconds >= 8 * 3600 &&
          ot.totalDurationSeconds < 12 * 3600 &&
          worker.status === 'CHECKED_IN_NORMAL'
        ) {
          worker.status = 'OVERTIME_TIER_1';
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'OVERTIME_THRESHOLD',
            severity: 'WARNING',
            message: `${worker.name} exceeded standard 8.0h shift. Tier 1 Overtime (1.5x rate multiplier) initiated.`,
          });
        }
        hasUpdates = true;
      }

      // 2. Handle Egress Grace countdown
      if (worker.status === 'OUT_OF_BOUNDS_WARNING' && worker.shift) {
        if (worker.shift.egressGraceRemainingSeconds > 0) {
          worker.shift.egressGraceRemainingSeconds = Math.max(
            0,
            worker.shift.egressGraceRemainingSeconds - this.simulationSpeed
          );
          if (worker.shift.egressGraceRemainingSeconds === 0) {
            // Grace expired! Enforce breach & checkout
            worker.status = 'OFF_DUTY';
            worker.shift.isFormallyCheckedIn = false;
            worker.shift.checkOutTime = now;
            this.emitAlert({
              workerId: worker.id,
              workerName: worker.name,
              zoneId: worker.assignedZoneId,
              type: 'GEOFENCE_BREACH_CRITICAL',
              severity: 'CRITICAL',
              message: `CRITICAL: Egress grace expired for ${worker.name}. Worker confirmed off-site without supervisor clearance.`,
            });
          }
        }
        hasUpdates = true;
      }

      // 3. Handle Ingress Dwell countdown
      if (worker.status === 'IN_TRANSIT' && worker.shift && worker.shift.ingressDwellSeconds) {
        worker.shift.ingressDwellSeconds += this.simulationSpeed;
        if (worker.shift.ingressDwellSeconds >= 180) {
          // Completed 180s dwell! Automated check-in!
          worker.status = 'CHECKED_IN_NORMAL';
          worker.shift.isFormallyCheckedIn = true;
          worker.shift.checkInTime = now;
          worker.shift.ingressDwellSeconds = 0;
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'AUTO_CHECKIN_VERIFIED',
            severity: 'INFO',
            message: `Automated check-in verified for ${worker.name} after completing 180s spatial dwell requirement.`,
          });
        }
        hasUpdates = true;
      }
    }

    // 4. Progress active scenario if running
    if (this.activeScenario) {
      this.stepScenario();
      hasUpdates = true;
    }

    if (hasUpdates && this.io) {
      this.broadcastState();
    }
  }

  /**
   * Broadcasts current state to all connected dashboard and mobile clients
   */
  broadcastState() {
    // Sanitized worker roster applying privacy firewall
    const safeWorkers = this.workers.map((worker) => {
      const firewall = applyPrivacyFirewall(worker, {
        latitude: worker.currentLocation ? worker.currentLocation.latitude : null,
        longitude: worker.currentLocation ? worker.currentLocation.longitude : null,
        accuracyMeters: worker.gpsAccuracy,
        batteryPercent: worker.batteryPercent,
        timestamp: Date.now(),
      });

      return {
        ...worker,
        currentLocation: firewall.telemetry.latitude
          ? { latitude: firewall.telemetry.latitude, longitude: firewall.telemetry.longitude }
          : null,
        isMasked: firewall.scrubbed,
        privacyNotice: firewall.privacyNotice,
      };
    });

    this.io.emit('telemetry:workers', safeWorkers);
    this.io.emit('telemetry:alerts', this.alerts);
  }

  /**
   * Adds and broadcasts an alert
   */
  emitAlert({ workerId, workerName, zoneId, type, severity, message }) {
    const zone = this.geofences.find((g) => g.id === zoneId);
    const alert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      workerId,
      workerName,
      zoneId,
      zoneName: zone ? zone.name : 'Unknown Zone',
      type,
      severity,
      message,
      acknowledged: false,
    };
    this.alerts.unshift(alert);
    // Keep max 50 alerts
    if (this.alerts.length > 50) this.alerts.pop();

    if (this.io) {
      this.io.emit('alert:new', alert);
    }
    return alert;
  }

  /**
   * Triggers predefined automated scenarios for demoing system capabilities
   */
  runScenario(scenarioName) {
    this.activeScenario = scenarioName;
    this.scenarioStep = 0;
    console.log(`[TelemetrySimulator] Launched scenario: ${scenarioName}`);

    switch (scenarioName) {
      case 'AUTO_CHECKIN_DWELL': {
        // Samantha Reed enters East Bay Substation
        const worker = this.workers.find((w) => w.id === 'worker-samantha');
        if (worker) {
          worker.status = 'IN_TRANSIT';
          worker.currentLocation = { latitude: 37.7651, longitude: -122.4348 }; // Inside Substation
          worker.shift.ingressDwellSeconds = 1;
          worker.shift.isFormallyCheckedIn = false;
          worker.shift.checkInTime = null;
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'INGRESS_DWELL_STARTED',
            severity: 'INFO',
            message: `${worker.name} detected inside East Bay Substation. Ingress dwell timer armed (180s requirement).`,
          });
        }
        break;
      }

      case 'OVERTIME_ESCALATION': {
        // Alex Carter accelerates toward 8h limit
        const worker = this.workers.find((w) => w.id === 'worker-alex');
        if (worker) {
          worker.shift.checkInTime = Date.now() - (7 * 3600 + 59 * 60) * 1000; // 7h 59m worked
          worker.status = 'CHECKED_IN_NORMAL';
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'SHIFT_NEAR_LIMIT',
            severity: 'INFO',
            message: `${worker.name} is 1 minute away from standard 8-hour shift ceiling.`,
          });
        }
        break;
      }

      case 'GEOFENCE_BREACH': {
        // David Kim steps further outside
        const worker = this.workers.find((w) => w.id === 'worker-david');
        if (worker) {
          worker.status = 'OUT_OF_BOUNDS_WARNING';
          worker.currentLocation = { latitude: 37.7810, longitude: -122.4280 }; // Far outside
          worker.shift.egressGraceRemainingSeconds = 15; // 15 seconds to breach
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'GEOFENCE_BREACH_WARNING',
            severity: 'WARNING',
            message: `${worker.name} critical egress grace: 15 seconds remaining before unauthorized departure breach.`,
          });
        }
        break;
      }

      case 'MEDICAL_LEAVE_ACTIVATION': {
        // Alex Carter reports medical condition
        const worker = this.workers.find((w) => w.id === 'worker-alex');
        if (worker) {
          worker.status = 'MEDICAL_LEAVE';
          worker.leaveType = 'MEDICAL';
          worker.currentLocation = null;
          worker.shift.isFormallyCheckedIn = false;
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'MEDICAL_LEAVE_ACTIVATED',
            severity: 'INFO',
            message: `Medical leave granted to ${worker.name}. Privacy firewall activated: GPS telemetry purged and masked.`,
          });
        }
        break;
      }

      case 'EMERGENCY_SOS': {
        // Carlos Mendez hits Emergency SOS
        const worker = this.workers.find((w) => w.id === 'worker-carlos');
        if (worker) {
          worker.status = 'EMERGENCY_SOS';
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'EMERGENCY_SOS',
            severity: 'CRITICAL',
            message: `EMERGENCY SOS: Lone worker distress beacon activated by ${worker.name} at Port Cargo Terminal! Immediate response required.`,
          });
        }
        break;
      }

      case 'REMOTE_WORK_APPROVED': {
        // Priya Patel approved for remote telecommute
        const worker = this.workers.find((w) => w.id === 'worker-priya');
        if (worker) {
          worker.status = 'APPROVED_REMOTE';
          worker.leaveType = 'REMOTE';
          const remoteZone = createEphemeralRemoteZone(
            worker.id,
            'Sunset Field Satellite Site',
            37.7600,
            -122.4800
          );
          worker.assignedZoneId = remoteZone.id;
          worker.currentLocation = { latitude: 37.7601, longitude: -122.4798 };
          this.geofences.push(remoteZone);
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: remoteZone.id,
            type: 'REMOTE_WORK_APPROVED',
            severity: 'INFO',
            message: `Ephemeral remote geofence provisioned for ${worker.name} (150m perimeter).`,
          });
        }
        break;
      }
    }

    this.broadcastState();
  }

  stepScenario() {
    this.scenarioStep += 1;
    // Scenarios auto-conclude after 30 ticks
    if (this.scenarioStep > 30) {
      this.activeScenario = null;
      console.log('[TelemetrySimulator] Scenario completed.');
    }
  }

  /**
   * Ingests a telemetry packet from the mobile client
   */
  ingestTelemetry(workerId, telemetry) {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) return { success: false, error: 'Worker not found' };

    // Update battery and accuracy
    if (telemetry.batteryPercent !== undefined) worker.batteryPercent = telemetry.batteryPercent;
    if (telemetry.accuracyMeters !== undefined) worker.gpsAccuracy = telemetry.accuracyMeters;

    // Check if worker is on medical leave
    if (worker.status === 'MEDICAL_LEAVE' || worker.leaveType === 'MEDICAL') {
      worker.currentLocation = null;
      this.broadcastState();
      return { success: true, status: 'MASKED_MEDICAL_LEAVE' };
    }

    // Update position
    if (telemetry.latitude && telemetry.longitude) {
      worker.currentLocation = {
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
      };

      // Append breadcrumb
      if (!worker.breadcrumbs) worker.breadcrumbs = [];
      worker.breadcrumbs.push({
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        timestamp: Date.now(),
      });
      if (worker.breadcrumbs.length > 20) worker.breadcrumbs.shift();

      // Evaluate against assigned geofence
      const zone = this.geofences.find((g) => g.id === worker.assignedZoneId);
      if (zone) {
        const evalResult = evaluateTelemetryFix(
          {
            latitude: telemetry.latitude,
            longitude: telemetry.longitude,
            accuracyMeters: telemetry.accuracyMeters || 5,
            timestamp: Date.now(),
          },
          zone,
          {
            employeeId: worker.id,
            currentSpatialStatus: worker.currentSpatialStatus,
            isFormallyCheckedIn: worker.shift ? worker.shift.isFormallyCheckedIn : false,
            ingressDwellStartMs: worker.ingressDwellStartMs,
            egressGraceStartMs: worker.egressGraceStartMs,
          }
        );

        if (evalResult.stateChangeTriggered === 'CHECK_IN_TRIGGERED') {
          worker.status = 'CHECKED_IN_NORMAL';
          if (worker.shift) {
            worker.shift.isFormallyCheckedIn = true;
            worker.shift.checkInTime = Date.now();
          }
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: zone.id,
            type: 'AUTO_CHECKIN_VERIFIED',
            severity: 'INFO',
            message: `Automated check-in verified for ${worker.name} in ${zone.name}.`,
          });
        } else if (evalResult.stateChangeTriggered === 'EGRESS_GRACE_ENTERED') {
          worker.status = 'OUT_OF_BOUNDS_WARNING';
          if (worker.shift) {
            worker.shift.egressGraceRemainingSeconds = 300;
          }
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: zone.id,
            type: 'GEOFENCE_BREACH_WARNING',
            severity: 'WARNING',
            message: `${worker.name} exited ${zone.name}. Egress grace period initiated (300s).`,
          });
        } else if (evalResult.stateChangeTriggered === 'CHECK_OUT_TRIGGERED') {
          worker.status = 'OFF_DUTY';
          if (worker.shift) {
            worker.shift.isFormallyCheckedIn = false;
            worker.shift.checkOutTime = Date.now();
          }
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: zone.id,
            type: 'AUTO_CHECKOUT_VERIFIED',
            severity: 'INFO',
            message: `Automated check-out registered for ${worker.name} after egress grace timeout.`,
          });
        }
      }
    }

    this.broadcastState();
    return { success: true, status: worker.status };
  }
}
