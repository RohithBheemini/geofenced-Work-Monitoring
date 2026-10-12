/**
 * @file spatialGeofence.js
 * @description High-precision Spatial Geofencing Engine implementing Haversine,
 * Ray-Casting PIP, concentric hysteresis, and temporal dwell state machines.
 */

export const EARTH_RADIUS_METERS = 6371000.0;
export const MAX_ALLOWED_ACCURACY_METERS = 30.0;
export const MAX_PLAUSIBLE_SPEED_MPS = 50.0; // 180 km/h
export const INGRESS_DWELL_THRESHOLD_MS = 180 * 1000; // 180s continuous dwell required
export const EGRESS_GRACE_THRESHOLD_MS = 300 * 1000;  // 300s grace buffer before checkout

const TO_RAD = Math.PI / 180.0;

/**
 * Calculates great-circle Haversine distance in meters with numerical stability clamp.
 */
export function haversineDistance(c1, c2) {
  const dLat = (c2.latitude - c1.latitude) * TO_RAD;
  const dLon = (c2.longitude - c1.longitude) * TO_RAD;
  const lat1 = c1.latitude * TO_RAD;
  const lat2 = c2.latitude * TO_RAD;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const clamped = Math.max(0, Math.min(1, a));
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

/**
 * Jordan Curve Theorem: Even-Odd Ray-Casting Point-in-Polygon (PIP).
 */
export function isPointInPolygon(point, vertices) {
  if (!vertices || vertices.length < 3) return false;
  let inside = false;
  const { latitude: py, longitude: px } = point;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const { latitude: yi, longitude: xi } = vertices[i];
    const { latitude: yj, longitude: xj } = vertices[j];

    const crosses = (yi > py) !== (yj > py);
    if (crosses && px < xj + ((py - yj) * (xi - xj)) / (yi - yj)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Computes minimum perpendicular distance from a point to polygon edges in meters.
 */
export function distanceToPolygonBoundary(point, vertices) {
  if (!vertices || vertices.length < 2) return Infinity;
  let minDistance = Infinity;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j];
    const b = vertices[i];

    const meanLatRad = ((a.latitude + b.latitude) / 2) * TO_RAD;
    const mPerDegLon = TO_RAD * EARTH_RADIUS_METERS * Math.cos(meanLatRad);
    const mPerDegLat = TO_RAD * EARTH_RADIUS_METERS;

    const dxB = (b.longitude - a.longitude) * mPerDegLon;
    const dyB = (b.latitude - a.latitude) * mPerDegLat;
    const dxP = (point.longitude - a.longitude) * mPerDegLon;
    const dyP = (point.latitude - a.latitude) * mPerDegLat;

    const segLenSq = dxB * dxB + dyB * dyB;
    const t = segLenSq > 1e-9 ? Math.max(0, Math.min(1, (dxP * dxB + dyP * dyB) / segLenSq)) : 0;

    const closestPoint = {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };

    const dist = haversineDistance(point, closestPoint);
    if (dist < minDistance) minDistance = dist;
  }
  return minDistance;
}

/**
 * Evaluates spatial status with concentric hysteresis.
 */
export function evaluateSpatialStatus(point, zone) {
  if (zone.type === 'CIRCULAR') {
    const dist = haversineDistance(point, zone.center);
    const entryRadius = zone.radiusMeters;
    const buffer = zone.bufferMeters || Math.max(20.0, entryRadius * 0.15);
    const exitRadius = entryRadius + buffer;

    const status = dist <= entryRadius ? 'INSIDE_INNER' : dist <= exitRadius ? 'IN_HYSTERESIS_BUFFER' : 'OUTSIDE_OUTER';
    return {
      status,
      distanceToCenter: Math.round(dist),
      distanceToEdge: Math.round(Math.abs(entryRadius - dist)),
    };
  }

  const isInside = isPointInPolygon(point, zone.vertices);
  const edgeDist = distanceToPolygonBoundary(point, zone.vertices);
  const buffer = zone.bufferMeters || 20.0;

  const status = isInside ? 'INSIDE_INNER' : edgeDist <= buffer ? 'IN_HYSTERESIS_BUFFER' : 'OUTSIDE_OUTER';
  return {
    status,
    distanceToCenter: 0,
    distanceToEdge: Math.round(edgeDist),
  };
}

/**
 * Full telemetry fix evaluation with dwell counters and hysteresis.
 */
export function evaluateTelemetryFix(fix, zone, prevState = {}) {
  const state = {
    employeeId: prevState.employeeId,
    zoneId: zone ? zone.id : null,
    currentSpatialStatus: prevState.currentSpatialStatus || 'OUTSIDE_OUTER',
    isFormallyCheckedIn: !!prevState.isFormallyCheckedIn,
    ingressDwellStartMs: prevState.ingressDwellStartMs || null,
    egressGraceStartMs: prevState.egressGraceStartMs || null,
    lastValidFix: prevState.lastValidFix || null,
  };

  const reject = (reason, distCenter = 0) => ({
    accepted: false,
    rejectReason: reason,
    spatialStatus: state.currentSpatialStatus,
    stateChangeTriggered: 'NONE',
    distanceToCenterMeters: distCenter,
    distanceToEdgeMeters: 0,
    dwellSecondsActive: 0,
    graceSecondsRemaining: 0,
    updatedState: state,
  });

  if (fix.isMock) return reject('MOCK_DETECTED');
  if (fix.accuracyMeters && fix.accuracyMeters > MAX_ALLOWED_ACCURACY_METERS) return reject('ACCURACY_DEGRADED');

  // Kinematic plausibility check
  if (state.lastValidFix && fix.timestamp) {
    const deltaSec = (fix.timestamp - state.lastValidFix.timestamp) / 1000.0;
    if (deltaSec > 0 && deltaSec <= 60.0) {
      const deltaDist = haversineDistance(fix, state.lastValidFix);
      if (deltaDist / deltaSec > MAX_PLAUSIBLE_SPEED_MPS) return reject('KINEMATIC_ANOMALY', deltaDist);
    }
  }

  state.lastValidFix = fix;
  if (!zone) return { accepted: true, spatialStatus: 'OUTSIDE_OUTER', stateChangeTriggered: 'NONE', distanceToCenterMeters: 0, distanceToEdgeMeters: 0, dwellSecondsActive: 0, graceSecondsRemaining: 0, updatedState: state };

  const { status, distanceToCenter, distanceToEdge } = evaluateSpatialStatus(fix, zone);
  state.currentSpatialStatus = status;

  let trigger = 'NONE';
  let dwellSecondsActive = 0;
  let graceSecondsRemaining = 0;
  const now = fix.timestamp || Date.now();

  if (!state.isFormallyCheckedIn) {
    if (status === 'INSIDE_INNER') {
      if (!state.ingressDwellStartMs) state.ingressDwellStartMs = now;
      const elapsedDwellMs = now - state.ingressDwellStartMs;
      dwellSecondsActive = Math.floor(elapsedDwellMs / 1000);

      if (elapsedDwellMs >= INGRESS_DWELL_THRESHOLD_MS) {
        state.isFormallyCheckedIn = true;
        state.ingressDwellStartMs = null;
        trigger = 'CHECK_IN_TRIGGERED';
      }
    } else {
      state.ingressDwellStartMs = null;
    }
  } else {
    // Handling departure / egress grace
    if (status === 'OUTSIDE_OUTER' && !state.egressGraceStartMs) {
      state.egressGraceStartMs = now;
      trigger = 'EGRESS_GRACE_ENTERED';
    } else if (status === 'INSIDE_INNER' && state.egressGraceStartMs) {
      state.egressGraceStartMs = null;
      trigger = 'EGRESS_GRACE_CANCELLED';
      graceSecondsRemaining = Math.floor(EGRESS_GRACE_THRESHOLD_MS / 1000);
    }

    if (state.egressGraceStartMs) {
      const elapsedOutsideMs = now - state.egressGraceStartMs;
      graceSecondsRemaining = Math.max(0, Math.ceil((EGRESS_GRACE_THRESHOLD_MS - elapsedOutsideMs) / 1000));

      if (elapsedOutsideMs >= EGRESS_GRACE_THRESHOLD_MS) {
        state.isFormallyCheckedIn = false;
        state.egressGraceStartMs = null;
        trigger = 'CHECK_OUT_TRIGGERED';
      }
    }
  }

  return {
    accepted: true,
    spatialStatus: status,
    distanceToCenterMeters: distanceToCenter,
    distanceToEdgeMeters: distanceToEdge,
    stateChangeTriggered: trigger,
    dwellSecondsActive,
    graceSecondsRemaining,
    updatedState: state,
  };
}
