/**
 * @file telemetrySimulator.js
 * @description Real-time Simulation Engine & Telemetry Streamer.
 * Manages automated movement scenarios, continuous overtime ticking,
 * and live WebSocket broadcasting.
 */

import { evaluateTelemetryFix } from '../engine/spatialGeofence.js';
import { calculateOvertime } from '../engine/overtimeEngine.js';
import { sanitizeWorkers, createEphemeralRemoteZone } from '../engine/privacyFirewall.js';

const SCENARIO_HANDLERS = {
  AUTO_CHECKIN_DWELL: (sim) => {
    const w = sim.workers.find((x) => x.id === 'worker-samantha');
    if (!w) return;
    Object.assign(w, {
      status: 'IN_TRANSIT',
      currentLocation: { latitude: 37.7651, longitude: -122.4348 },
    });
    if (w.shift) Object.assign(w.shift, { ingressDwellSeconds: 1, isFormallyCheckedIn: false, checkInTime: null });
    sim.emitAlert({
      workerId: w.id,
      workerName: w.name,
      zoneId: w.assignedZoneId,
      type: 'INGRESS_DWELL_STARTED',
      severity: 'INFO',
      message: `${w.name} detected inside East Bay Substation. Ingress dwell timer armed (180s requirement).`,
    });
  },

  OVERTIME_ESCALATION: (sim) => {
    const w = sim.workers.find((x) => x.id === 'worker-alex');
    if (!w) return;
    if (w.shift) w.shift.checkInTime = Date.now() - (7 * 3600 + 59 * 60) * 1000;
    w.status = 'CHECKED_IN_NORMAL';
    sim.emitAlert({
      workerId: w.id,
      workerName: w.name,
      zoneId: w.assignedZoneId,
      type: 'SHIFT_NEAR_LIMIT',
      severity: 'INFO',
      message: `${w.name} is 1 minute away from standard 8-hour shift ceiling.`,
    });
  },

  GEOFENCE_BREACH: (sim) => {
    const w = sim.workers.find((x) => x.id === 'worker-david');
    if (!w) return;
    w.status = 'OUT_OF_BOUNDS_WARNING';
    w.currentLocation = { latitude: 37.7810, longitude: -122.4280 };
    if (w.shift) w.shift.egressGraceRemainingSeconds = 15;
    sim.emitAlert({
      workerId: w.id,
      workerName: w.name,
      zoneId: w.assignedZoneId,
      type: 'GEOFENCE_BREACH_WARNING',
      severity: 'WARNING',
      message: `${w.name} critical egress grace: 15 seconds remaining before breach.`,
    });
  },

  MEDICAL_LEAVE_ACTIVATION: (sim) => {
    const w = sim.workers.find((x) => x.id === 'worker-alex');
    if (!w) return;
    Object.assign(w, { status: 'MEDICAL_LEAVE', leaveType: 'MEDICAL', currentLocation: null });
    if (w.shift) w.shift.isFormallyCheckedIn = false;
    sim.emitAlert({
      workerId: w.id,
      workerName: w.name,
      zoneId: w.assignedZoneId,
      type: 'MEDICAL_LEAVE_ACTIVATED',
      severity: 'INFO',
      message: `Medical leave granted to ${w.name}. Privacy firewall activated: GPS telemetry purged and masked.`,
    });
  },

  EMERGENCY_SOS: (sim) => {
    const w = sim.workers.find((x) => x.id === 'worker-carlos');
    if (!w) return;
    w.status = 'EMERGENCY_SOS';
    sim.emitAlert({
      workerId: w.id,
      workerName: w.name,
      zoneId: w.assignedZoneId,
      type: 'EMERGENCY_SOS',
      severity: 'CRITICAL',
      message: `EMERGENCY SOS: Lone worker distress beacon activated by ${w.name} at Port Cargo Terminal! Immediate response required.`,
    });
  },

  REMOTE_WORK_APPROVED: (sim) => {
    const w = sim.workers.find((x) => x.id === 'worker-priya');
    if (!w) return;
    w.status = 'APPROVED_REMOTE';
    w.leaveType = 'REMOTE';
    const remoteZone = createEphemeralRemoteZone(w.id, 'Sunset Field Satellite Site', 37.7600, -122.4800);
    w.assignedZoneId = remoteZone.id;
    w.currentLocation = { latitude: 37.7601, longitude: -122.4798 };
    sim.geofences.push(remoteZone);
    sim.emitAlert({
      workerId: w.id,
      workerName: w.name,
      zoneId: remoteZone.id,
      type: 'REMOTE_WORK_APPROVED',
      severity: 'INFO',
      message: `Ephemeral remote geofence provisioned for ${w.name} (150m perimeter).`,
    });
  },
};

export class TelemetrySimulator {
  constructor(workers, geofences, alerts, io) {
    this.workers = workers;
    this.geofences = geofences;
    this.alerts = alerts;
    this.io = io;
    this.intervalId = null;
    this.simulationSpeed = 1;
    this.activeScenario = null;
    this.scenarioStep = 0;
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setSpeed(speedMultiplier) {
    this.simulationSpeed = Math.max(1, Math.min(60, speedMultiplier));
  }

  tick() {
    const now = Date.now();
    let hasUpdates = false;

    for (const worker of this.workers) {
      // 1. Overtime progression
      if (worker.shift?.isFormallyCheckedIn && worker.shift.checkInTime && worker.status !== 'MEDICAL_LEAVE') {
        if (this.simulationSpeed > 1) {
          worker.shift.checkInTime -= (this.simulationSpeed - 1) * 1000;
        }

        const ot = calculateOvertime({
          checkInTimeMs: worker.shift.checkInTime,
          checkOutTimeMs: now,
          baseHourlyWage: worker.baseWage,
        });
        worker.overtime = ot;

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
        } else if (ot.totalDurationSeconds >= 8 * 3600 && ot.totalDurationSeconds < 12 * 3600 && worker.status === 'CHECKED_IN_NORMAL') {
          worker.status = 'OVERTIME_TIER_1';
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'OVERTIME_THRESHOLD',
            severity: 'WARNING',
            message: `${worker.name} exceeded standard 8.0h shift. Tier 1 Overtime (1.5x) initiated.`,
          });
        }
        hasUpdates = true;
      }

      // 2. Egress Grace countdown
      if (worker.status === 'OUT_OF_BOUNDS_WARNING' && worker.shift?.egressGraceRemainingSeconds > 0) {
        worker.shift.egressGraceRemainingSeconds = Math.max(0, worker.shift.egressGraceRemainingSeconds - this.simulationSpeed);
        if (worker.shift.egressGraceRemainingSeconds === 0) {
          worker.status = 'OFF_DUTY';
          worker.shift.isFormallyCheckedIn = false;
          worker.shift.checkOutTime = now;
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'GEOFENCE_BREACH_CRITICAL',
            severity: 'CRITICAL',
            message: `CRITICAL: Egress grace expired for ${worker.name}. Worker confirmed off-site.`,
          });
        }
        hasUpdates = true;
      }

      // 3. Ingress Dwell countdown
      if (worker.status === 'IN_TRANSIT' && worker.shift?.ingressDwellSeconds) {
        worker.shift.ingressDwellSeconds += this.simulationSpeed;
        if (worker.shift.ingressDwellSeconds >= 180) {
          worker.status = 'CHECKED_IN_NORMAL';
          Object.assign(worker.shift, { isFormallyCheckedIn: true, checkInTime: now, ingressDwellSeconds: 0 });
          this.emitAlert({
            workerId: worker.id,
            workerName: worker.name,
            zoneId: worker.assignedZoneId,
            type: 'AUTO_CHECKIN_VERIFIED',
            severity: 'INFO',
            message: `Automated check-in verified for ${worker.name} after 180s spatial dwell.`,
          });
        }
        hasUpdates = true;
      }
    }

    if (this.activeScenario) {
      this.scenarioStep += 1;
      if (this.scenarioStep > 30) this.activeScenario = null;
      hasUpdates = true;
    }

    if (hasUpdates && this.io) this.broadcastState();
  }

  broadcastState() {
    this.io.emit('telemetry:workers', sanitizeWorkers(this.workers));
    this.io.emit('telemetry:alerts', this.alerts);
  }

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
    if (this.alerts.length > 50) this.alerts.pop();

    this.io?.emit('alert:new', alert);
    return alert;
  }

  runScenario(scenarioName) {
    this.activeScenario = scenarioName;
    this.scenarioStep = 0;
    SCENARIO_HANDLERS[scenarioName]?.(this);
    this.broadcastState();
  }

  ingestTelemetry(workerId, telemetry) {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) return { success: false, error: 'Worker not found' };

    if (telemetry.batteryPercent !== undefined) worker.batteryPercent = telemetry.batteryPercent;
    if (telemetry.accuracyMeters !== undefined) worker.gpsAccuracy = telemetry.accuracyMeters;

    if (worker.status === 'MEDICAL_LEAVE' || worker.leaveType === 'MEDICAL') {
      worker.currentLocation = null;
      this.broadcastState();
      return { success: true, status: 'MASKED_MEDICAL_LEAVE' };
    }

    if (telemetry.latitude && telemetry.longitude) {
      worker.currentLocation = { latitude: telemetry.latitude, longitude: telemetry.longitude };

      if (!worker.breadcrumbs) worker.breadcrumbs = [];
      worker.breadcrumbs.push({ latitude: telemetry.latitude, longitude: telemetry.longitude, timestamp: Date.now() });
      if (worker.breadcrumbs.length > 20) worker.breadcrumbs.shift();

      const zone = this.geofences.find((g) => g.id === worker.assignedZoneId);
      if (zone) {
        const evalResult = evaluateTelemetryFix(
          { latitude: telemetry.latitude, longitude: telemetry.longitude, accuracyMeters: telemetry.accuracyMeters || 5, timestamp: Date.now() },
          zone,
          {
            employeeId: worker.id,
            currentSpatialStatus: worker.currentSpatialStatus,
            isFormallyCheckedIn: !!worker.shift?.isFormallyCheckedIn,
            ingressDwellStartMs: worker.ingressDwellStartMs,
            egressGraceStartMs: worker.egressGraceStartMs,
          }
        );

        const actions = {
          CHECK_IN_TRIGGERED: () => {
            worker.status = 'CHECKED_IN_NORMAL';
            if (worker.shift) Object.assign(worker.shift, { isFormallyCheckedIn: true, checkInTime: Date.now() });
            this.emitAlert({ workerId: worker.id, workerName: worker.name, zoneId: zone.id, type: 'AUTO_CHECKIN_VERIFIED', severity: 'INFO', message: `Automated check-in verified for ${worker.name} in ${zone.name}.` });
          },
          EGRESS_GRACE_ENTERED: () => {
            worker.status = 'OUT_OF_BOUNDS_WARNING';
            if (worker.shift) worker.shift.egressGraceRemainingSeconds = 300;
            this.emitAlert({ workerId: worker.id, workerName: worker.name, zoneId: zone.id, type: 'GEOFENCE_BREACH_WARNING', severity: 'WARNING', message: `${worker.name} exited ${zone.name}. Egress grace initiated (300s).` });
          },
          CHECK_OUT_TRIGGERED: () => {
            worker.status = 'OFF_DUTY';
            if (worker.shift) Object.assign(worker.shift, { isFormallyCheckedIn: false, checkOutTime: Date.now() });
            this.emitAlert({ workerId: worker.id, workerName: worker.name, zoneId: zone.id, type: 'AUTO_CHECKOUT_VERIFIED', severity: 'INFO', message: `Automated check-out registered for ${worker.name} after egress grace timeout.` });
          },
        };

        actions[evalResult.stateChangeTriggered]?.();
      }
    }

    this.broadcastState();
    return { success: true, status: worker.status };
  }
}
