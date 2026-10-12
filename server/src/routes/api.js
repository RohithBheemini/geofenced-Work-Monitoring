/**
 * @file api.js
 * @description REST API Routes for Workforce Monitoring System.
 */

import express from 'express';
import { calculateOvertime } from '../engine/overtimeEngine.js';
import { sanitizeWorkers, createEphemeralRemoteZone } from '../engine/privacyFirewall.js';
import { INITIAL_WORKERS, INITIAL_GEOFENCES, INITIAL_ALERTS } from '../data/seedData.js';

export function createApiRouter(workers, geofences, alerts, simulator) {
  const router = express.Router();

  // 1. Get Workers (Sanitized with privacy firewall)
  router.get('/workers', (req, res) => {
    res.json({ success: true, workers: sanitizeWorkers(workers) });
  });

  // 2. Geofences
  router.get('/geofences', (req, res) => res.json({ success: true, geofences }));

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

  // 3. Alerts
  router.get('/alerts', (req, res) => res.json({ success: true, alerts }));

  router.post('/alerts/:id/ack', (req, res) => {
    const alert = alerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    alert.acknowledged = true;
    simulator.broadcastState();
    res.json({ success: true, alert });
  });

  // 4. Telemetry Ingest
  router.post('/telemetry/ingest', (req, res) => {
    const { workerId, telemetry } = req.body;
    if (!workerId || !telemetry) return res.status(400).json({ success: false, error: 'Missing workerId or telemetry' });
    res.json(simulator.ingestTelemetry(workerId, telemetry));
  });

  // 5. Worker Status / Leave Override
  router.post('/workers/:id/status', (req, res) => {
    const worker = workers.find((w) => w.id === req.params.id);
    if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

    const { status, leaveType, assignedZoneId } = req.body;
    if (status) worker.status = status;
    if (leaveType !== undefined) worker.leaveType = leaveType;
    if (assignedZoneId) worker.assignedZoneId = assignedZoneId;

    if (leaveType === 'MEDICAL' || status === 'MEDICAL_LEAVE') {
      Object.assign(worker, { status: 'MEDICAL_LEAVE', leaveType: 'MEDICAL', currentLocation: null });
      if (worker.shift) worker.shift.isFormallyCheckedIn = false;
      simulator.emitAlert({
        workerId: worker.id,
        workerName: worker.name,
        zoneId: worker.assignedZoneId,
        type: 'MEDICAL_LEAVE_ACTIVATED',
        severity: 'INFO',
        message: `Medical leave updated for ${worker.name}. Privacy firewall active: GPS stripped.`,
      });
    } else if (leaveType === 'REMOTE' || status === 'APPROVED_REMOTE') {
      Object.assign(worker, { status: 'APPROVED_REMOTE', leaveType: 'REMOTE' });
      const remoteZone = createEphemeralRemoteZone(worker.id, 'Remote Home Office', 37.7780, -122.4500);
      worker.assignedZoneId = remoteZone.id;
      if (!geofences.find((g) => g.id === remoteZone.id)) geofences.push(remoteZone);
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

  // 6. Emergency SOS
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

  // 7. Simulation Controls
  router.post('/simulation/scenario', (req, res) => {
    simulator.runScenario(req.body.scenario);
    res.json({ success: true, scenario: req.body.scenario });
  });

  router.post('/simulation/speed', (req, res) => {
    simulator.setSpeed(Number(req.body.speed));
    res.json({ success: true, speed: simulator.simulationSpeed });
  });

  router.post('/simulation/reset', (req, res) => {
    workers.length = 0;
    INITIAL_WORKERS.forEach((w) => workers.push(JSON.parse(JSON.stringify(w))));
    geofences.length = 0;
    INITIAL_GEOFENCES.forEach((g) => geofences.push(JSON.parse(JSON.stringify(g))));
    alerts.length = 0;
    INITIAL_ALERTS.forEach((a) => alerts.push(JSON.parse(JSON.stringify(a))));
    simulator.broadcastState();
    res.json({ success: true, message: 'Simulation reset to baseline' });
  });

  // 8. Timesheet & Overtime Report
  router.get('/reports/timesheet', (req, res) => {
    const now = Date.now();
    const report = workers.map((worker) => {
      const ot = calculateOvertime({
        checkInTimeMs: worker.shift?.checkInTime,
        checkOutTimeMs: worker.shift?.checkOutTime || now,
        baseHourlyWage: worker.baseWage,
      });

      return {
        id: worker.id,
        name: worker.name,
        role: worker.role,
        department: worker.department,
        baseWage: worker.baseWage,
        status: worker.status,
        shiftScheduled: `${worker.shift?.scheduledStart || '08:00'} - ${worker.shift?.scheduledEnd || '16:00'}`,
        checkInTime: worker.shift?.checkInTime ? new Date(worker.shift.checkInTime).toLocaleTimeString() : 'N/A',
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
