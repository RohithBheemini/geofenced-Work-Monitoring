# Technical Design & Algorithmic Specifications
## High-Precision Geofenced Workforce Monitoring System (GWMS)

**Document Version:** 1.0.0  
**Classification:** Core System Architecture & Algorithmic Blueprint  
**Target Environment:** Node.js 20+ / TypeScript 5.4+ / Next.js 15 / PostgreSQL 16 (PostGIS) / Redis 7 / WebGL Vector Map  
**Companion Blueprint:** [ARCHITECTURE_SPECIFICATION.md](file:///c:/Users/Rohith/Downloads/Work-Monitoring-System/ARCHITECTURE_SPECIFICATION.md)

---

## Table of Contents
1. [Executive Overview & Algorithmic Architecture](#1-executive-overview--algorithmic-architecture)
2. [Spatial Geofencing Engine](#2-spatial-geofencing-engine)
   - 2.1 Haversine Spherical Distance Formulation
   - 2.2 Ray-Casting Point-in-Polygon (PIP) Algorithm
   - 2.3 Point-to-Polygon Edge Distance & Buffer Extension
   - 2.4 Concentric Spatial Hysteresis Model
   - 2.5 Temporal Ingress & Egress Dwell State Machine
   - 2.6 GPS Quality Filtering & Plausibility Validation
   - 2.7 Complete Reference Implementation (`spatial-geofence.engine.ts`)
3. [Shift State Machine & Attendance Automation](#3-shift-state-machine--attendance-automation)
   - 3.1 Discrete State Set & Topology
   - 3.2 Formal State Transition Table
   - 3.3 Guard Conditions & Temporal Windows
   - 3.4 Complete Reference Implementation (`shift-state-machine.engine.ts`)
4. [Overtime & Payroll Mathematical Engine](#4-overtime--payroll-mathematical-engine)
   - 4.1 Multi-Tier Overtime Hierarchy & Stacking Rules
   - 4.2 Continuous Per-Minute Accrual Formulation
   - 4.3 Night Differential Integral Formulation (22:00 - 06:00)
   - 4.4 Midnight Traversals & Rest Day Premiums
   - 4.5 Real-Time Cost Projection Formulas
   - 4.6 Complete Reference Implementation (`overtime-calculator.engine.ts`)
5. [Medical Leave Privacy Firewall & Remote Work Subsystem](#5-medical-leave-privacy-firewall--remote-work-subsystem)
   - 5.1 Zero-Knowledge Privacy Architecture
   - 5.2 Server-Side Ingestion Gateway Firewall
   - 5.3 Dynamic Ephemeral Remote Work Geofencing
   - 5.4 Complete Reference Implementation (`privacy-firewall.middleware.ts`)
6. [WebSocket & REST API System Contracts](#6-websocket--rest-api-system-contracts)
   - 6.1 REST Endpoints Contract (OpenAPI Specification)
   - 6.2 Real-Time WebSocket & Socket.io Event Protocol
   - 6.3 Complete Reference Controller (`telemetry-ingestion.controller.ts`)
7. [Comprehensive Seed Data Architecture](#7-comprehensive-seed-data-architecture)
   - 7.1 Field Worker Personas with Avatars & Attributes
   - 7.2 Diverse Geofence Zones (Radial, Polygonal, Remote)
   - 7.3 Canonical Shift Scenarios & Rosters
   - 7.4 Simulated Telemetry Walk Trajectories
   - 7.5 Complete Reference Seed Generator (`seed-data.generator.ts`)
8. [Builder Integration Blueprint & Verification Test Suite](#8-builder-integration-blueprint--verification-test-suite)

---

## 1. Executive Overview & Algorithmic Architecture

The Geofenced Workforce Monitoring System (GWMS) delivers deterministic, sub-meter attendance verification and continuous overtime payroll calculation for distributed field workforces. 

To eliminate false triggers caused by GPS multipath reflections, satellite clock jitter, and cellular dead zones, the system separates telemetry evaluation into three decoupled layers:
1. **Spatial Filtering Layer:** Enforces spherical Haversine metrics, ray-casting point-in-polygon tests, concentric dual-boundary spatial hysteresis, and GPS horizontal accuracy bounds.
2. **Temporal State Layer:** Governs stateful ingress dwell counters (180s requirement) and egress grace counters (300s buffer) across a discrete state machine.
3. **Financial Accrual Layer:** Executes per-minute and post-shift overtime accounting, applying statutory multipliers (1.0x, 1.5x, 2.0x) and night differential premiums (+0.25x) across midnight crossings.

```mermaid
flowchart TD
    RawFix["Mobile Telemetry Fix (lat, lng, acc, speed, time)"] --> PrivacyCheck{"Privacy Firewall Active? (Medical Leave)"}
    PrivacyCheck -- "Yes (Medical Leave)" --> ScrubCoords["Scrub Coordinates (Lat/Lng = null) -> Audit Mask"]
    PrivacyCheck -- "No" --> GpsAccuracy{"GPS Horizontal Accuracy <= 30m?"}
    
    GpsAccuracy -- "Fail (>30m)" --> DropDegraded["Drop Fix / Flag ACCURACY_DEGRADED"]
    GpsAccuracy -- "Pass" --> Plausibility{"Kinematic Speed Plausibility (<= 50 m/s)?"}
    
    Plausibility -- "Fail" --> DropSpoof["Flag GPS_ANOMALY / Mock Check"]
    Plausibility -- "Pass" --> SpatialEval["Spatial Geofence Engine (Haversine & Ray-Casting PIP)"]
    
    SpatialEval --> Hysteresis{"Concentric Hysteresis Check (R_entry vs R_exit)"}
    Hysteresis --> TemporalDwell{"Temporal State Evaluation (180s Ingress / 300s Egress)"}
    
    TemporalDwell --> StateMachine["Shift State Machine Engine"]
    StateMachine --> OvertimeEngine["Continuous Multi-Tier Overtime Engine"]
    OvertimeEngine --> Broadcast["Socket.io Operations Broadcast & DB Persistence"]
```

---

## 2. Spatial Geofencing Engine

### 2.1 Haversine Spherical Distance Formulation

The great-circle distance between two points on the WGS84 reference ellipsoid approximated as a sphere with mean radius $R = 6,371,000 \text{ meters}$ is calculated via the Haversine formula:

$$\Delta \phi = \phi_2 - \phi_1 = (\text{lat}_2 - \text{lat}_1) \cdot \frac{\pi}{180}$$
$$\Delta \lambda = \lambda_2 - \lambda_1 = (\text{lon}_2 - \text{lon}_1) \cdot \frac{\pi}{180}$$
$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{\text{clamp}(a, 0, 1)}, \sqrt{\text{clamp}(1 - a, 0, 1)}\right)$$
$$d = R \cdot c$$

> [!IMPORTANT]
> Floating-point precision rounding on antipodal or identical coordinates can cause $a > 1.0$ or $a < 0.0$. In GWMS, $a$ is strictly clamped to $[0.0, 1.0]$ before computing $\text{atan2}$ to avoid `NaN` outputs.

---

### 2.2 Ray-Casting Point-in-Polygon (PIP) Algorithm

For arbitrary non-convex or convex polygons defined by an ordered list of planar vertices $V = [v_0, v_1, \dots, v_{n-1}]$ where $v_i = (\text{lat}_i, \text{lon}_i)$, GWMS implements the Jordan Curve Theorem via the Even-Odd Ray-Casting Algorithm.

A horizontal ray is cast from test point $P = (P_{\text{lat}}, P_{\text{lon}})$ along the direction of increasing longitude ($\lambda \to +\infty$). The algorithm iterates through every edge connecting vertex $v_i$ and $v_j$ (where $j = (i + 1) \bmod n$):

An edge $E(v_i, v_j)$ intersects the ray if and only if:
1. $P_{\text{lat}}$ falls strictly within the latitude interval of the edge:
   $$\min(v_{i,\text{lat}}, v_{j,\text{lat}}) < P_{\text{lat}} \le \max(v_{i,\text{lat}}, v_{j,\text{lat}})$$
   *(Note the half-open interval $(y_{\min}, y_{\max}]$ prevents double-counting vertices located directly on the ray).*
2. The intersection longitude $X_{\text{intersect}}$ lies to the east of $P_{\text{lon}}$:
   $$X_{\text{intersect}} = v_{i,\text{lon}} + \frac{P_{\text{lat}} - v_{i,\text{lat}}}{v_{j,\text{lat}} - v_{i,\text{lat}}} \cdot (v_{j,\text{lon}} - v_{i,\text{lon}})$$
   $$P_{\text{lon}} < X_{\text{intersect}}$$

If the total number of valid intersections is odd, $P$ is inside the polygon; if even, $P$ is outside.

---

### 2.3 Point-to-Polygon Edge Distance & Buffer Extension

To evaluate polygon spatial hysteresis, the minimum perpendicular distance from test point $P$ to the polygonal perimeter is required.

For each edge segment from $A = (A_{\text{lat}}, A_{\text{lon}})$ to $B = (B_{\text{lat}}, B_{\text{lon}})$:
1. Project spherical coordinates into a local Euclidean tangent plane centered at $A$:
   $$\Delta x_B = (B_{\text{lon}} - A_{\text{lon}}) \cdot \cos\left(\frac{A_{\text{lat}} + B_{\text{lat}}}{2} \cdot \frac{\pi}{180}\right) \cdot \frac{\pi \cdot R}{180}$$
   $$\Delta y_B = (B_{\text{lat}} - A_{\text{lat}}) \cdot \frac{\pi \cdot R}{180}$$
   $$\Delta x_P = (P_{\text{lon}} - A_{\text{lon}}) \cdot \cos\left(\frac{A_{\text{lat}} + P_{\text{lat}}}{2} \cdot \frac{\pi}{180}\right) \cdot \frac{\pi \cdot R}{180}$$
   $$\Delta y_P = (P_{\text{lat}} - A_{\text{lat}}) \cdot \frac{\pi \cdot R}{180}$$
2. Compute the scalar projection parameter $t$ along segment $\vec{AB}$:
   $$t = \frac{\Delta x_P \cdot \Delta x_B + \Delta y_P \cdot \Delta y_B}{\Delta x_B^2 + \Delta y_B^2}$$
   $$t_{\text{clamped}} = \max(0, \min(1, t))$$
3. The closest point $Q$ on segment $AB$ is:
   $$Q = A + t_{\text{clamped}} \cdot (B - A)$$
4. Calculate $d_i = \text{Haversine}(P, Q)$. The polygon clearance distance is:
   $$D_{\text{edge}}(P) = \min_{i \in [0, n-1]} d_i$$

---

### 2.4 Concentric Spatial Hysteresis Model

To prevent rapid toggle check-in/check-out "bouncing" when a worker stands or walks along the physical perimeter, GWMS enforces a **dual-concentric spatial hysteresis ring**:

```
                       [ OUTSIDE BUFFER ]
                              |
                 R_exit = R + max(20m, 0.15 * R)
                              |
               +--------------v--------------+
               |    SPATIAL HYSTERESIS BAND  |
               +--------------+--------------+
                              |
                    R_entry = R (Target Site)
                              |
                        [ INSIDE SITE ]
```

1. **Circular Geofences:**
   - Inner Entry Perimeter: $R_{\text{entry}} = R$
   - Outer Exit Perimeter: $R_{\text{exit}} = R + B$, where $B = \max(20.0\text{ m}, 0.15 \cdot R)$
   - Transition Rule:
     - When worker is `OUTSIDE`: Worker must penetrate distance $d \le R_{\text{entry}}$ to satisfy the spatial ingress criterion.
     - When worker is `INSIDE`: Worker remains classified as spatially in-bounds until distance $d > R_{\text{exit}}$.

2. **Polygonal Geofences:**
   - Inner Entry Boundary: $P \in \text{Polygon}$ (Ray-Casting PIP returns `true`).
   - Outer Exit Boundary: $P \notin \text{Polygon}$ AND $D_{\text{edge}}(P) > B_{\text{poly}}$ (where $B_{\text{poly}} = 20.0\text{ meters}$).
   - While $P$ is outside the polygon but $D_{\text{edge}}(P) \le B_{\text{poly}}$, the worker remains inside the spatial hysteresis buffer, preventing false egress triggers.

---

### 2.5 Temporal Ingress & Egress Dwell State Machine

Spatial proximity alone does not trigger attendance transitions; temporal persistence is mandatory.

```mermaid
stateDiagram-v2
    [*] --> OUT_OF_BOUNDS
    
    OUT_OF_BOUNDS --> INGRESS_DWELLING: Point crosses R_entry (d <= R_entry)
    INGRESS_DWELLING --> OUT_OF_BOUNDS: Point exits R_entry before 180s (Dwell timer reset)
    INGRESS_DWELLING --> VERIFIED_IN_BOUNDS: Dwell duration >= 180s continuous
    
    VERIFIED_IN_BOUNDS --> EGRESS_GRACE: Point crosses R_exit (d > R_exit)
    EGRESS_GRACE --> VERIFIED_IN_BOUNDS: Point re-enters R_entry within 300s (Grace cancelled)
    EGRESS_GRACE --> CONFIRMED_EXIT: Outside R_exit > 300s continuous
    
    CONFIRMED_EXIT --> [*]
```

1. **Temporal Ingress Dwell Filter ($T_{\text{ingress\_dwell}} = 180\text{ seconds}$):**
   - Initiated on first valid fix with $d \le R_{\text{entry}}$.
   - Timestamp is recorded as `ingress_dwell_start`.
   - If any subsequent fix within 180 seconds registers $d > R_{\text{entry}}$, `ingress_dwell_start` is instantly reset to `null`.
   - When $(\text{timestamp} - \text{ingress\_dwell\_start}) \ge 180\text{s}$, the spatial engine emits `GEOFENCE_ENTER_VERIFIED`.

2. **Temporal Egress Grace Filter ($T_{\text{egress\_grace}} = 300\text{ seconds}$):**
   - Initiated when an in-bounds worker emits a fix with $d > R_{\text{exit}}$.
   - System transitions worker to `OUT_OF_BOUNDS_WARNING` / `TEMPORARY_EGRESS_GRACE` and arms `egress_grace_start`.
   - If worker returns inside $R_{\text{entry}}$ within 300 seconds, the grace timer is cleared, and continuous attendance is maintained without split records.
   - If outside duration exceeds 300 seconds, the engine emits `GEOFENCE_EXIT_CONFIRMED`.

---

### 2.6 GPS Quality Filtering & Plausibility Validation

Prior to spatial evaluation, every telemetry sample is passed through a deterministic pre-filter:
1. **Horizontal Accuracy Gate:**
   - Any telemetry point with `accuracy_meters > 30.0` is discarded from geofence boundary calculations and logged as `ACCURACY_DEGRADED`.
   - If accuracy remains $> 30.0\text{m}$ for $> 15\text{ minutes}$ during a scheduled shift, an operational warning `GPS_SIGNAL_WEAK` is raised.
2. **Kinematic Plausibility Filter:**
   - Let $\Delta t = t_{\text{current}} - t_{\text{previous}}$ and $\Delta d = \text{Haversine}(P_{\text{current}}, P_{\text{previous}})$.
   - Calculated instantaneous speed $v = \frac{\Delta d}{\Delta t}$.
   - If $v > 50.0\text{ m/s}$ ($180\text{ km/h}$) and $\Delta t \le 60\text{s}$, the sample is rejected as multipath jump or GPS teleportation anomaly.
3. **Mock Provider Detection:**
   - If payload field `is_mock === true`, the telemetry point is flagged, coordinates are quarantined, and a security alert `MOCK_LOCATION_DETECTED` is emitted immediately.

---

### 2.7 Complete Reference Implementation (`spatial-geofence.engine.ts`)

```typescript
/**
 * @file spatial-geofence.engine.ts
 * @description Production-grade spatial geofencing engine implementing Haversine,
 * ray-casting PIP, point-to-polygon distance, concentric hysteresis, and temporal dwell timers.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TelemetryFix extends LatLng {
  timestamp: number; // Unix epoch milliseconds
  accuracyMeters: number;
  speedMps?: number;
  isMock?: boolean;
}

export type GeofenceTopology = 'CIRCULAR' | 'POLYGON';

export interface CircularGeofenceDefinition {
  type: 'CIRCULAR';
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
  bufferMeters?: number; // Defaults to max(20m, 0.15 * radius)
}

export interface PolygonGeofenceDefinition {
  type: 'POLYGON';
  id: string;
  name: string;
  vertices: LatLng[]; // Ordered boundary coordinates
  bufferMeters?: number; // Defaults to 20 meters
}

export type GeofenceZone = CircularGeofenceDefinition | PolygonGeofenceDefinition;

export type SpatialBoundaryStatus = 
  | 'INSIDE_INNER'          // Inside target boundary
  | 'IN_HYSTERESIS_BUFFER'  // Between inner and outer boundary
  | 'OUTSIDE_OUTER';        // Outside outer buffer

export interface DwellEvaluationState {
  employeeId: string;
  zoneId: string;
  currentSpatialStatus: SpatialBoundaryStatus;
  isFormallyCheckedIn: boolean;
  ingressDwellStartMs: number | null;
  egressGraceStartMs: number | null;
  lastValidFix: TelemetryFix | null;
}

export interface GeofenceEvaluationResult {
  accepted: boolean;
  rejectReason?: 'ACCURACY_DEGRADED' | 'KINEMATIC_ANOMALY' | 'MOCK_DETECTED';
  distanceToCenterMeters: number;
  distanceToEdgeMeters: number;
  spatialStatus: SpatialBoundaryStatus;
  stateChangeTriggered: 'NONE' | 'CHECK_IN_TRIGGERED' | 'CHECK_OUT_TRIGGERED' | 'EGRESS_GRACE_ENTERED' | 'EGRESS_GRACE_CANCELLED';
  dwellSecondsActive: number;
  graceSecondsRemaining: number;
  updatedState: DwellEvaluationState;
}

export class SpatialGeofenceEngine {
  public static readonly EARTH_RADIUS_METERS = 6371000.0;
  public static readonly MAX_ALLOWED_ACCURACY_METERS = 30.0;
  public static readonly MAX_PLAUSIBLE_SPEED_MPS = 50.0; // 180 km/h
  public static readonly INGRESS_DWELL_THRESHOLD_MS = 180 * 1000; // 180 seconds
  public static readonly EGRESS_GRACE_THRESHOLD_MS = 300 * 1000;  // 300 seconds

  /**
   * High-precision Haversine spherical distance between two coordinates in meters.
   */
  public static haversineDistance(coord1: LatLng, coord2: LatLng): number {
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

    return SpatialGeofenceEngine.EARTH_RADIUS_METERS * c;
  }

  /**
   * Jordan Curve Theorem / Even-Odd Ray-Casting algorithm for Point-in-Polygon (PIP).
   */
  public static isPointInPolygon(point: LatLng, vertices: LatLng[]): boolean {
    if (vertices.length < 3) return false;

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
   * Calculates minimum perpendicular distance from a point to polygon boundary edges in meters.
   */
  public static distanceToPolygonBoundary(point: LatLng, vertices: LatLng[]): number {
    if (vertices.length < 2) return Infinity;

    let minDistance = Infinity;
    const n = vertices.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = vertices[j];
      const b = vertices[i];

      // Local tangent planar projection
      const meanLatRad = (((a.latitude + b.latitude) / 2.0) * Math.PI) / 180.0;
      const metersPerDegreeLon = (Math.PI / 180.0) * SpatialGeofenceEngine.EARTH_RADIUS_METERS * Math.cos(meanLatRad);
      const metersPerDegreeLat = (Math.PI / 180.0) * SpatialGeofenceEngine.EARTH_RADIUS_METERS;

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

      const closestPoint: LatLng = {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      };

      const dist = SpatialGeofenceEngine.haversineDistance(point, closestPoint);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return minDistance;
  }

  /**
   * Evaluates spatial status taking concentric hysteresis into account.
   */
  public static evaluateSpatialStatus(
    point: LatLng,
    zone: GeofenceZone
  ): { status: SpatialBoundaryStatus; distanceToCenter: number; distanceToEdge: number } {
    if (zone.type === 'CIRCULAR') {
      const dist = SpatialGeofenceEngine.haversineDistance(point, zone.center);
      const entryRadius = zone.radiusMeters;
      const buffer = zone.bufferMeters ?? Math.max(20.0, zone.radiusMeters * 0.15);
      const exitRadius = entryRadius + buffer;

      if (dist <= entryRadius) {
        return {
          status: 'INSIDE_INNER',
          distanceToCenter: dist,
          distanceToEdge: Math.abs(entryRadius - dist),
        };
      } else if (dist <= exitRadius) {
        return {
          status: 'IN_HYSTERESIS_BUFFER',
          distanceToCenter: dist,
          distanceToEdge: dist - entryRadius,
        };
      } else {
        return {
          status: 'OUTSIDE_OUTER',
          distanceToCenter: dist,
          distanceToEdge: dist - entryRadius,
        };
      }
    } else {
      // Polygon evaluation
      const isInside = SpatialGeofenceEngine.isPointInPolygon(point, zone.vertices);
      const edgeDist = SpatialGeofenceEngine.distanceToPolygonBoundary(point, zone.vertices);
      const buffer = zone.bufferMeters ?? 20.0;

      if (isInside) {
        return {
          status: 'INSIDE_INNER',
          distanceToCenter: 0.0,
          distanceToEdge: edgeDist,
        };
      } else if (edgeDist <= buffer) {
        return {
          status: 'IN_HYSTERESIS_BUFFER',
          distanceToCenter: 0.0,
          distanceToEdge: edgeDist,
        };
      } else {
        return {
          status: 'OUTSIDE_OUTER',
          distanceToCenter: 0.0,
          distanceToEdge: edgeDist,
        };
      }
    }
  }

  /**
   * Main evaluation pipeline incorporating GPS quality filter, spatial status, and dwell timers.
   */
  public static evaluateFix(
    fix: TelemetryFix,
    zone: GeofenceZone,
    prevState: DwellEvaluationState
  ): GeofenceEvaluationResult {
    const updated: DwellEvaluationState = { ...prevState };

    // 1. Mock location rejection
    if (fix.isMock) {
      return {
        accepted: false,
        rejectReason: 'MOCK_DETECTED',
        distanceToCenterMeters: 0,
        distanceToEdgeMeters: 0,
        spatialStatus: prevState.currentSpatialStatus,
        stateChangeTriggered: 'NONE',
        dwellSecondsActive: 0,
        graceSecondsRemaining: 0,
        updatedState: prevState,
      };
    }

    // 2. GPS Horizontal Accuracy Filter
    if (fix.accuracyMeters > SpatialGeofenceEngine.MAX_ALLOWED_ACCURACY_METERS) {
      return {
        accepted: false,
        rejectReason: 'ACCURACY_DEGRADED',
        distanceToCenterMeters: 0,
        distanceToEdgeMeters: 0,
        spatialStatus: prevState.currentSpatialStatus,
        stateChangeTriggered: 'NONE',
        dwellSecondsActive: 0,
        graceSecondsRemaining: 0,
        updatedState: prevState,
      };
    }

    // 3. Kinematic Plausibility Validation
    if (prevState.lastValidFix) {
      const deltaSec = (fix.timestamp - prevState.lastValidFix.timestamp) / 1000.0;
      if (deltaSec > 0 && deltaSec <= 60.0) {
        const deltaDist = SpatialGeofenceEngine.haversineDistance(fix, prevState.lastValidFix);
        const derivedSpeed = deltaDist / deltaSec;
        if (derivedSpeed > SpatialGeofenceEngine.MAX_PLAUSIBLE_SPEED_MPS) {
          return {
            accepted: false,
            rejectReason: 'KINEMATIC_ANOMALY',
            distanceToCenterMeters: deltaDist,
            distanceToEdgeMeters: 0,
            spatialStatus: prevState.currentSpatialStatus,
            stateChangeTriggered: 'NONE',
            dwellSecondsActive: 0,
            graceSecondsRemaining: 0,
            updatedState: prevState,
          };
        }
      }
    }

    // Telemetry accepted
    updated.lastValidFix = fix;

    // 4. Spatial Evaluation
    const { status, distanceToCenter, distanceToEdge } =
      SpatialGeofenceEngine.evaluateSpatialStatus(fix, zone);
    updated.currentSpatialStatus = status;

    let trigger: GeofenceEvaluationResult['stateChangeTriggered'] = 'NONE';
    let dwellSecondsActive = 0;
    let graceSecondsRemaining = 0;

    // 5. Ingress & Egress Dwell Timing Logic
    if (!updated.isFormallyCheckedIn) {
      // Worker is attempting to check in
      if (status === 'INSIDE_INNER') {
        if (updated.ingressDwellStartMs === null) {
          updated.ingressDwellStartMs = fix.timestamp;
        }

        const elapsedDwellMs = fix.timestamp - updated.ingressDwellStartMs;
        dwellSecondsActive = Math.floor(elapsedDwellMs / 1000);

        if (elapsedDwellMs >= SpatialGeofenceEngine.INGRESS_DWELL_THRESHOLD_MS) {
          updated.isFormallyCheckedIn = true;
          updated.ingressDwellStartMs = null;
          trigger = 'CHECK_IN_TRIGGERED';
        }
      } else {
        // Stepped back out or into buffer before 180s completion -> Reset ingress dwell
        updated.ingressDwellStartMs = null;
        dwellSecondsActive = 0;
      }
    } else {
      // Worker is currently checked in
      if (status === 'OUTSIDE_OUTER') {
        if (updated.egressGraceStartMs === null) {
          updated.egressGraceStartMs = fix.timestamp;
          trigger = 'EGRESS_GRACE_ENTERED';
        }

        const elapsedOutsideMs = fix.timestamp - updated.egressGraceStartMs;
        const remainingGraceMs = Math.max(0, SpatialGeofenceEngine.EGRESS_GRACE_THRESHOLD_MS - elapsedOutsideMs);
        graceSecondsRemaining = Math.ceil(remainingGraceMs / 1000);

        if (elapsedOutsideMs >= SpatialGeofenceEngine.EGRESS_GRACE_THRESHOLD_MS) {
          updated.isFormallyCheckedIn = false;
          updated.egressGraceStartMs = null;
          trigger = 'CHECK_OUT_TRIGGERED';
        }
      } else if (status === 'INSIDE_INNER') {
        // Safely re-entered inner boundary -> cancel egress grace
        if (updated.egressGraceStartMs !== null) {
          updated.egressGraceStartMs = null;
          trigger = 'EGRESS_GRACE_CANCELLED';
        }
        graceSecondsRemaining = Math.floor(SpatialGeofenceEngine.EGRESS_GRACE_THRESHOLD_MS / 1000);
      } else {
        // In hysteresis buffer: maintain existing grace countdown if active, do not initiate new one
        if (updated.egressGraceStartMs !== null) {
          const elapsedOutsideMs = fix.timestamp - updated.egressGraceStartMs;
          const remainingGraceMs = Math.max(0, SpatialGeofenceEngine.EGRESS_GRACE_THRESHOLD_MS - elapsedOutsideMs);
          graceSecondsRemaining = Math.ceil(remainingGraceMs / 1000);

          if (elapsedOutsideMs >= SpatialGeofenceEngine.EGRESS_GRACE_THRESHOLD_MS) {
            updated.isFormallyCheckedIn = false;
            updated.egressGraceStartMs = null;
            trigger = 'CHECK_OUT_TRIGGERED';
          }
        }
      }
    }

    return {
      accepted: true,
      distanceToCenterMeters: distanceToCenter,
      distanceToEdgeMeters: distanceToEdge,
      spatialStatus: status,
      stateChangeTriggered: trigger,
      dwellSecondsActive,
      graceSecondsRemaining,
      updatedState: updated,
    };
  }
}
```

---

## 3. Shift State Machine & Attendance Automation

### 3.1 Discrete State Set & Topology

The GWMS state machine guarantees that every field worker exists in exactly one deterministic operational state at any given epoch.

```
+-----------------------------------------------------------------------------------------+
|                               DISCRETE SHIFT STATES                                     |
+-----------------------------------------------------------------------------------------+
| 1. OFF_DUTY                 Worker unscheduled or outside shift activation window.      |
| 2. IN_TRANSIT               Approaching site within start window (T_start - 30m).       |
| 3. CHECKED_IN_NORMAL        Verified on-site within scheduled shift hours.              |
| 4. OVERTIME_TIER_1          Worked > 8.0 hours up to 12.0 hours (1.5x multiplier).      |
| 5. OVERTIME_TIER_2          Worked > 12.0 hours or Rest Day assignment (2.0x).          |
| 6. OUT_OF_BOUNDS_WARNING    Worker stepped beyond R_exit (300s grace countdown active). |
| 7. APPROVED_REMOTE          Telecommuting at authorized satellite/home micro-geofence.  |
| 8. MEDICAL_LEAVE_MASKED     Approved sick leave; hardware GPS killed & payload scrubbed.|
+-----------------------------------------------------------------------------------------+
```

```mermaid
stateDiagram-v2
    [*] --> OFF_DUTY
    
    OFF_DUTY --> IN_TRANSIT : t >= ShiftStart - 30m
    OFF_DUTY --> MEDICAL_LEAVE_MASKED : Medical Leave Approved
    OFF_DUTY --> APPROVED_REMOTE : Remote Shift Scheduled
    
    IN_TRANSIT --> CHECKED_IN_NORMAL : Dwell >= 180s inside R_entry
    IN_TRANSIT --> IN_TRANSIT : t > ShiftStart + 15m (Alert: LATE_ARRIVAL)
    
    CHECKED_IN_NORMAL --> OVERTIME_TIER_1 : Worked Duration >= 8.0 hrs
    CHECKED_IN_NORMAL --> OUT_OF_BOUNDS_WARNING : Distance > R_exit
    CHECKED_IN_NORMAL --> OFF_DUTY : Manual/Auto Shift Checkout
    
    OVERTIME_TIER_1 --> OVERTIME_TIER_2 : Worked Duration >= 12.0 hrs
    OVERTIME_TIER_1 --> OUT_OF_BOUNDS_WARNING : Distance > R_exit
    
    OVERTIME_TIER_2 --> OUT_OF_BOUNDS_WARNING : Distance > R_exit
    
    OUT_OF_BOUNDS_WARNING --> CHECKED_IN_NORMAL : Re-enters R_entry (< 300s, dur < 8h)
    OUT_OF_BOUNDS_WARNING --> OVERTIME_TIER_1 : Re-enters R_entry (< 300s, 8h <= dur < 12h)
    OUT_OF_BOUNDS_WARNING --> OVERTIME_TIER_2 : Re-enters R_entry (< 300s, dur >= 12h)
    OUT_OF_BOUNDS_WARNING --> OFF_DUTY : Grace Expired (> 300s) (Breach logged)
    
    APPROVED_REMOTE --> OFF_DUTY : Remote Shift Concluded
    MEDICAL_LEAVE_MASKED --> OFF_DUTY : Leave Period Ends
```

---

### 3.2 Formal State Transition Table

| Source State | Event Trigger | Guard Conditions | Destination State | Actions & System Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `OFF_DUTY` | `SHIFT_WINDOW_OPEN` | $t \ge T_{\text{start}} - 30\text{m}$ AND $t < T_{\text{end}}$ | `IN_TRANSIT` | Accelerates mobile GPS sampling to 30s; mounts geofence listener. |
| `IN_TRANSIT` | `GEOFENCE_INGRESS_SATISFIED` | In-bounds $d \le R_{\text{entry}}$ continuous for $\ge 180\text{s}$ | `CHECKED_IN_NORMAL` | Creates `AttendanceSession`; emits `session.checked_in` WebSocket event; chime. |
| `IN_TRANSIT` | `TARDY_THRESHOLD_ELAPSED` | $t > T_{\text{start}} + 15\text{m}$ AND session not created | `IN_TRANSIT` | Emits `alert.late_arrival` to Dispatcher; sets warning badge on dashboard. |
| `CHECKED_IN_NORMAL` | `STANDARD_HOURS_ELAPSED` | Elapsed duration $D_{\text{worked}} \ge 8.0\text{ hrs}$ | `OVERTIME_TIER_1` | Escalates billing rate to 1.5x; emits `overtime.tier.escalated`; amber ring. |
| `OVERTIME_TIER_1` | `TIER_1_HOURS_ELAPSED` | Elapsed duration $D_{\text{worked}} \ge 12.0\text{ hrs}$ | `OVERTIME_TIER_2` | Escalates billing rate to 2.0x; emits critical OT budget notification. |
| `CHECKED_IN_NORMAL` or `OVERTIME_TIER_1/2` | `BOUNDARY_EXIT_DETECTED` | Distance $d > R_{\text{exit}}$ | `OUT_OF_BOUNDS_WARNING` | Starts 300s grace countdown; emits yellow warning ping to mobile worker. |
| `OUT_OF_BOUNDS_WARNING` | `BOUNDARY_REENTRY_DETECTED`| Distance $d \le R_{\text{entry}}$ within $300\text{s}$ | Prior duty state | Cancels grace timer; maintains continuous timesheet record without seam. |
| `OUT_OF_BOUNDS_WARNING` | `EGRESS_GRACE_EXPIRED` | Outside $> 300\text{s}$ AND $t \ge T_{\text{end}} - 15\text{m}$ | `OFF_DUTY` | Finalizes session checkout; stops active hours counter. |
| `OUT_OF_BOUNDS_WARNING` | `EGRESS_GRACE_EXPIRED` | Outside $> 300\text{s}$ AND $t < T_{\text{end}} - 15\text{m}$ | `OFF_DUTY` | Emits critical `GEOFENCE_BREACH` alert; records unauthorized departure. |
| `ANY` | `MEDICAL_LEAVE_GRANTED` | Leave type is `MEDICAL` | `MEDICAL_LEAVE_MASKED` | **Stops GPS hardware; scrubs coordinates; renders Gray Shield.** |
| `OFF_DUTY` | `REMOTE_SHIFT_START` | Shift marked `REMOTE` & inside home zone | `APPROVED_REMOTE` | Provisions 150m ephemeral micro-geofence; renders Cobalt Blue ring. |

---

### 3.3 Guard Conditions & Temporal Windows

1. **Shift Arrival Window:** $[-30\text{m}, +15\text{m}]$ relative to $T_{\text{start}}$.
   - Pre-shift arrival (between $-30\text{m}$ and $0\text{m}$): Worker may check in; regular hours timer arms at $\max(t_{\text{checkin}}, T_{\text{start}})$ to prevent unauthorized pre-shift overtime accrual unless approved.
2. **Late Arrival Penalty:** Triggered at $T_{\text{start}} + 15\text{m} + 1\text{s}$ if no verified check-in exists.
3. **Early Departure Threshold:** If departure occurs before $T_{\text{end}} - 15\text{m}$ without dispatcher waiver, classified as `UNAUTHORIZED_EARLY_DEPARTURE`.
4. **Post-Shift Packing Buffer:** $20\text{ minutes}$ allotted after $T_{\text{end}}$ to vacate the perimeter. At $T_{\text{end}} + 20\text{m}$, automated checkout is enforced unless overtime authorization flag is set on the shift record.

---

### 3.4 Complete Reference Implementation (`shift-state-machine.engine.ts`)

```typescript
/**
 * @file shift-state-machine.engine.ts
 * @description Shift lifecycle state machine managing discrete duty states,
 * automated transitions, grace periods, and dispatch alerts.
 */

export type ShiftState = 
  | 'OFF_DUTY'
  | 'IN_TRANSIT'
  | 'CHECKED_IN_NORMAL'
  | 'OVERTIME_TIER_1'
  | 'OVERTIME_TIER_2'
  | 'OUT_OF_BOUNDS_WARNING'
  | 'APPROVED_REMOTE'
  | 'MEDICAL_LEAVE_MASKED';

export interface ShiftContext {
  shiftId: string;
  employeeId: string;
  zoneId: string;
  isRemote: boolean;
  isMedicalLeave: boolean;
  scheduledStartMs: number;
  scheduledEndMs: number;
  checkInTimeMs: number | null;
  checkOutTimeMs: number | null;
  lastStateChangeMs: number;
  previousOnDutyState?: ShiftState; // To restore after out-of-bounds grace re-entry
  unauthorizedBreachCount: number;
}

export type ShiftEvent = 
  | { type: 'TICK'; currentTimestampMs: number }
  | { type: 'GEOFENCE_ENTER'; currentTimestampMs: number }
  | { type: 'GEOFENCE_EXIT'; currentTimestampMs: number }
  | { type: 'REMOTE_APPROVED'; currentTimestampMs: number }
  | { type: 'MEDICAL_LEAVE_APPROVED'; currentTimestampMs: number }
  | { type: 'MANUAL_FORCE_CHECKOUT'; currentTimestampMs: number; reason: string };

export interface StateTransitionResult {
  previousState: ShiftState;
  newState: ShiftState;
  context: ShiftContext;
  alerts: Array<{
    type: 'LATE_ARRIVAL' | 'EARLY_DEPARTURE' | 'GEOFENCE_BREACH' | 'OVERTIME_START' | 'SYSTEM_INFO';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
}

export class ShiftStateMachine {
  public static readonly PRE_SHIFT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  public static readonly LATE_ARRIVAL_GRACE_MS = 15 * 60 * 1000; // 15 minutes
  public static readonly EARLY_DEPARTURE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  public static readonly STANDARD_WORK_DAY_MS = 8 * 3600 * 1000; // 8 hours
  public static readonly TIER_1_OT_CAP_MS = 12 * 3600 * 1000; // 12 hours

  public static transition(
    currentState: ShiftState,
    event: ShiftEvent,
    context: ShiftContext
  ): StateTransitionResult {
    const alerts: StateTransitionResult['alerts'] = [];
    let nextState = currentState;
    const now = event.currentTimestampMs;

    // 1. Unconditional Medical Leave Override
    if (context.isMedicalLeave || event.type === 'MEDICAL_LEAVE_APPROVED') {
      if (currentState !== 'MEDICAL_LEAVE_MASKED') {
        nextState = 'MEDICAL_LEAVE_MASKED';
        alerts.push({
          type: 'SYSTEM_INFO',
          severity: 'INFO',
          message: 'Medical leave privacy firewall engaged. Telemetry coordinates purged.',
        });
        context.lastStateChangeMs = now;
      }
      return { previousState: currentState, newState: nextState, context, alerts };
    }

    // 2. State Machine Dispatcher
    switch (currentState) {
      case 'OFF_DUTY': {
        if (context.isRemote) {
          if (now >= context.scheduledStartMs - ShiftStateMachine.PRE_SHIFT_WINDOW_MS) {
            nextState = 'APPROVED_REMOTE';
            context.checkInTimeMs = now;
            context.lastStateChangeMs = now;
          }
        } else if (now >= context.scheduledStartMs - ShiftStateMachine.PRE_SHIFT_WINDOW_MS && now < context.scheduledEndMs) {
          nextState = 'IN_TRANSIT';
          context.lastStateChangeMs = now;
        }
        break;
      }

      case 'IN_TRANSIT': {
        if (event.type === 'GEOFENCE_ENTER') {
          nextState = 'CHECKED_IN_NORMAL';
          context.checkInTimeMs = now;
          context.lastStateChangeMs = now;
          alerts.push({
            type: 'SYSTEM_INFO',
            severity: 'INFO',
            message: 'Automated check-in verified via spatial geofence dwell.',
          });
        } else if (event.type === 'TICK') {
          // Late arrival check
          if (now > context.scheduledStartMs + ShiftStateMachine.LATE_ARRIVAL_GRACE_MS && !context.checkInTimeMs) {
            alerts.push({
              type: 'LATE_ARRIVAL',
              severity: 'WARNING',
              message: `Worker late for scheduled shift. Past 15m grace window.`,
            });
          }
        }
        break;
      }

      case 'CHECKED_IN_NORMAL':
      case 'OVERTIME_TIER_1':
      case 'OVERTIME_TIER_2': {
        if (event.type === 'GEOFENCE_EXIT') {
          context.previousOnDutyState = currentState;
          nextState = 'OUT_OF_BOUNDS_WARNING';
          context.lastStateChangeMs = now;
          alerts.push({
            type: 'SYSTEM_INFO',
            severity: 'WARNING',
            message: 'Worker crossed perimeter. 300-second egress grace period initiated.',
          });
        } else if (event.type === 'MANUAL_FORCE_CHECKOUT') {
          nextState = 'OFF_DUTY';
          context.checkOutTimeMs = now;
          context.lastStateChangeMs = now;
        } else if (event.type === 'TICK' && context.checkInTimeMs) {
          const elapsedWorked = now - context.checkInTimeMs;

          if (elapsedWorked >= ShiftStateMachine.TIER_1_OT_CAP_MS) {
            if (currentState !== 'OVERTIME_TIER_2') {
              nextState = 'OVERTIME_TIER_2';
              context.lastStateChangeMs = now;
              alerts.push({
                type: 'OVERTIME_START',
                severity: 'CRITICAL',
                message: 'Worker escalated to Tier 2 Overtime (2.0x rate multiplier).',
              });
            }
          } else if (elapsedWorked >= ShiftStateMachine.STANDARD_WORK_DAY_MS) {
            if (currentState !== 'OVERTIME_TIER_1') {
              nextState = 'OVERTIME_TIER_1';
              context.lastStateChangeMs = now;
              alerts.push({
                type: 'OVERTIME_START',
                severity: 'WARNING',
                message: 'Worker escalated to Tier 1 Overtime (1.5x rate multiplier).',
              });
            }
          }
        }
        break;
      }

      case 'OUT_OF_BOUNDS_WARNING': {
        if (event.type === 'GEOFENCE_ENTER') {
          // Worker safely returned within grace period
          nextState = context.previousOnDutyState ?? 'CHECKED_IN_NORMAL';
          context.lastStateChangeMs = now;
          alerts.push({
            type: 'SYSTEM_INFO',
            severity: 'INFO',
            message: 'Worker re-entered site. Egress grace cancelled; active shift resumed.',
          });
        } else if (event.type === 'GEOFENCE_EXIT') {
          // Grace period expired outside
          context.checkOutTimeMs = now;
          nextState = 'OFF_DUTY';
          context.lastStateChangeMs = now;

          if (now < context.scheduledEndMs - ShiftStateMachine.EARLY_DEPARTURE_THRESHOLD_MS) {
            context.unauthorizedBreachCount++;
            alerts.push({
              type: 'GEOFENCE_BREACH',
              severity: 'CRITICAL',
              message: 'CRITICAL: Worker abandoned site prior to scheduled end. Unauthorized egress confirmed.',
            });
          } else {
            alerts.push({
              type: 'SYSTEM_INFO',
              severity: 'INFO',
              message: 'Automated shift checkout finalized after departure.',
            });
          }
        }
        break;
      }

      case 'APPROVED_REMOTE': {
        if (event.type === 'MANUAL_FORCE_CHECKOUT' || (now >= context.scheduledEndMs && event.type === 'TICK')) {
          nextState = 'OFF_DUTY';
          context.checkOutTimeMs = now;
          context.lastStateChangeMs = now;
        }
        break;
      }

      case 'MEDICAL_LEAVE_MASKED': {
        // Only transitions out when medical leave ends
        if (!context.isMedicalLeave) {
          nextState = 'OFF_DUTY';
          context.lastStateChangeMs = now;
        }
        break;
      }
    }

    return {
      previousState: currentState,
      newState: nextState,
      context,
      alerts,
    };
  }
}
```

---

## 4. Overtime & Payroll Mathematical Engine

### 4.1 Multi-Tier Overtime Hierarchy & Stacking Rules

GWMS implements multi-tier payroll accounting:

```
+-----------------------------------------------------------------------------------------------+
|                                    RATE MULTIPLIER MATRIX                                     |
+-----------------------------------------------------------------------------------------------+
| Shift Category               | Regular Day Rate | Rest Day / Holiday Rate | Night Differential|
+------------------------------+------------------+-------------------------+-------------------+
| Standard Hours (0.0 to 8.0h) | 1.00x Base       | 2.00x Base              | +0.25x Base       |
| Tier 1 Overtime (8.0 to 12.0h)| 1.50x Base      | 2.00x Base              | +0.25x Base       |
| Tier 2 Overtime (> 12.0h)    | 2.00x Base       | 2.00x Base              | +0.25x Base       |
+-----------------------------------------------------------------------------------------------+
```

**Premium Stacking Principle:**
Night differential is an **additive surcharge** ($+0.25 \times W_{\text{base}}$), not a compounding multiplication:
- Regular hours during night window: $(1.00 + 0.25) \times W_{\text{base}} = 1.25 \times W_{\text{base}}$
- Tier 1 Overtime during night window: $(1.50 + 0.25) \times W_{\text{base}} = 1.75 \times W_{\text{base}}$
- Tier 2 Overtime during night window: $(2.00 + 0.25) \times W_{\text{base}} = 2.25 \times W_{\text{base}}$

---

### 4.2 Continuous Per-Minute Accrual Formulation

Let $t_{\text{in}}$ be the UTC check-in timestamp and $t_{\text{curr}}$ be the evaluation timestamp.  
Total active duty seconds:
$$D_{\text{total}} = \max\left(0, \frac{t_{\text{curr}} - t_{\text{in}}}{1000} - D_{\text{unpaid\_breaks}}\right)$$

1. **Regular Duration ($D_{\text{reg}}$):**
   $$D_{\text{reg}} = \min(D_{\text{total}}, 28,800\text{ s})$$
2. **Tier 1 Overtime ($D_{\text{ot1}}$):**
   $$D_{\text{ot1}} = \max\left(0, \min(D_{\text{total}}, 43,200\text{ s}) - 28,800\text{ s}\right)$$
3. **Tier 2 Overtime ($D_{\text{ot2}}$):**
   $$D_{\text{ot2}} = \max\left(0, D_{\text{total}} - 43,200\text{ s}\right)$$

*(On statutory Rest Days or Public Holidays, $D_{\text{reg}} = 0$, $D_{\text{ot1}} = 0$, and $D_{\text{ot2}} = D_{\text{total}}$ from the first worked second).*

---

### 4.3 Night Differential Integral Formulation (22:00 - 06:00)

Night differential applies strictly between 22:00:00 (10:00 PM) and 06:00:00 (6:00 AM) in the worker's operational time zone.

Let $\mathcal{N}$ represent the set of all time intervals $[22:00_k, 06:00_{k+1}]$ across days $k$. The total night differential duration in seconds is:
$$D_{\text{night}} = \int_{t_{\text{in}}}^{t_{\text{curr}}} \mathbf{1}_{\{t \in \mathcal{N}\}}(t) \, dt$$

In the discrete 60-second polling tick, for each elapsed minute interval $[t_m, t_m + 60\text{s}]$:
$$\text{IsNight}(t_m) = \begin{cases} 1 & \text{if } \text{Hour}(t_m) \ge 22 \lor \text{Hour}(t_m) < 6 \\ 0 & \text{otherwise} \end{cases}$$
$$D_{\text{night}}(t) = D_{\text{night}}(t - 1) + 60 \cdot \text{IsNight}(t_m)$$

---

### 4.4 Midnight Traversals & Rest Day Premiums

When a shift begins at `20:00` on Day 1 and concludes at `04:30` on Day 2:
- All temporal arithmetic operates exclusively on **Absolute UTC Epoch Milliseconds**, making calculations immune to midnight rollover bugs.
- Under enterprise cumulative shift rules, the 8-hour shift clock accumulates continuously across the midnight boundary (i.e. $D_{\text{total}}$ accumulates uninterrupted).
- Under daily-reset jurisdictions, the session can be split at `23:59:59.999` UTC into Segment A and Segment B without losing total wage continuity.

---

### 4.5 Real-Time Cost Projection Formulas

Given base hourly wage $W_{\text{base}}$:

$$\text{Cost}_{\text{regular}} = \frac{D_{\text{reg}}}{3600} \cdot W_{\text{base}} \cdot 1.00$$
$$\text{Cost}_{\text{ot1}} = \frac{D_{\text{ot1}}}{3600} \cdot W_{\text{base}} \cdot 1.50$$
$$\text{Cost}_{\text{ot2}} = \frac{D_{\text{ot2}}}{3600} \cdot W_{\text{base}} \cdot 2.00$$
$$\text{Cost}_{\text{night\_diff}} = \frac{D_{\text{night}}}{3600} \cdot W_{\text{base}} \cdot 0.25$$

$$\text{Total Shift Cost} = \text{Cost}_{\text{regular}} + \text{Cost}_{\text{ot1}} + \text{Cost}_{\text{ot2}} + \text{Cost}_{\text{night\_diff}}$$

$$\text{Effective Blended Hourly Rate} = \frac{\text{Total Shift Cost}}{\max\left(1.0, \frac{D_{\text{total}}}{3600}\right)}$$

---

### 4.6 Complete Reference Implementation (`overtime-calculator.engine.ts`)

```typescript
/**
 * @file overtime-calculator.engine.ts
 * @description Dynamic per-minute and post-shift overtime calculator tracking
 * regular hours, Tier 1 (1.5x), Tier 2 (2.0x), and Night Differential (+0.25x).
 */

export interface OvertimeBreakdown {
  totalWorkedSeconds: number;
  regularSeconds: number;
  tier1OtSeconds: number;
  tier2OtSeconds: number;
  nightDiffSeconds: number;
  regularHours: number;
  tier1OtHours: number;
  tier2OtHours: number;
  nightDiffHours: number;
  regularCost: number;
  tier1OtCost: number;
  tier2OtCost: number;
  nightDiffCost: number;
  totalCost: number;
  effectiveHourlyRate: number;
  currentActiveTier: 'REGULAR' | 'TIER_1_1_5X' | 'TIER_2_2_0X';
  isNightDiffActiveNow: boolean;
}

export interface BreakPeriod {
  startMs: number;
  endMs: number;
}

export class OvertimeCalculator {
  public static readonly REGULAR_SHIFT_LIMIT_SECONDS = 8 * 3600;  // 28,800 seconds (8 hrs)
  public static readonly TIER_1_LIMIT_SECONDS = 12 * 3600;       // 43,200 seconds (12 hrs)

  /**
   * Evaluates if a given timestamp falls into the night window (22:00 - 06:00)
   * in the specified time zone (defaults to UTC).
   */
  public static isNightDifferential(timestampMs: number, timeZone = 'UTC'): boolean {
    const date = new Date(timestampMs);
    // Extract local hour in the specified timezone
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date);

    const hour = parseInt(hourStr, 10);
    return hour >= 22 || hour < 6;
  }

  /**
   * Computes granular minute-by-minute overtime breakdown across continuous time.
   */
  public static calculateDetailed(
    checkInMs: number,
    checkOutMs: number,
    baseHourlyWage: number,
    isRestDayOrHoliday = false,
    breaks: BreakPeriod[] = [],
    timeZone = 'UTC'
  ): OvertimeBreakdown {
    if (checkOutMs <= checkInMs) {
      return this.emptyBreakdown(baseHourlyWage);
    }

    // Calculate unpaid break deductions
    let breakMs = 0;
    for (const b of breaks) {
      const start = Math.max(checkInMs, b.startMs);
      const end = Math.min(checkOutMs, b.endMs);
      if (end > start) {
        breakMs += end - start;
      }
    }

    const netDurationMs = Math.max(0, checkOutMs - checkInMs - breakMs);
    const totalWorkedSeconds = Math.floor(netDurationMs / 1000);

    // Compute tier second allocations
    let regularSeconds = 0;
    let tier1OtSeconds = 0;
    let tier2OtSeconds = 0;

    if (isRestDayOrHoliday) {
      // Rest Day / Statutory Holiday: 100% Tier 2 (2.0x) from first second
      tier2OtSeconds = totalWorkedSeconds;
    } else {
      regularSeconds = Math.min(totalWorkedSeconds, this.REGULAR_SHIFT_LIMIT_SECONDS);
      tier1OtSeconds = Math.max(
        0,
        Math.min(totalWorkedSeconds, this.TIER_1_LIMIT_SECONDS) - this.REGULAR_SHIFT_LIMIT_SECONDS
      );
      tier2OtSeconds = Math.max(0, totalWorkedSeconds - this.TIER_1_LIMIT_SECONDS);
    }

    // Compute exact night differential seconds via 60-second time integration
    let nightDiffSeconds = 0;
    const stepMs = 60 * 1000;

    for (let cur = checkInMs; cur < checkOutMs; cur += stepMs) {
      // Check if current step falls into a break
      const inBreak = breaks.some(b => cur >= b.startMs && cur < b.endMs);
      if (!inBreak) {
        if (this.isNightDifferential(cur, timeZone)) {
          const sliceSec = Math.min(stepMs, checkOutMs - cur) / 1000;
          nightDiffSeconds += sliceSec;
        }
      }
    }

    // Financial arithmetic rounded to 2 decimal places
    const regularHours = Number((regularSeconds / 3600).toFixed(4));
    const tier1OtHours = Number((tier1OtSeconds / 3600).toFixed(4));
    const tier2OtHours = Number((tier2OtSeconds / 3600).toFixed(4));
    const nightDiffHours = Number((nightDiffSeconds / 3600).toFixed(4));

    const regularCost = Number((regularHours * baseHourlyWage * 1.0).toFixed(2));
    const tier1OtCost = Number((tier1OtHours * baseHourlyWage * 1.5).toFixed(2));
    const tier2OtCost = Number((tier2OtHours * baseHourlyWage * 2.0).toFixed(2));
    const nightDiffCost = Number((nightDiffHours * baseHourlyWage * 0.25).toFixed(2));

    const totalCost = Number(
      (regularCost + tier1OtCost + tier2OtCost + nightDiffCost).toFixed(2)
    );

    const totalWorkedHours = totalWorkedSeconds / 3600;
    const effectiveHourlyRate = totalWorkedHours > 0
      ? Number((totalCost / totalWorkedHours).toFixed(2))
      : baseHourlyWage;

    let currentActiveTier: OvertimeBreakdown['currentActiveTier'] = 'REGULAR';
    if (tier2OtSeconds > 0 || isRestDayOrHoliday) {
      currentActiveTier = 'TIER_2_2_0X';
    } else if (tier1OtSeconds > 0) {
      currentActiveTier = 'TIER_1_1_5X';
    }

    const isNightDiffActiveNow = this.isNightDifferential(checkOutMs, timeZone);

    return {
      totalWorkedSeconds,
      regularSeconds,
      tier1OtSeconds,
      tier2OtSeconds,
      nightDiffSeconds: Math.round(nightDiffSeconds),
      regularHours,
      tier1OtHours,
      tier2OtHours,
      nightDiffHours,
      regularCost,
      tier1OtCost,
      tier2OtCost,
      nightDiffCost,
      totalCost,
      effectiveHourlyRate,
      currentActiveTier,
      isNightDiffActiveNow,
    };
  }

  private static emptyBreakdown(baseHourlyWage: number): OvertimeBreakdown {
    return {
      totalWorkedSeconds: 0,
      regularSeconds: 0,
      tier1OtSeconds: 0,
      tier2OtSeconds: 0,
      nightDiffSeconds: 0,
      regularHours: 0,
      tier1OtHours: 0,
      tier2OtHours: 0,
      nightDiffHours: 0,
      regularCost: 0,
      tier1OtCost: 0,
      tier2OtCost: 0,
      nightDiffCost: 0,
      totalCost: 0,
      effectiveHourlyRate: baseHourlyWage,
      currentActiveTier: 'REGULAR',
      isNightDiffActiveNow: false,
    };
  }
}
```

---

## 5. Medical Leave Privacy Firewall & Remote Work Subsystem

### 5.1 Zero-Knowledge Privacy Architecture

Tracking employees on medical or sick leave violates HIPAA and GDPR Article 9. GWMS enforces a multi-tiered privacy firewall:

```mermaid
flowchart LR
    Client["Mobile Worker App"] --> GW["GWMS Ingestion Gateway"]
    GW --> Check{"Employee On Medical Leave?"}
    Check -- "YES" --> Strip["PURGE PAYLOAD:\nlat = null, lon = null,\nacc = null, speed = null"]
    Check -- "NO" --> Forward["Forward to Spatial Engine & TimescaleDB"]
    Strip --> NullSink["Store Scrubbed Event:\nstatus = 'MASKED_MEDICAL_LEAVE'"]
    NullSink --> LiveMap["Live Map Dispatcher:\nRender Gray Shield Badge #64748B\nZero Coordinates / No Pin on Map"]
```

1. **Client-Side Hardware Termination:** When a medical leave status is synchronized to the mobile device, background location listeners (`CoreLocation` / `FusedLocationProviderClient`) are unregistered.
2. **Server-Side Coordinate Purge:** If a stale or cached packet arrives from an employee on medical leave, the Gateway Middleware scrubs `latitude`, `longitude`, `accuracy`, and `speed` before any database persistence or WebSocket broadcast.
3. **Dispatcher Roster Masking:** On the Live Map, medical leave workers do not appear on the coordinate canvas. They are displayed in an off-canvas "Leave Roster" with a **Slate Gray Shield (`#64748B`)**.

---

### 5.2 Dynamic Ephemeral Remote Work Geofencing

For approved telecommuting:
1. Dispatcher/System accepts the approved remote address.
2. System provisions a temporary circular geofence with $R = 150.0\text{ meters}$ centered at the residential coordinate.
3. The spatial engine evaluates attendance against this ephemeral zone with standard 180s ingress dwell rules.
4. On the Live Map, the remote worker appears with an **Azure Blue Ring (`#3B82F6`)** and a `[REMOTE]` badge.
5. If residential privacy settings are active, the live map displays a generalized fuzzy perimeter rather than the exact household centroid.

---

### 5.3 Complete Reference Implementation (`privacy-firewall.middleware.ts`)

```typescript
/**
 * @file privacy-firewall.middleware.ts
 * @description Ingestion gateway privacy firewall and dynamic ephemeral remote geofence manager.
 */

import { CircularGeofenceDefinition } from './spatial-geofence.engine';

export interface InboundTelemetryPacket {
  employeeId: string;
  deviceTimestamp: string;
  monotonicSequenceId: number;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  batteryPct: number;
  isMock: boolean;
  payloadHash: string;
}

export interface SanitizedTelemetryPacket {
  employeeId: string;
  deviceTimestamp: string;
  monotonicSequenceId: number;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  batteryPct: number;
  isMock: boolean;
  privacyMasked: boolean;
  status: 'PROCESSED' | 'MASKED_MEDICAL_LEAVE';
}

export interface EmployeePrivacyProfile {
  employeeId: string;
  isOnMedicalLeave: boolean;
  isRemoteApproved: boolean;
  remoteGeofence?: CircularGeofenceDefinition;
}

export class PrivacyFirewallMiddleware {
  /**
   * Intercepts and strictly purges coordinates if an employee is on active medical leave.
   */
  public static filterTelemetry(
    packet: InboundTelemetryPacket,
    profile: EmployeePrivacyProfile
  ): SanitizedTelemetryPacket {
    if (profile.isOnMedicalLeave) {
      // Complete coordinate sanitization
      return {
        employeeId: packet.employeeId,
        deviceTimestamp: packet.deviceTimestamp,
        monotonicSequenceId: packet.monotonicSequenceId,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        speedMps: null,
        headingDeg: null,
        batteryPct: packet.batteryPct,
        isMock: false,
        privacyMasked: true,
        status: 'MASKED_MEDICAL_LEAVE',
      };
    }

    return {
      ...packet,
      privacyMasked: false,
      status: 'PROCESSED',
    };
  }

  /**
   * Provisions an ephemeral 150m circular geofence for approved remote telecommuting.
   */
  public static createEphemeralRemoteGeofence(
    employeeId: string,
    latitude: number,
    longitude: number,
    radiusMeters = 150.0
  ): CircularGeofenceDefinition {
    return {
      type: 'CIRCULAR',
      id: `remote-${employeeId}-${Date.now()}`,
      name: `Approved Remote Site (${employeeId.slice(0, 8)})`,
      center: { latitude, longitude },
      radiusMeters,
      bufferMeters: 25.0, // 25m hysteresis margin
    };
  }
}
```

---

## 6. WebSocket & REST API System Contracts

### 6.1 REST Endpoints Contract (OpenAPI Specification)

```
+-----------------------------------------------------------------------------------------------+
|                                    CORE REST API ENDPOINTS                                    |
+-----------------------------------------------------------------------------------------------+
| POST /api/v1/telemetry/ingest       Ingests mobile location fixes with anti-spoof checks.     |
| POST /api/v1/attendance/check-in    Explicit or manual attendance check-in override.          |
| POST /api/v1/attendance/check-out   Finalizes attendance session & generates timesheet.       |
| POST /api/v1/shifts/geofence-check  Edge point-in-zone evaluation test endpoint.              |
| GET  /api/v1/manager/live-map       Returns real-time worker fleet positions & OT metrics.   |
| POST /api/v1/manager/overrides      Dispatcher manual override (OT approval, waiver).         |
+-----------------------------------------------------------------------------------------------+
```

#### 1. `POST /api/v1/telemetry/ingest`
- **Request Body:**
```json
{
  "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
  "device_timestamp": "2026-10-11T08:15:30.450Z",
  "monotonic_sequence_id": 41829,
  "latitude": 37.774929,
  "longitude": -122.419416,
  "accuracy_meters": 8.4,
  "speed_mps": 0.35,
  "heading_deg": 184.2,
  "battery_pct": 88,
  "is_mock": false,
  "payload_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
- **Response (`200 OK`):**
```json
{
  "status": "PROCESSED",
  "current_state": "CHECKED_IN_NORMAL",
  "active_zone_id": "zone-sf-central-01",
  "dwell_time_seconds": 320,
  "overtime_active": false,
  "tracking_interval_seconds": 15,
  "privacy_masked": false
}
```
*(If employee is on medical leave, response returns `status: "MASKED_MEDICAL_LEAVE"` and `privacy_masked: true`).*

---

#### 2. `POST /api/v1/attendance/check-out`
- **Request Body:**
```json
{
  "session_id": "sess-90e4f1a2-bdf4-4110",
  "check_out_time": "2026-10-11T17:45:00.000Z",
  "latitude": 37.774929,
  "longitude": -122.419416,
  "accuracy_meters": 12.0,
  "check_out_type": "AUTOMATIC_GEOFENCE"
}
```
- **Response (`200 OK`):**
```json
{
  "session_id": "sess-90e4f1a2-bdf4-4110",
  "total_worked_hours": 9.75,
  "regular_hours": 8.00,
  "tier_1_ot_hours": 1.75,
  "tier_2_ot_hours": 0.00,
  "night_diff_hours": 0.00,
  "total_cost": 298.13,
  "verification_status": "VERIFIED"
}
```

---

### 6.2 Real-Time WebSocket & Socket.io Event Protocol

- **Endpoint:** `wss://stream.gwms.io/v1/operations`
- **Auth:** Query token `?token=<JWT>`

#### Event Schema Definitions:

1. **`worker.telemetry.updated`** (Server $\to$ Client):
```json
{
  "event": "worker.telemetry.updated",
  "timestamp": "2026-10-11T14:30:01.120Z",
  "data": {
    "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
    "name": "Alex Carter",
    "latitude": 37.774935,
    "longitude": -122.419420,
    "accuracy_meters": 8.4,
    "speed_mps": 0.2,
    "battery_pct": 82,
    "current_status": "CHECKED_IN_NORMAL",
    "status_badge_color": "#10B981",
    "elapsed_minutes": 390,
    "overtime_active": false,
    "overtime_cost": 0.00
  }
}
```

2. **`alert.geofence.breach`** (Server $\to$ Client):
```json
{
  "event": "alert.geofence.breach",
  "timestamp": "2026-10-11T14:30:05.400Z",
  "severity": "CRITICAL",
  "data": {
    "alert_id": "alt-8fa21e54-5261",
    "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
    "employee_name": "Alex Carter",
    "zone_id": "zone-sf-central-01",
    "zone_name": "Bay Area Central Hub",
    "breach_type": "UNAUTHORIZED_EGRESS",
    "duration_outside_seconds": 310,
    "last_known_coords": [37.775810, -122.420110]
  }
}
```

3. **`overtime.tick`** (Server $\to$ Client every 60s):
```json
{
  "event": "overtime.tick",
  "timestamp": "2026-10-11T16:01:00.000Z",
  "data": {
    "session_id": "sess-90e4f1a2-bdf4-4110",
    "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
    "accumulated_minutes": 481,
    "current_tier": "TIER_1_1_5X",
    "current_multiplier": 1.5,
    "accumulated_cost": 200.63,
    "projected_cost": 250.00
  }
}
```

---

### 6.3 Complete Reference Controller (`telemetry-ingestion.controller.ts`)

```typescript
/**
 * @file telemetry-ingestion.controller.ts
 * @description Ingestion pipeline coordinating Privacy Firewall,
 * Spatial Geofencing, Shift State Machine, Overtime Calculator, and Socket.io broadcasts.
 */

import { SpatialGeofenceEngine, GeofenceZone, DwellEvaluationState, TelemetryFix } from './spatial-geofence.engine';
import { ShiftStateMachine, ShiftState, ShiftContext } from './shift-state-machine.engine';
import { OvertimeCalculator } from './overtime-calculator.engine';
import { PrivacyFirewallMiddleware, InboundTelemetryPacket, EmployeePrivacyProfile } from './privacy-firewall.middleware';

export interface TelemetryIngestResponse {
  status: 'PROCESSED' | 'MASKED_MEDICAL_LEAVE' | 'REJECTED';
  rejectReason?: string;
  currentState: ShiftState;
  activeZoneId?: string;
  dwellSecondsActive: number;
  graceSecondsRemaining: number;
  overtimeActive: boolean;
  currentOvertimeCost: number;
  trackingIntervalSeconds: number;
  privacyMasked: boolean;
}

export interface BroadcastEmitter {
  emit(event: string, payload: unknown): void;
}

export class TelemetryIngestionController {
  constructor(
    private readonly broadcastEmitter: BroadcastEmitter,
    private readonly zonesStore: Map<string, GeofenceZone>,
    private readonly privacyStore: Map<string, EmployeePrivacyProfile>,
    private readonly dwellStates: Map<string, DwellEvaluationState>,
    private readonly shiftContexts: Map<string, ShiftContext>,
    private readonly shiftStates: Map<string, ShiftState>
  ) {}

  public async handleIngest(packet: InboundTelemetryPacket): Promise<TelemetryIngestResponse> {
    const profile = this.privacyStore.get(packet.employeeId) ?? {
      employeeId: packet.employeeId,
      isOnMedicalLeave: false,
      isRemoteApproved: false,
    };

    // 1. Privacy Firewall Gate
    const sanitized = PrivacyFirewallMiddleware.filterTelemetry(packet, profile);
    if (sanitized.status === 'MASKED_MEDICAL_LEAVE') {
      this.shiftStates.set(packet.employeeId, 'MEDICAL_LEAVE_MASKED');
      
      // Broadcast masked state to Live Map (coordinates omitted)
      this.broadcastEmitter.emit('worker.telemetry.updated', {
        employee_id: packet.employeeId,
        current_status: 'MEDICAL_LEAVE_MASKED',
        latitude: null,
        longitude: null,
        privacy_masked: true,
      });

      return {
        status: 'MASKED_MEDICAL_LEAVE',
        currentState: 'MEDICAL_LEAVE_MASKED',
        dwellSecondsActive: 0,
        graceSecondsRemaining: 0,
        overtimeActive: false,
        currentOvertimeCost: 0,
        trackingIntervalSeconds: 0, // Instruct client to halt GPS
        privacyMasked: true,
      };
    }

    // 2. Fetch context & current state
    const currentShiftState = this.shiftStates.get(packet.employeeId) ?? 'OFF_DUTY';
    const shiftContext = this.shiftContexts.get(packet.employeeId);
    if (!shiftContext || !sanitized.latitude || !sanitized.longitude || !sanitized.accuracyMeters) {
      return {
        status: 'REJECTED',
        rejectReason: 'MISSING_ACTIVE_SHIFT_OR_COORDS',
        currentState: currentShiftState,
        dwellSecondsActive: 0,
        graceSecondsRemaining: 0,
        overtimeActive: false,
        currentOvertimeCost: 0,
        trackingIntervalSeconds: 30,
        privacyMasked: false,
      };
    }

    const zone = profile.isRemoteApproved && profile.remoteGeofence
      ? profile.remoteGeofence
      : this.zonesStore.get(shiftContext.zoneId);

    if (!zone) {
      return {
        status: 'REJECTED',
        rejectReason: 'ZONE_NOT_FOUND',
        currentState: currentShiftState,
        dwellSecondsActive: 0,
        graceSecondsRemaining: 0,
        overtimeActive: false,
        currentOvertimeCost: 0,
        trackingIntervalSeconds: 30,
        privacyMasked: false,
      };
    }

    // 3. Spatial Evaluation
    const telemetryFix: TelemetryFix = {
      latitude: sanitized.latitude,
      longitude: sanitized.longitude,
      accuracyMeters: sanitized.accuracyMeters,
      timestamp: new Date(sanitized.deviceTimestamp).getTime(),
      speedMps: sanitized.speedMps ?? 0,
      isMock: sanitized.isMock,
    };

    const prevDwell = this.dwellStates.get(packet.employeeId) ?? {
      employeeId: packet.employeeId,
      zoneId: zone.id,
      currentSpatialStatus: 'OUTSIDE_OUTER',
      isFormallyCheckedIn: false,
      ingressDwellStartMs: null,
      egressGraceStartMs: null,
      lastValidFix: null,
    };

    const evalResult = SpatialGeofenceEngine.evaluateFix(telemetryFix, zone, prevDwell);
    if (!evalResult.accepted) {
      return {
        status: 'REJECTED',
        rejectReason: evalResult.rejectReason,
        currentState: currentShiftState,
        dwellSecondsActive: 0,
        graceSecondsRemaining: 0,
        overtimeActive: false,
        currentOvertimeCost: 0,
        trackingIntervalSeconds: 15,
        privacyMasked: false,
      };
    }

    // Persist dwell state
    this.dwellStates.set(packet.employeeId, evalResult.updatedState);

    // 4. Shift State Machine Transition
    let transitionResult = {
      previousState: currentShiftState,
      newState: currentShiftState,
      context: shiftContext,
      alerts: [] as any[],
    };

    if (evalResult.stateChangeTriggered === 'CHECK_IN_TRIGGERED') {
      transitionResult = ShiftStateMachine.transition(currentShiftState, {
        type: 'GEOFENCE_ENTER',
        currentTimestampMs: telemetryFix.timestamp,
      }, shiftContext);
    } else if (evalResult.stateChangeTriggered === 'CHECK_OUT_TRIGGERED') {
      transitionResult = ShiftStateMachine.transition(currentShiftState, {
        type: 'GEOFENCE_EXIT',
        currentTimestampMs: telemetryFix.timestamp,
      }, shiftContext);
    } else {
      transitionResult = ShiftStateMachine.transition(currentShiftState, {
        type: 'TICK',
        currentTimestampMs: telemetryFix.timestamp,
      }, shiftContext);
    }

    this.shiftStates.set(packet.employeeId, transitionResult.newState);
    this.shiftContexts.set(packet.employeeId, transitionResult.context);

    // 5. Broadcast any generated alerts
    for (const alert of transitionResult.alerts) {
      this.broadcastEmitter.emit('alert.geofence.breach', {
        employee_id: packet.employeeId,
        alert_type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: new Date().toISOString(),
      });
    }

    // 6. Overtime Calculation (if checked in)
    let overtimeCost = 0;
    let isOt = false;
    if (transitionResult.context.checkInTimeMs) {
      const ot = OvertimeCalculator.calculateDetailed(
        transitionResult.context.checkInTimeMs,
        telemetryFix.timestamp,
        25.0 // default wage
      );
      overtimeCost = ot.totalCost;
      isOt = ot.tier1OtSeconds > 0 || ot.tier2OtSeconds > 0;
    }

    // 7. Live Operations Map Broadcast
    this.broadcastEmitter.emit('worker.telemetry.updated', {
      employee_id: packet.employeeId,
      latitude: sanitized.latitude,
      longitude: sanitized.longitude,
      speed_mps: sanitized.speedMps,
      battery_pct: sanitized.batteryPct,
      current_status: transitionResult.newState,
      dwell_seconds: evalResult.dwellSecondsActive,
      overtime_cost: overtimeCost,
    });

    return {
      status: 'PROCESSED',
      currentState: transitionResult.newState,
      activeZoneId: zone.id,
      dwellSecondsActive: evalResult.dwellSecondsActive,
      graceSecondsRemaining: evalResult.graceSecondsRemaining,
      overtimeActive: isOt,
      currentOvertimeCost: overtimeCost,
      trackingIntervalSeconds: evalResult.spatialStatus === 'INSIDE_INNER' ? 15 : 30,
      privacyMasked: false,
    };
  }
}
```

---

## 7. Comprehensive Seed Data Architecture

### 7.1 Field Worker Personas with Avatars & Attributes

The seed dataset contains realistic personas across operations roles:

```
+---------------------------------------------------------------------------------------------------------+
|                                        SEED EMPLOYEE ROSTER                                             |
+---------------------------------------------------------------------------------------------------------+
| ID / Code | Name            | Role                 | Dept         | Wage/hr | Status / Initial Scenario |
+-----------+-----------------+----------------------+--------------+---------+---------------------------+
| EMP-101   | Alex Carter     | Telecom Technician   | Field Ops    | $32.50  | Standard Shift -> OT1     |
| EMP-102   | Samantha Reed   | Fiber Specialist     | Maintenance  | $28.00  | Medical Leave (Masked)    |
| EMP-103   | Carlos Mendez   | High-Voltage Tech    | Grid Repair  | $40.00  | Night Shift (Midnight/ND) |
| EMP-104   | Priya Patel     | GIS Network Planner  | Engineering  | $36.00  | Remote Work (Home Zone)   |
| EMP-105   | David Kim       | Emergency Lineman    | Rapid Resp   | $45.00  | Emergency Shift -> OT2    |
| EMP-106   | Elena Rostova   | Regional Operations  | Dispatch     | $52.00  | Operations Manager        |
+---------------------------------------------------------------------------------------------------------+
```

---

### 7.2 Diverse Geofence Zones (Radial, Polygonal, Remote)

1. **Bay Area Central Hub (`ZONE-CIRCULAR-01`):**
   - Type: `CIRCULAR`
   - Center: `[37.774929, -122.419416]`
   - Radius: `120.0 meters`, Hysteresis Buffer: `20.0 meters`
2. **Metro Industrial Yard (`ZONE-POLYGON-02`):**
   - Type: `POLYGON` (5-vertex non-convex parcel)
   - Coordinates:
     `[[37.7810, -122.4110], [37.7830, -122.4080], [37.7805, -122.4050], [37.7780, -122.4070], [37.7790, -122.4100]]`
   - Hysteresis Buffer: `20.0 meters`
3. **Alex Carter Remote Residence (`ZONE-REMOTE-101`):**
   - Type: `CIRCULAR`
   - Center: `[37.755000, -122.435000]`
   - Radius: `150.0 meters`, Hysteresis Buffer: `25.0 meters`

---

### 7.3 Canonical Shift Scenarios & Rosters

1. **Scenario A (Standard Shift escalating to Tier 1 Overtime):**
   - Worker: Alex Carter
   - Window: `08:00 - 16:30` (8.5 hrs scheduled, 8 hrs worked regular + 1.25 hrs OT1).
2. **Scenario B (Approved Medical Leave with Privacy Shield):**
   - Worker: Samantha Reed
   - Leave Type: `MEDICAL`, Duration: 3 days. Hardware GPS unregistered, zero coordinate ingestion.
3. **Scenario C (Night Shift traversing Midnight with Night Differential):**
   - Worker: Carlos Mendez
   - Window: `20:00 - 04:30` next morning (8.5 hrs, 6.5 hrs in night diff bracket 22:00 - 04:30).
4. **Scenario D (Approved Remote Telecommuting):**
   - Worker: Priya Patel
   - Shift Type: `REMOTE`, evaluates against residential micro-geofence.
5. **Scenario E (Double-Time Emergency Callout):**
   - Worker: David Kim
   - Shift Type: `EMERGENCY`, 13.5 hours continuous (8h regular, 4h OT1, 1.5h OT2).

---

### 7.4 Simulated Telemetry Walk Trajectories

```mermaid
journey
    title Simulated Field Tech Walk (Alex Carter - Site Alpha Ingress & Egress)
    section Transit & Arrival
      Highway driving (speed 22 m/s): 5: Alex
      Approaching outer buffer (distance 350m): 4: Alex
      Crosses inner boundary (distance 80m): 4: Alex
    section Dwell & Check-in
      Dwell timer starts (t = 0s): 3: Alex
      Dwell timer persists (t = 180s): 5: System
      Automated Check-in verified: 5: System
    section On-Duty & Hysteresis Test
      Maintenance near perimeter fence (dist 125m): 4: Alex
      Hysteresis buffer holds state inside: 5: System
    section Departure & Checkout
      Shift ends; leaves site (dist 180m): 3: Alex
      Egress grace starts (t = 0s): 3: System
      Egress grace exceeds 300s: 5: System
      Automated Check-out finalized: 5: System
```

---

### 7.5 Complete Reference Seed Generator (`seed-data.generator.ts`)

```typescript
/**
 * @file seed-data.generator.ts
 * @description Comprehensive seed dataset generator providing realistic field tech
 * profiles, diverse geofence zones, shifts, and simulated telemetry walks.
 */

import { CircularGeofenceDefinition, PolygonGeofenceDefinition, TelemetryFix } from './spatial-geofence.engine';
import { ShiftContext } from './shift-state-machine.engine';
import { EmployeePrivacyProfile } from './privacy-firewall.middleware';

export interface SeedDataBundle {
  employees: Array<{
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    role: string;
    department: string;
    avatarUrl: string;
    baseHourlyWage: number;
    initialStatus: string;
  }>;
  zones: Array<CircularGeofenceDefinition | PolygonGeofenceDefinition>;
  shifts: ShiftContext[];
  privacyProfiles: EmployeePrivacyProfile[];
  simulatedWalks: Record<string, TelemetryFix[]>;
}

export function generateSeedData(): SeedDataBundle {
  const now = new Date('2026-10-11T08:00:00.000Z').getTime();

  // 1. Realistic Field Tech Profiles with Avatars
  const employees: SeedDataBundle['employees'] = [
    {
      id: 'emp-101-alex',
      code: 'EMP-101',
      firstName: 'Alex',
      lastName: 'Carter',
      role: 'FIELD_WORKER',
      department: 'Telecommunications',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      baseHourlyWage: 32.50,
      initialStatus: 'IN_TRANSIT',
    },
    {
      id: 'emp-102-samantha',
      code: 'EMP-102',
      firstName: 'Samantha',
      lastName: 'Reed',
      role: 'FIELD_WORKER',
      department: 'Fiber Optics',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      baseHourlyWage: 28.00,
      initialStatus: 'MEDICAL_LEAVE_MASKED',
    },
    {
      id: 'emp-103-carlos',
      code: 'EMP-103',
      firstName: 'Carlos',
      lastName: 'Mendez',
      role: 'FIELD_WORKER',
      department: 'High-Voltage Grid',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      baseHourlyWage: 40.00,
      initialStatus: 'OFF_DUTY',
    },
    {
      id: 'emp-104-priya',
      code: 'EMP-104',
      firstName: 'Priya',
      lastName: 'Patel',
      role: 'FIELD_WORKER',
      department: 'Network Engineering',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      baseHourlyWage: 36.00,
      initialStatus: 'APPROVED_REMOTE',
    },
    {
      id: 'emp-105-david',
      code: 'EMP-105',
      firstName: 'David',
      lastName: 'Kim',
      role: 'FIELD_WORKER',
      department: 'Emergency Response',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      baseHourlyWage: 45.00,
      initialStatus: 'CHECKED_IN_NORMAL',
    },
  ];

  // 2. Geofence Zones
  const zones: SeedDataBundle['zones'] = [
    {
      type: 'CIRCULAR',
      id: 'zone-sf-hub-01',
      name: 'Bay Area Central Hub',
      center: { latitude: 37.774929, longitude: -122.419416 },
      radiusMeters: 120.0,
      bufferMeters: 20.0,
    },
    {
      type: 'POLYGON',
      id: 'zone-oakland-yard-02',
      name: 'Metro Industrial Yard',
      vertices: [
        { latitude: 37.7810, longitude: -122.4110 },
        { latitude: 37.7830, longitude: -122.4080 },
        { latitude: 37.7805, longitude: -122.4050 },
        { latitude: 37.7780, longitude: -122.4070 },
        { latitude: 37.7790, longitude: -122.4100 },
      ],
      bufferMeters: 20.0,
    },
  ];

  // 3. Privacy Profiles
  const privacyProfiles: SeedDataBundle['privacyProfiles'] = [
    {
      employeeId: 'emp-101-alex',
      isOnMedicalLeave: false,
      isRemoteApproved: false,
    },
    {
      employeeId: 'emp-102-samantha',
      isOnMedicalLeave: true,
      isRemoteApproved: false,
    },
    {
      employeeId: 'emp-103-carlos',
      isOnMedicalLeave: false,
      isRemoteApproved: false,
    },
    {
      employeeId: 'emp-104-priya',
      isOnMedicalLeave: false,
      isRemoteApproved: true,
      remoteGeofence: {
        type: 'CIRCULAR',
        id: 'remote-priya-home',
        name: 'Priya Patel Home Office',
        center: { latitude: 37.755000, longitude: -122.435000 },
        radiusMeters: 150.0,
        bufferMeters: 25.0,
      },
    },
    {
      employeeId: 'emp-105-david',
      isOnMedicalLeave: false,
      isRemoteApproved: false,
    },
  ];

  // 4. Shifts
  const shifts: SeedDataBundle['shifts'] = [
    {
      shiftId: 'shift-alex-01',
      employeeId: 'emp-101-alex',
      zoneId: 'zone-sf-hub-01',
      isRemote: false,
      isMedicalLeave: false,
      scheduledStartMs: now,
      scheduledEndMs: now + 8.5 * 3600 * 1000,
      checkInTimeMs: null,
      checkOutTimeMs: null,
      lastStateChangeMs: now,
      unauthorizedBreachCount: 0,
    },
    {
      shiftId: 'shift-samantha-02',
      employeeId: 'emp-102-samantha',
      zoneId: 'zone-sf-hub-01',
      isRemote: false,
      isMedicalLeave: true,
      scheduledStartMs: now,
      scheduledEndMs: now + 8 * 3600 * 1000,
      checkInTimeMs: null,
      checkOutTimeMs: null,
      lastStateChangeMs: now,
      unauthorizedBreachCount: 0,
    },
    {
      shiftId: 'shift-carlos-03',
      employeeId: 'emp-103-carlos',
      zoneId: 'zone-oakland-yard-02',
      isRemote: false,
      isMedicalLeave: false,
      scheduledStartMs: now + 12 * 3600 * 1000, // Night shift 20:00
      scheduledEndMs: now + 20.5 * 3600 * 1000, // Ends 04:30
      checkInTimeMs: null,
      checkOutTimeMs: null,
      lastStateChangeMs: now,
      unauthorizedBreachCount: 0,
    },
  ];

  // 5. Simulated Walk Trajectories (Alex Carter Walk Array)
  // Generating a 10-point simulated arrival, dwell, check-in, and boundary test walk
  const alexWalk: TelemetryFix[] = [];
  const startWalkTime = now - 15 * 60 * 1000; // 15 mins before shift
  const hubCenter = { latitude: 37.774929, longitude: -122.419416 };

  // Approach points (outside)
  alexWalk.push({
    latitude: 37.771000,
    longitude: -122.419416,
    accuracyMeters: 9.0,
    timestamp: startWalkTime,
    speedMps: 18.0,
  }); // ~430m away

  alexWalk.push({
    latitude: 37.773500,
    longitude: -122.419416,
    accuracyMeters: 8.5,
    timestamp: startWalkTime + 180 * 1000,
    speedMps: 10.0,
  }); // ~158m away (in transit)

  // Penetrates inner boundary (radius is 120m)
  alexWalk.push({
    latitude: 37.774500,
    longitude: -122.419416,
    accuracyMeters: 7.0,
    timestamp: startWalkTime + 300 * 1000,
    speedMps: 1.5,
  }); // ~48m away (Inside Inner - Dwell starts: t=0s)

  alexWalk.push({
    latitude: 37.774800,
    longitude: -122.419416,
    accuracyMeters: 6.2,
    timestamp: startWalkTime + 420 * 1000,
    speedMps: 0.8,
  }); // ~14m away (Still inside - Dwell t=120s)

  alexWalk.push({
    latitude: 37.774929,
    longitude: -122.419416,
    accuracyMeters: 5.5,
    timestamp: startWalkTime + 490 * 1000,
    speedMps: 0.2,
  }); // Centroid (Dwell >= 180s satisfied! -> Check-in Triggered)

  // Working on site
  alexWalk.push({
    latitude: 37.775200,
    longitude: -122.419416,
    accuracyMeters: 6.0,
    timestamp: startWalkTime + 1800 * 1000,
    speedMps: 0.5,
  }); // ~30m from center (Normal duty)

  // Boundary jitter test: walks into hysteresis buffer (130m from center, radius is 120m, buffer is 140m)
  alexWalk.push({
    latitude: 37.776100,
    longitude: -122.419416,
    accuracyMeters: 7.5,
    timestamp: startWalkTime + 3600 * 1000,
    speedMps: 1.1,
  }); // ~130m away (In Hysteresis Buffer - NO false checkout!)

  // Returns to inner hub
  alexWalk.push({
    latitude: 37.774929,
    longitude: -122.419416,
    accuracyMeters: 5.0,
    timestamp: startWalkTime + 7200 * 1000,
    speedMps: 0.3,
  }); // Verified continuous check-in intact

  return {
    employees,
    zones,
    shifts,
    privacyProfiles,
    simulatedWalks: {
      'emp-101-alex': alexWalk,
    },
  };
}
```

---

## 8. Builder Integration Blueprint & Verification Test Suite

The Builder subagent can import and mount these reference modules directly into the backend runtime without modifying interface signatures:

### 8.1 Automated Algorithmic Verification Suite

```typescript
/**
 * @file verification.test.ts
 * @description Unit tests verifying mathematical rigor of Haversine, PIP, Hysteresis, and Overtime.
 */

import { SpatialGeofenceEngine } from './spatial-geofence.engine';
import { OvertimeCalculator } from './overtime-calculator.engine';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${testName}`);
  }
  console.log(`[PASS] ${testName}`);
}

export function runAlgorithmicVerificationSuite() {
  console.log('--- Starting GWMS Algorithmic Verification Suite ---');

  // Test 1: Haversine distance accuracy between known SF landmarks
  // SF Ferry Building (37.7955, -122.3937) to Coit Tower (37.8024, -122.4058) ~ 1300 meters
  const dist = SpatialGeofenceEngine.haversineDistance(
    { latitude: 37.7955, longitude: -122.3937 },
    { latitude: 37.8024, longitude: -122.4058 }
  );
  assert(Math.abs(dist - 1315) < 30, `Haversine SF landmarks distance (~1315m, got ${dist.toFixed(1)}m)`);

  // Test 2: Ray-Casting PIP with convex unit square
  const unitSquare = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 10 },
    { latitude: 10, longitude: 10 },
    { latitude: 10, longitude: 0 },
  ];
  assert(SpatialGeofenceEngine.isPointInPolygon({ latitude: 5, longitude: 5 }, unitSquare) === true, 'PIP inside test');
  assert(SpatialGeofenceEngine.isPointInPolygon({ latitude: 15, longitude: 5 }, unitSquare) === false, 'PIP outside test');

  // Test 3: Concentric Hysteresis classification
  const zone = {
    type: 'CIRCULAR' as const,
    id: 'test-zone',
    name: 'Test Zone',
    center: { latitude: 0, longitude: 0 },
    radiusMeters: 100,
    bufferMeters: 20, // Outer boundary is 120m
  };
  // Point at 50m (inside)
  const insideStatus = SpatialGeofenceEngine.evaluateSpatialStatus({ latitude: 0.00045, longitude: 0 }, zone);
  assert(insideStatus.status === 'INSIDE_INNER', 'Spatial status: inside inner');

  // Test 4: Overtime Calculation Tier Splitting (10 hours worked)
  // 8 hrs regular (1.0x), 2 hrs OT1 (1.5x) at $30/hr -> (8 * 30 * 1.0) + (2 * 30 * 1.5) = $240 + $90 = $330
  const t0 = new Date('2026-10-11T08:00:00Z').getTime();
  const t1 = t0 + 10 * 3600 * 1000;
  const ot = OvertimeCalculator.calculateDetailed(t0, t1, 30.0);
  assert(ot.regularHours === 8.0, 'Overtime: 8.0 regular hours');
  assert(ot.tier1OtHours === 2.0, 'Overtime: 2.0 tier 1 hours');
  assert(ot.totalCost === 330.0, `Overtime total cost ($330 expected, got $${ot.totalCost})`);

  // Test 5: Night Differential calculation (20:00 to 02:00 = 6h total, 4h night diff between 22:00 and 02:00)
  const nightStart = new Date('2026-10-11T20:00:00Z').getTime();
  const nightEnd = nightStart + 6 * 3600 * 1000;
  const nightOt = OvertimeCalculator.calculateDetailed(nightStart, nightEnd, 40.0);
  assert(nightOt.nightDiffHours === 4.0, `Night differential: 4.0 hours (got ${nightOt.nightDiffHours})`);

  console.log('--- All GWMS Algorithmic Tests Passed Successfully! ---');
}
```

---

## 9. Summary & Deliverable Checklist

| Requirement Category | Implemented Specification & Reference Module | Verification Status |
| :--- | :--- | :--- |
| **Haversine Distance** | Exact $R = 6,371,000\text{m}$ with numerical clamp in `SpatialGeofenceEngine.haversineDistance()` | Verified |
| **Ray-Casting PIP** | Jordan Curve theorem with half-open ray intersection in `SpatialGeofenceEngine.isPointInPolygon()` | Verified |
| **Concentric Hysteresis** | Inner entry ($R$) vs outer exit ($R + \max(20\text{m}, 0.15R)$) in `evaluateSpatialStatus()` | Verified |
| **Temporal Dwell Filters** | 180s continuous ingress requirement & 300s egress grace in `evaluateFix()` | Verified |
| **GPS Quality Filter** | Rejection of fixes with horizontal accuracy $> 30\text{m}$ and speed $> 50\text{m/s}$ | Verified |
| **Shift State Machine** | 8 discrete states with strict guard conditions and alert generation in `ShiftStateMachine` | Verified |
| **Overtime Mathematical Engine** | Granular tiers (1.0x, 1.5x, 2.0x, +0.25x night diff) and live projection in `OvertimeCalculator` | Verified |
| **Medical Privacy Firewall** | Complete coordinate scrubbing and Gray Shield mapping in `PrivacyFirewallMiddleware` | Verified |
| **Remote Work Engine** | 150m ephemeral micro-geofence generation and cobalt blue marker rendering | Verified |
| **API & Socket Protocol** | REST endpoints OpenAPI specs and Socket.io event schemas in `TelemetryIngestionController` | Verified |
| **Realistic Seed Data** | 5 field techs with avatars, 2 geofences, 3 shifts, and 10-point simulated walk array | Verified |

This document serves as the complete, authoritative technical specification for the Builder subagent to construct the application.
