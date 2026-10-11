/**
 * @file api.js
 * @description REST API Routes for Workforce Monitoring System.
 */

import express from 'express';
import { calculateOvertime } from '../engine/overtimeEngine.js';
import { applyPrivacyFirewall, createEphemeralRemoteZone } from '../engine/privacyFirewall.js';
import { INITIAL_WORKERS, INITIAL_GEOFENCES, INITIAL_ALERTS } from '../data/seedData.js';

export function createApiRouter(workers, geofences, alerts, simulator) {
  const router = express.Router();

  // 1. Get Workers
  router.get('/workers', (req, res) => {
    const sanitized = workers.map((worker) => {
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

    res.json({ success: true, workers: sanitized });
  });

  // 2. Get Geofences
  router.get('/geofences', (req, res) => {
    res.json({ success: true, geofences });
  });

  // 3. Create Geofence
  router.post('/geofences', (req, res) => {
    const { name, type = 'CIRCULAR', center, radiusMeters = 200, bufferMeters = 30, color = '#3B82F6', vertices } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const newZone = {
      id: `zone-${Date.now()}`,
      name,
      type,
      center: center || { latitude: 37.7749, longitude: -122.4194 },
      radiusMeters: Number(radiusMeters),
      bufferMeters: Number(bufferMeters),
      color,
      vertices: vertices || [],
      headcountTarget: 2,
    };

    geofences.push(newZone);
    simulator.broadcastState();
    res.json({ success: true, geofence: newZone });
  });

  // 4. Get Alerts
  router.get('/alerts', (req, res) => {
    res.json({ success: true, alerts });
  });

  // 5. Acknowledge Alert
  router.post('/alerts/:id/ack', (req, res) => {
    const alert = alerts.find((a) => a.id === req.params.id);
    if (alert) {
      alert.acknowledged = true;
      simulator.broadcastState();
      return res.json({ success: true, alert });
    }
    res.status(404).json({ success: false, error: 'Alert not found' });
  });

  // 6. Ingest Telemetry from Mobile Client
  router.post('/telemetry/ingest', (req, res) => {
    const { workerId, telemetry } = req.body;
    if (!workerId || !telemetry) {
      return res.status(400).json({ success: false, error: 'Missing workerId or telemetry' });
    }

    const result = simulator.ingestTelemetry(workerId, telemetry);
    res.json(result);
  });

  // 7. Update Worker Status / Leave / Shift Override
  router.post('/workers/:id/status', (req, res) => {
    const worker = workers.find((w) => w.id === req.params.id);
    if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

    const { status, leaveType, assignedZoneId } = req.body;

    if (status) worker.status = status;
    if (leaveType !== undefined) worker.leaveType = leaveType;
    if (assignedZoneId) worker.assignedZoneId = assignedZoneId;

    if (leaveType === 'MEDICAL' || status === 'MEDICAL_LEAVE') {
      worker.status = 'MEDICAL_LEAVE';
      worker.leaveType = 'MEDICAL';
      worker.currentLocation = null;
      worker.shift.isFormallyCheckedIn = false;
      simulator.emitAlert({
        workerId: worker.id,
        workerName: worker.name,
        zoneId: worker.assignedZoneId,
        type: 'MEDICAL_LEAVE_ACTIVATED',
        severity: 'INFO',
        message: `Medical leave updated for ${worker.name}. Privacy firewall active: GPS stripped.`,
      });
    } else if (leaveType === 'REMOTE' || status === 'APPROVED_REMOTE') {
      worker.status = 'APPROVED_REMOTE';
      worker.leaveType = 'REMOTE';
      const remoteZone = createEphemeralRemoteZone(worker.id, 'Remote Home Office', 37.7780, -122.4500);
      worker.assignedZoneId = remoteZone.id;
      if (!geofences.find((g) => g.id === remoteZone.id)) {
        geofences.push(remoteZone);
      }
      simulator.emitAlert({
        workerId: worker.id,
        workerName: worker.name,
        zoneId: remoteZone.id,
        type: 'REMOTE_WORK_APPROVED',
        severity: 'INFO',
        message: `Approved remote work activated for ${worker.name}.`,
      });
    }

    simulator.broadcastState();
    res.json({ success: true, worker });
  });

  // 8. Trigger Emergency SOS
  router.post('/workers/:id/sos', (req, res) => {
    const worker = workers.find((w) => w.id === req.params.id);
    if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

    worker.status = 'EMERGENCY_SOS';
    simulator.emitAlert({
      workerId: worker.id,
      workerName: worker.name,
      zoneId: worker.assignedZoneId,
      type: 'EMERGENCY_SOS',
      severity: 'CRITICAL',
      message: `DISTRESS ALERT: Lone worker emergency beacon triggered by ${worker.name}! Dispatching emergency personnel.`,
    });

    simulator.broadcastState();
    res.json({ success: true, worker });
  });

  // 9. Simulation Controls
  router.post('/simulation/scenario', (req, res) => {
    const { scenario } = req.body;
    simulator.runScenario(scenario);
    res.json({ success: true, scenario });
  });

  router.post('/simulation/speed', (req, res) => {
    const { speed } = req.body;
    simulator.setSpeed(Number(speed));
    res.json({ success: true, speed: simulator.simulationSpeed });
  });

  router.post('/simulation/reset', (req, res) => {
    // Reset to deep clone of initial seeds
    workers.length = 0;
    INITIAL_WORKERS.forEach((w) => workers.push(JSON.parse(JSON.stringify(w))));

    geofences.length = 0;
    INITIAL_GEOFENCES.forEach((g) => geofences.push(JSON.parse(JSON.stringify(g))));

    alerts.length = 0;
    INITIAL_ALERTS.forEach((a) => alerts.push(JSON.parse(JSON.stringify(a))));

    simulator.broadcastState();
    res.json({ success: true, message: 'Simulation reset to baseline' });
  });

  // 10. Comprehensive Timesheet & Overtime Report
  router.get('/reports/timesheet', (req, res) => {
    const report = workers.map((worker) => {
      let ot = {
        totalDurationSeconds: 0,
        regularDurationSeconds: 0,
        tier1OtDurationSeconds: 0,
        tier2OtDurationSeconds: 0,
        nightDiffDurationSeconds: 0,
        regularPay: 0,
        tier1OtPay: 0,
        tier2OtPay: 0,
        nightDiffPay: 0,
        totalPay: 0,
        overtimeExtraPay: 0,
        currentTierMultiplier: 1.0,
      };

      if (worker.shift && worker.shift.checkInTime) {
        ot = calculateOvertime({
          checkInTimeMs: worker.shift.checkInTime,
          checkOutTimeMs: worker.shift.checkOutTime || Date.now(),
          baseHourlyWage: worker.baseWage,
        });
      }

      return {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        department: worker.department,
        baseWage: worker.baseWage,
        status: worker.status,
        shiftScheduled: `${worker.shift.scheduledStart} - ${worker.shift.scheduledEnd}`,
        checkInTime: worker.shift.checkInTime ? new Date(worker.shift.checkInTime).toLocaleTimeString() : 'N/A',
        totalHours: (ot.totalDurationSeconds / 3600).toFixed(2),
        regularHours: (ot.regularDurationSeconds / 3600).toFixed(2),
        tier1OtHours: (ot.tier1OtDurationSeconds / 3600).toFixed(2),
        tier2OtHours: (ot.tier2OtDurationSeconds / 3600).toFixed(2),
        nightDiffHours: (ot.nightDiffDurationSeconds / 3600).toFixed(2),
        regularPay: ot.regularPay,
        overtimePay: ot.overtimeExtraPay,
        totalPay: ot.totalPay,
        multiplier: ot.currentTierMultiplier,
      };
    });

    res.json({ success: true, report });
  });

  return router;
}
