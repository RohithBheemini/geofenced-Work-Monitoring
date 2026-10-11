/**
 * @file spatialGeofence.js
 * @description Spatial Geofencing Engine implementing Haversine spherical distance,
 * Ray-Casting Point-in-Polygon (PIP), concentric hysteresis buffers, and temporal dwell timers.
 */

export const EARTH_RADIUS_METERS = 6371000.0;
export const MAX_ALLOWED_ACCURACY_METERS = 30.0;
export const MAX_PLAUSIBLE_SPEED_MPS = 50.0; // 180 km/h
export const INGRESS_DWELL_THRESHOLD_MS = 180 * 1000; // 180s continuous dwell required
export const EGRESS_GRACE_THRESHOLD_MS = 300 * 1000;  // 300s grace buffer before breach/checkout

/**
 * Calculates great-circle Haversine distance in meters with clamp for numerical stability.
 */
export function haversineDistance(coord1, coord2) {
  const lat1Rad = (coord1.latitude * Math.PI) / 180.0;
  const lat2Rad = (coord2.latitude * Math.PI) / 180.0;
  const deltaLatRad = ((coord2.latitude - coord1.latitude) * Math.PI) / 180.0;
  const deltaLonRad = ((coord2.longitude - coord1.longitude) * Math.PI) / 180.0;

  const a =
    Math.sin(deltaLatRad / 2.0) * Math.sin(deltaLatRad / 2.0) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2.0) *
      Math.sin(deltaLonRad / 2.0);

  const clampedA = Math.max(0.0, Math.min(1.0, a));
  const c = 2.0 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1.0 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Jordan Curve Theorem: Even-Odd Ray-Casting Point-in-Polygon (PIP).
 */
export function isPointInPolygon(point, vertices) {
  if (!vertices || vertices.length < 3) return false;

  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];

    const latCrosses =
      (vi.latitude > point.latitude) !== (vj.latitude > point.latitude);

    if (latCrosses) {
      const intersectLongitude =
        vj.longitude +
        ((point.latitude - vj.latitude) * (vi.longitude - vj.longitude)) /
          (vi.latitude - vj.latitude);

      if (point.longitude < intersectLongitude) {
        inside = !inside;
      }
    }
  }

  return inside;
}

/**
 * Computes minimum distance from a point to polygon boundary edges in meters.
 */
export function distanceToPolygonBoundary(point, vertices) {
  if (!vertices || vertices.length < 2) return Infinity;

  let minDistance = Infinity;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = vertices[j];
    const b = vertices[i];

    // Local planar projection
    const meanLatRad = (((a.latitude + b.latitude) / 2.0) * Math.PI) / 180.0;
    const metersPerDegreeLon =
      (Math.PI / 180.0) * EARTH_RADIUS_METERS * Math.cos(meanLatRad);
    const metersPerDegreeLat = (Math.PI / 180.0) * EARTH_RADIUS_METERS;

    const dxB = (b.longitude - a.longitude) * metersPerDegreeLon;
    const dyB = (b.latitude - a.latitude) * metersPerDegreeLat;
    const dxP = (point.longitude - a.longitude) * metersPerDegreeLon;
    const dyP = (point.latitude - a.latitude) * metersPerDegreeLat;

    const segmentLenSq = dxB * dxB + dyB * dyB;
    let t = 0.0;

    if (segmentLenSq > 1e-9) {
      t = (dxP * dxB + dyP * dyB) / segmentLenSq;
      t = Math.max(0.0, Math.min(1.0, t));
    }

    const closestPoint = {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };

    const dist = haversineDistance(point, closestPoint);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Evaluates spatial status relative to a zone with concentric hysteresis.
 * Returns { status: 'INSIDE_INNER' | 'IN_HYSTERESIS_BUFFER' | 'OUTSIDE_OUTER', distanceToCenter, distanceToEdge }
 */
export function evaluateSpatialStatus(point, zone) {
  if (zone.type === 'CIRCULAR') {
    const dist = haversineDistance(point, zone.center);
    const entryRadius = zone.radiusMeters;
    const buffer = zone.bufferMeters || Math.max(20.0, zone.radiusMeters * 0.15);
    const exitRadius = entryRadius + buffer;

    if (dist <= entryRadius) {
      return {
        status: 'INSIDE_INNER',
        distanceToCenter: Math.round(dist),
        distanceToEdge: Math.round(Math.abs(entryRadius - dist)),
      };
    } else if (dist <= exitRadius) {
      return {
        status: 'IN_HYSTERESIS_BUFFER',
        distanceToCenter: Math.round(dist),
        distanceToEdge: Math.round(dist - entryRadius),
      };
    } else {
      return {
        status: 'OUTSIDE_OUTER',
        distanceToCenter: Math.round(dist),
        distanceToEdge: Math.round(dist - entryRadius),
      };
    }
  } else {
    // Polygon evaluation
    const isInside = isPointInPolygon(point, zone.vertices);
    const edgeDist = distanceToPolygonBoundary(point, zone.vertices);
    const buffer = zone.bufferMeters || 20.0;

    if (isInside) {
      return {
        status: 'INSIDE_INNER',
        distanceToCenter: 0,
        distanceToEdge: Math.round(edgeDist),
      };
    } else if (edgeDist <= buffer) {
      return {
        status: 'IN_HYSTERESIS_BUFFER',
        distanceToCenter: 0,
        distanceToEdge: Math.round(edgeDist),
      };
    } else {
      return {
        status: 'OUTSIDE_OUTER',
        distanceToCenter: 0,
        distanceToEdge: Math.round(edgeDist),
      };
    }
  }
}

/**
 * Full telemetry fix evaluation with dwell counters and hysteresis
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

  // 1. Mock location rejection
  if (fix.isMock) {
    return {
      accepted: false,
      rejectReason: 'MOCK_DETECTED',
      spatialStatus: state.currentSpatialStatus,
      stateChangeTriggered: 'NONE',
      dwellSecondsActive: 0,
      graceSecondsRemaining: 0,
      updatedState: state,
    };
  }

  // 2. GPS accuracy rejection gate (> 30m)
  if (fix.accuracyMeters && fix.accuracyMeters > MAX_ALLOWED_ACCURACY_METERS) {
    return {
      accepted: false,
      rejectReason: 'ACCURACY_DEGRADED',
      spatialStatus: state.currentSpatialStatus,
      stateChangeTriggered: 'NONE',
      dwellSecondsActive: 0,
      graceSecondsRemaining: 0,
      updatedState: state,
    };
  }

  // 3. Kinematic Plausibility Validation
  if (state.lastValidFix && fix.timestamp) {
    const deltaSec = (fix.timestamp - state.lastValidFix.timestamp) / 1000.0;
    if (deltaSec > 0 && deltaSec <= 60.0) {
      const deltaDist = haversineDistance(fix, state.lastValidFix);
      const derivedSpeed = deltaDist / deltaSec;
      if (derivedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
        return {
          accepted: false,
          rejectReason: 'KINEMATIC_ANOMALY',
          spatialStatus: state.currentSpatialStatus,
          stateChangeTriggered: 'NONE',
          dwellSecondsActive: 0,
          graceSecondsRemaining: 0,
          updatedState: state,
        };
      }
    }
  }

  state.lastValidFix = fix;

  if (!zone) {
    return {
      accepted: true,
      spatialStatus: 'OUTSIDE_OUTER',
      stateChangeTriggered: 'NONE',
      distanceToCenterMeters: 0,
      distanceToEdgeMeters: 0,
      dwellSecondsActive: 0,
      graceSecondsRemaining: 0,
      updatedState: state,
    };
  }

  const { status, distanceToCenter, distanceToEdge } = evaluateSpatialStatus(fix, zone);
  state.currentSpatialStatus = status;

  let trigger = 'NONE';
  let dwellSecondsActive = 0;
  let graceSecondsRemaining = 0;
  const now = fix.timestamp || Date.now();

  // Ingress & Egress Dwell Timing Logic
  if (!state.isFormallyCheckedIn) {
    if (status === 'INSIDE_INNER') {
      if (!state.ingressDwellStartMs) {
        state.ingressDwellStartMs = now;
      }
      const elapsedDwellMs = now - state.ingressDwellStartMs;
      dwellSecondsActive = Math.floor(elapsedDwellMs / 1000);

      if (elapsedDwellMs >= INGRESS_DWELL_THRESHOLD_MS) {
        state.isFormallyCheckedIn = true;
        state.ingressDwellStartMs = null;
        trigger = 'CHECK_IN_TRIGGERED';
      }
    } else {
      state.ingressDwellStartMs = null;
      dwellSecondsActive = 0;
    }
  } else {
    // Already checked in
    if (status === 'OUTSIDE_OUTER') {
      if (!state.egressGraceStartMs) {
        state.egressGraceStartMs = now;
        trigger = 'EGRESS_GRACE_ENTERED';
      }
      const elapsedOutsideMs = now - state.egressGraceStartMs;
      const remainingGraceMs = Math.max(0, EGRESS_GRACE_THRESHOLD_MS - elapsedOutsideMs);
      graceSecondsRemaining = Math.ceil(remainingGraceMs / 1000);

      if (elapsedOutsideMs >= EGRESS_GRACE_THRESHOLD_MS) {
        state.isFormallyCheckedIn = false;
        state.egressGraceStartMs = null;
        trigger = 'CHECK_OUT_TRIGGERED';
      }
    } else if (status === 'INSIDE_INNER') {
      if (state.egressGraceStartMs) {
        state.egressGraceStartMs = null;
        trigger = 'EGRESS_GRACE_CANCELLED';
      }
      graceSecondsRemaining = Math.floor(EGRESS_GRACE_THRESHOLD_MS / 1000);
    } else {
      // In hysteresis buffer
      if (state.egressGraceStartMs) {
        const elapsedOutsideMs = now - state.egressGraceStartMs;
        const remainingGraceMs = Math.max(0, EGRESS_GRACE_THRESHOLD_MS - elapsedOutsideMs);
        graceSecondsRemaining = Math.ceil(remainingGraceMs / 1000);

        if (elapsedOutsideMs >= EGRESS_GRACE_THRESHOLD_MS) {
          state.isFormallyCheckedIn = false;
          state.egressGraceStartMs = null;
          trigger = 'CHECK_OUT_TRIGGERED';
        }
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
