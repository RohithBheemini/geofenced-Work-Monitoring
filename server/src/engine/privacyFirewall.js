/**
 * @file privacyFirewall.js
 * @description Privacy Firewall & Emergency Isolation Engine.
 * Enforces GDPR/Labor Law compliance by scrubbing coordinates for medical leaves
 * and generating ephemeral micro-geofences for remote workers.
 */

export function applyPrivacyFirewall(worker, rawTelemetry) {
  if (worker.status === 'MEDICAL_LEAVE' || worker.leaveType === 'MEDICAL') {
    return {
      scrubbed: true,
      telemetry: {
        timestamp: rawTelemetry.timestamp || Date.now(),
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        speedMps: null,
        status: 'UNAVAILABLE_LEAVE',
        privacyStatus: 'MASKED_MEDICAL_LEAVE',
        batteryPercent: rawTelemetry.batteryPercent,
      },
      privacyNotice: 'Medical leave privacy firewall engaged. Geographic coordinates scrubbed in compliance with GDPR Art. 9 & labor regulations.',
    };
  }

  if (worker.status === 'APPROVED_REMOTE' || worker.shiftType === 'REMOTE') {
    return {
      scrubbed: false,
      telemetry: {
        ...rawTelemetry,
        status: 'APPROVED_REMOTE',
        privacyStatus: 'REMOTE_RESIDENTIAL_PROTECTED',
        isRemoteVerified: true,
      },
      privacyNotice: 'Approved remote telecommute active.',
    };
  }

  return { scrubbed: false, telemetry: rawTelemetry };
}

export function sanitizeWorkers(workers) {
  const now = Date.now();
  return workers.map((worker) => {
    const firewall = applyPrivacyFirewall(worker, {
      latitude: worker.currentLocation?.latitude ?? null,
      longitude: worker.currentLocation?.longitude ?? null,
      accuracyMeters: worker.gpsAccuracy,
      batteryPercent: worker.batteryPercent,
      timestamp: now,
    });

    return {
      ...worker,
      currentLocation: firewall.telemetry.latitude != null
        ? { latitude: firewall.telemetry.latitude, longitude: firewall.telemetry.longitude }
        : null,
      isMasked: firewall.scrubbed,
      privacyNotice: firewall.privacyNotice,
    };
  });
}

export function createEphemeralRemoteZone(workerId, address, lat, lng) {
  return {
    id: `remote-zone-${workerId}`,
    type: 'CIRCULAR',
    name: `Remote Hub: ${address || 'Authorized Remote Site'}`,
    center: { latitude: lat, longitude: lng },
    radiusMeters: 150,
    bufferMeters: 25,
    isEphemeral: true,
    workerId,
    createdAt: Date.now(),
  };
}
