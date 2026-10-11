# Geofenced Workforce Monitoring System
## Comprehensive Architectural Blueprint & Functional Specification
**Document Version:** 1.0.0  
**Classification:** Mission-Critical Enterprise Architecture  
**Author:** Lead Systems Architect & Requirements Planner  
**Target Environment:** Distributed Mobile Edge & Real-Time Cloud Operations Command  

---

## 1. Executive Summary & Core Objectives

### 1.1 Executive Summary
The **Geofenced Workforce Monitoring System (GWMS)** is an enterprise-grade, high-availability platform engineered to govern field worker operations, attendance verification, shift lifecycle transitions, and continuous overtime accounting across geographically distributed work sites. 

Modern field operations (telecommunications tower maintenance, industrial construction, utility grid repair, logistics, and emergency dispatch) face persistent challenges including buddy-punching, unverified attendance, disputed overtime payroll, GPS boundary bouncing, dead-zone data loss, and worker privacy compliance violations. GWMS resolves these vulnerabilities through zero-touch automated geofencing, temporal-spatial hysteresis de-bouncing, strict medical privacy masking firewalls, and sub-second operations map dispatching.

### 1.2 Core System Objectives

```
+---------------------------------------------------------------------------------------+
|                                CORE SYSTEM OBJECTIVES                                 |
+---------------------------------------------------------------------------------------+
|  1. Zero-Touch Precision Attendance     |  4. Strict Privacy Compliance Engine         |
|     Sub-meter geofenced entry/exit          Hardware-level GPS shutoff on medical     |
|     detection without manual clock-in.      leave; zero coordinates stored or leaked.  |
|                                         |                                             |
|  2. Anti-Bounce Hysteresis Filter       |  5. Real-Time Operations Command Map        |
|     Dwell-time counters & buffer zones      Sub-second WebSocket live tracking with    |
|     eliminating GPS multipath drift.        photo pins, breadcrumbs, & breach alerts. |
|                                         |                                             |
|  3. Continuous Overtime Accounting      |  6. Offline-First Resilient Edge PWA/App    |
|     Real-time tier multi-rates (1.5x/       Local SQLite/IndexedDB store-and-forward  |
|     2.0x/night diff) synchronized live.     with cryptographic monotonic sequence IDs.|
+---------------------------------------------------------------------------------------+
```

1. **Automated Zero-Touch Geofence Verification:** Trigger clock-ins and clock-outs autonomously when authenticated workers traverse designated virtual boundaries, removing manual paper logs and mobile button taps.
2. **Boundary-Bounce & Multipath Mitigation:** Implement dual-concentric geofence rings and temporal dwell-time algorithms to prevent false check-ins/check-outs caused by GPS jitter, indoor reflection, or peripheral transit.
3. **Continuous Real-Time Overtime Computation:** Compute labor liability in real time using dynamic multi-tier rate multipliers (Standard 1.0x, Tier 1 1.5x, Tier 2 2.0x, and Night Differential 1.25x), enabling dispatchers to mitigate payroll overruns before they occur.
4. **Guaranteed Privacy Enforcement & Leave Governance:** Provide an uncompromised privacy firewall that ceases and purges telemetry collection when an employee is on Medical Leave or off-shift, satisfying strict GDPR, CCPA, and labor regulatory frameworks. Simultaneously enable dynamic satellite micro-geofences for Approved Remote Telecommuting.
5. **Ultra-Low Latency Operations Command Post:** Render hundreds of concurrent field workers across multi-polygon job sites on an interactive vector map with visual status indicator rings, photo pins, breadcrumb histories, and immediate push incident alerts.
6. **Fault-Tolerant Offline Edge Synchronization:** Ensure field workers in cellular dead zones or subterranean facilities maintain uninterrupted shift verification through tamper-evident edge buffering, monotonic sequence checks, and idempotent replay pipelines.

---

## 2. User Personas & Journey Maps

### 2.1 Persona Matrix

| Attribute | Persona 1: Mobile Field Worker | Persona 2: Operations Dispatcher | Persona 3: HR & Payroll Administrator |
| :--- | :--- | :--- | :--- |
| **Representative** | **Alex Carter** (Field Telecom Tech) | **Elena Rostova** (Regional Operations Mgr) | **Marcus Vance** (Workforce Compliance Director) |
| **Primary Device** | Rugged Android 14 Smartphone / iOS PWA | Triple-monitor Desktop Workstation (Chrome) | Laptop / Enterprise Web Portal (Edge / Safari) |
| **Connectivity** | 4G/5G, intermittent 3G, frequent dead zones | Dedicated Gigabit Fiber LAN | High-speed Corporate Network |
| **Core Responsibilities**| On-site equipment repair, safety checks, travel | Real-time fleet tracking, geofence setup, alerts | Timesheet verification, overtime audit, leave governance |
| **Primary Pain Points** | Battery drain, false breach alarms, privacy concerns | Blind spots, delayed breach alerts, disputed hours | Unverified overtime costs, manual leave audits, compliance risks |

---

### 2.2 Deep Persona Profiles & Journey Workflows

#### 2.2.1 Persona 1: Alex Carter — Mobile Field Worker
* **Context:** Operates across 4 to 6 remote cell tower sites daily. Often works alone in hazardous conditions with poor cellular reception.
* **Pre-Shift Phase:**
  1. Opens GWMS Mobile App. App displays scheduled shift: `08:00 - 16:30` at `Site Alpha (Tower #402)`.
  2. Map indicates Site Alpha’s boundary (Green polygon) and current worker distance (12.4 km).
  3. Status indicator displays: `STATUS: OFF_DUTY | TELEMETRY: STANDBY (GPS throttled)`.
* **In-Transit & Arrival Phase:**
  1. Enters vehicle; app detects motion (`speed > 25 km/h`) and shifts GPS sampling to dynamic transit rate (every 30s).
  2. Arrives at Site Alpha perimeter. Crosses outer Warning Buffer (500m). App notifies: *"Approaching Site Alpha work zone"*.
  3. Enters inner Geofence boundary (100m). Internal dwell timer begins (`t = 00:00`).
  4. Worker dwells within perimeter for 180 seconds. Dwell condition satisfied.
  5. System fires `AUTOMATED_CHECK_IN`. App sounds haptic chime. Screen shifts to `ACTIVE SHIFT`.
* **On-Duty & Overtime Phase:**
  1. Active Shift timer counts up (`04:12:15 remaining`). 
  2. Work extends past scheduled 8 hours due to cable fault.
  3. Shift timer reaches 8 hours. System automatically switches to `OVERTIME TIER 1 (1.5x)`. Overtime counter glows amber and begins counting up in real-time.
* **Departure & Post-Shift Phase:**
  1. Worker packs gear and drives away. Exits inner boundary. Egress timer begins (`t = 00:00`).
  2. Worker remains outside boundary for 300 seconds. Dwell condition satisfied.
  3. System triggers `AUTOMATED_CHECK_OUT`. Total regular hours: 8.00 hrs. Overtime: 1.45 hrs.
  4. Worker is transitioned to `OFF_DUTY`. GPS tracking immediately switches off. Privacy badge displays: `LOCATION TRACKING OFF`.

---

#### 2.2.2 Persona 2: Elena Rostova — Operations Dispatcher & Manager
* **Context:** Manages 45 field technicians across 18 active infrastructure projects. Needs instantaneous situational awareness.
* **Daily Workflow:**
  1. **Morning Briefing & Geofence Provisioning:** Reviews daily shift rosters. Configures new temporary geofence polygon for a high-voltage substation project using the interactive polygon drawing tool.
  2. **Real-Time Operational Monitoring:** Live Map displays all workers with circular photo pins. Status rings show current state:
     - *Solid Green Ring:* Checked-in inside active geofence.
     - *Pulsing Amber Ring:* In Grace Period / Overtime active.
     - *Flashing Red Ring:* Unauthorized Boundary Breach or Unscheduled Absence.
     - *Solid Blue Ring:* Approved Remote Telecommuting zone.
     - *Gray Shield Ring:* Approved Medical Leave (Location Masked).
  3. **Incident & Alert Interception:** Alert sound triggers. Live alert drawer slides in: *"CRITICAL: Alex Carter exited Site Alpha 45 minutes prior to scheduled shift end."*
  4. Clicks alert -> Map immediately flies to Site Alpha with breadcrumb trail leading to vehicle path. Dispatches instant ping to worker.
  5. **Overtime Authorization:** Reviews live overtime threshold monitor. Receives alert when cumulative regional overtime exceeds daily budget threshold ($2,500). Approves or reassigns tasks to prevent Tier 2 double-time escalation.

---

#### 2.2.3 Persona 3: Marcus Vance — HR Administrator & Compliance Officer
* **Context:** Audits payroll records and ensures adherence to national labor standards (FLSA, Working Time Directive, HIPAA/GDPR health privacy).
* **Weekly Workflow:**
  1. **Medical Leave Validation:** Worker submits doctor certificate for 3-day sick leave. Marcus approves `LEAVE_TYPE: MEDICAL`.
  2. GWMS Ingestion Firewall automatically locks worker’s telemetry pipeline. Even if mobile app is running, no latitude/longitude packets are accepted, logged, or exposed. Marcus inspects audit log confirming `GPS_INGESTION_POLICY: STRICT_MASKED`.
  3. **Overtime Payroll Audit:** Pulls end-of-week timesheet summary. Compares automated geofence session logs against employee overtime claims.
  4. System highlights 0.1% discrepancy where a worker logged manual hours vs GPS verification. Marcus views audit log showing GPS accuracy score, arrival/departure timestamps, and dispatcher override records. Approves final payroll export with single click.

---

## 3. Geofencing & Shift Timing Rules Engine

```
                                  +---------------------------------------+
                                  |         WORKER IN TRANSIT             |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  | OUTER BUFFER RING (e.g., 500m)       |
                                  | Telemetry rate increases to 10s       |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  | INNER GEOFENCE BOUNDARY (Target Site) |
                                  | Ray-Casting / Haversine In-Bounds     |
                                  +---------------------------------------+
                                                      |
                                                      v
+------------------------+        +---------------------------------------+
| Dwell < Threshold      | <----- | DWELL TIMER INITIALIZED               |
| Resets if exits bounds |        | Dwell Threshold: 180 seconds          |
+------------------------+        +---------------------------------------+
                                                      |
                                                      | Dwell Time >= 180s
                                                      v
                                  +---------------------------------------+
                                  | STATE: CHECKED_IN                     |
                                  | Automated Check-In Session Generated  |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  | WORKER CROSSES OUTSIDE INNER BOUNDARY |
                                  | Egress Departure Timer Initialized    |
                                  +---------------------------------------+
                                     /                                 \
           Within Grace Period (< 10m)                                  Departure Sustained (> 300s)
          Worker returns into boundary                                  & Shift Finished
                                   /                                     \
                                  v                                       v
        +------------------------------------+                  +------------------------------------+
        | FALSE ALARM / TEMPORARY EGRESS     |                  | AUTOMATED CHECK-OUT TRIGGERED      |
        | State remains CHECKED_IN           |                  | Session Closed, Overtime Finalized |
        +------------------------------------+                  +------------------------------------+
```

### 3.1 Geofence Topologies & Computational Algorithms
GWMS supports two primary geofence topologies:
1. **Circular Radial Geofences:** Defined by `{ latitude, longitude, radius_meters }`.
   * **Distance Calculation:** High-performance Haversine formula with spherical earth radius $R = 6371000\text{ m}$:
     $$\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1$$
     $$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
     $$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right), \quad d = R \cdot c$$
   * In-bounds condition: $d \le \text{radius\_meters}$.
2. **Arbitrary Polygonal Geofences:** Defined by a closed planar GeoJSON array of coordinates: `[[lat_1, lng_1], [lat_2, lng_2], ..., [lat_n, lng_n]]`.
   * **Algorithm:** Even-Odd Ray Casting Algorithm (Point-in-Polygon).
   * For precision boundaries along physical site walls, security fences, or construction parcel boundaries.

---

### 3.2 Anti-Bounce Hysteresis & Signal De-Bouncing Specification
GPS multipath reflection from buildings, metal infrastructure, and tree cover causes coordinates to jitter by $\pm 15$ to $40$ meters. Without hysteresis, a worker standing near the fence would trigger dozens of check-in and check-out events per hour.

```
       [ Outside Site ]     [ Spatial Buffer (15%) ]     [ Inside Active Geofence ]
<--------------------------|-------------------------|---------------------------->
                           ^                         ^
                      Egress Edge               Entry Edge
                      (Out-of-bounds)           (In-bounds)
```

#### Dual-Threshold Parameters:
1. **Spatial Buffer Band (Hysteresis Margin):**
   * Entry boundary: Exact geofence perimeter ($R_{\text{entry}} = R$).
   * Exit boundary: Outer hysteresis margin set at $R_{\text{exit}} = R + \max(20\text{m}, 0.15 \cdot R)$.
   * A worker must physically clear the outer margin before an egress condition is recognized.
2. **Temporal Ingress Dwell Filter ($T_{\text{ingress\_dwell}}$):**
   * Parameter: `180 seconds` (configurable between 60s and 600s).
   * The GPS receiver must log consecutive valid fixes inside the boundary continuously for $T \ge T_{\text{ingress\_dwell}}$ with horizontal accuracy $\le 25\text{ meters}$.
3. **Temporal Egress Departure Filter ($T_{\text{egress\_dwell}}$):**
   * Parameter: `300 seconds` (5 minutes).
   * If a worker steps outside the perimeter, the state switches to `TEMPORARY_EGRESS_GRACE`. If they return within 300 seconds, the check-in session is maintained seamlessly without interruption.
4. **GPS Accuracy Floor:**
   * Any GPS telemetry fix where `accuracy_meters > 30.0` is discarded by the rules engine and classified as `ACCURACY_DEGRADED`. It cannot trigger a state change.

---

### 3.3 Shift Timing & Grace Period Rules

| Parameter | Default Value | Rule Description | System Action on Breach |
| :--- | :--- | :--- | :--- |
| **Shift Start Window** | 30 minutes prior | Worker can arrive up to 30 mins before shift start. | Pre-shift arrival logged; regular shift timer arms at scheduled time. |
| **Arrival Grace Period** | 15 minutes post | Worker may check in up to 15 mins after scheduled start. | `LATE_ARRIVAL` warning alert generated; session flagged for supervisor review. |
| **Early Departure Threshold**| 15 minutes prior | Worker leaves site before `scheduled_end - 15m`. | `UNAUTHORIZED_EARLY_DEPARTURE` critical alert to manager; timer stopped. |
| **Mid-Day Lunch/Egress Grace**| 45 minutes | Allowed temporary off-site lunch break if pre-configured. | Session paused in `AUTHORIZED_BREAK`; tracking switched to low-frequency. |
| **Post-Shift Departure Buffer**| 20 minutes | Allowed packing & egress window following shift completion.| Auto check-out triggered at `scheduled_end + 20m` unless OT approved. |

---

## 4. Overtime Computation Engine

### 4.1 Overtime Tier Architecture & Multipliers
The Overtime Computation Engine operates in dual execution modes:
1. **Continuous Real-Time Accrual (Tick Mode):** Every 60 seconds, active sessions with elapsed time beyond scheduled duration accrue fractional overtime balances, providing dispatchers with real-time labor expenditure metrics.
2. **Session Finalization (Reconciliation Mode):** Upon `AUTOMATED_CHECK_OUT` or manager sign-off, the engine splits hours across daily boundaries, rest days, and night differential brackets.

```
+-----------------------------------------------------------------------------------------+
|                              OVERTIME TIER HIERARCHY                                    |
+-----------------------------------------------------------------------------------------+
| [Base Standard Hours]    0.0 to 8.0 hrs worked per shift           -> Rate Multiplier: 1.0x |
| [Tier 1 Overtime (OT1)]  > 8.0 up to 12.0 hrs worked per day       -> Rate Multiplier: 1.5x |
| [Tier 2 Overtime (OT2)]  > 12.0 hrs worked per day OR Rest Day/Hol -> Rate Multiplier: 2.0x |
| [Night Differential]     Hours worked between 22:00 and 06:00      -> Premium Multiplier: +0.25x|
+-----------------------------------------------------------------------------------------+
```

### 4.2 Mathematical Formulas for Continuous Calculation

Let $t_{\text{in}}$ be the verified check-in timestamp and $t_{\text{curr}}$ be the current operational timestamp.  
Total elapsed working duration in seconds:
$$D_{\text{total}} = t_{\text{curr}} - t_{\text{in}} - D_{\text{unpaid\_breaks}}$$

Let $D_{\text{scheduled}}$ be the scheduled shift duration (e.g., $8\text{ hours} \times 3600\text{s} = 28800\text{s}$).

1. **Regular Duration ($D_{\text{reg}}$):**
   $$D_{\text{reg}} = \min(D_{\text{total}}, D_{\text{scheduled}})$$

2. **Tier 1 Overtime ($D_{\text{ot1}}$):**
   Let $D_{\text{cap1}} = 12\text{ hours} \times 3600\text{s} = 43200\text{s}$.
   $$D_{\text{ot1}} = \max\left(0, \min(D_{\text{total}}, D_{\text{cap1}}) - D_{\text{scheduled}}\right)$$

3. **Tier 2 Overtime ($D_{\text{ot2}}$):**
   $$D_{\text{ot2}} = \max\left(0, D_{\text{total}} - D_{\text{cap1}}\right)$$
   *(If current shift is scheduled on a designated statutory Rest Day or Public Holiday, $D_{\text{reg}} = 0$, $D_{\text{ot1}} = 0$, and $D_{\text{ot2}} = D_{\text{total}}$ from minute 0).*

4. **Night Differential Duration ($D_{\text{night}}$):**
   Let $\mathcal{N} = \bigcup_{k} [22:00_k, 06:00_{k+1}]$ be the night differential window.
   $$D_{\text{night}} = \int_{t_{\text{in}}}^{t_{\text{curr}}} \mathbf{1}_{\{t \in \mathcal{N}\}}(t) \, dt$$

5. **Continuous Financial Liability Calculation:**
   Given base hourly wage $W_{\text{base}}$:
   $$\text{Total Cost} = \left(\frac{D_{\text{reg}}}{3600} \times W_{\text{base}} \times 1.0\right) + \left(\frac{D_{\text{ot1}}}{3600} \times W_{\text{base}} \times 1.5\right) + \left(\frac{D_{\text{ot2}}}{3600} \times W_{\text{base}} \times 2.0\right) + \left(\frac{D_{\text{night}}}{3600} \times W_{\text{base}} \times 0.25\right)$$

---

### 4.3 Midnight Crossings & Multi-Day Shifts
When a shift traverses midnight (e.g., `20:00` Day 1 to `04:30` Day 2):
* The system utilizes **Absolute UTC Epoch Timestamps** for all continuous arithmetic, preventing daylight saving or date-change math errors.
* For daily overtime caps governed by local statutory jurisdictions that reset at `00:00`:
  * The session splits into sub-segments: Segment A (`20:00 - 23:59:59`) and Segment B (`00:00 - 04:30`).
  * If the employment contract mandates cumulative shift duration (standard in field dispatch), the continuous session model maintains continuity across the midnight barrier.

---

## 5. Remote Work & Medical Leave Subsystem (Privacy Firewalls)

The system provides specialized enforcement mechanisms for non-standard work arrangements, balancing operational verification with legal privacy guarantees.

```
                                  +------------------------------+
                                  | WORKER STATUS CLASSIFICATION |
                                  +------------------------------+
                                                 |
                       +-------------------------+-------------------------+
                       |                                                   |
                       v                                                   v
         +---------------------------+                       +---------------------------+
         | APPROVED REMOTE WORK      |                       | APPROVED MEDICAL LEAVE    |
         +---------------------------+                       +---------------------------+
         | Dynamic Telecommute Zone  |                       | Privacy Firewall Engaged  |
         | Lat/Lng verified inside   |                       | Zero GPS capture/storage  |
         | remote micro-geofence     |                       | Live Map: Masked Badge    |
         +---------------------------+                       +---------------------------+
                       |                                                   |
                       v                                                   v
         +---------------------------+                       +---------------------------+
         | Status: ACTIVE_REMOTE     |                       | Status: MEDICAL_LEAVE     |
         | Geofence verified (150m)  |                       | Ingestion Endpoint 204 No |
         | Normal timesheet accrual  |                       | Content; coordinates nulled|
         +---------------------------+                       +---------------------------+
```

### 5.1 Medical Leave Privacy Firewall
To comply with HIPAA (Health Insurance Portability and Accountability Act), GDPR Art. 9 (Processing of special categories of personal data), and worker protection statutes, tracking an employee during sick leave is illegal and exposes the enterprise to substantial liability.

#### Technical Enforcement Measures:
1. **Client-Side Hardware De-activation:**
   * Upon synchronization of an approved `MEDICAL_LEAVE` status, the mobile background service immediately unregisters from iOS `CoreLocation` / Android `FusedLocationProviderClient`.
   * The Mobile UI locks the tracking switch and renders a persistent badge: `PRIVACY SHIELD ACTIVE: Location tracking physically stopped for Medical Leave`.
2. **Server-Side Ingestion Firewall:**
   * Even if a compromised or misconfigured client emits telemetry coordinates during an active Medical Leave window, the API Ingestion Gateway intercepts the payload at middleware level:
     ```typescript
     if (employee.current_leave_type === LeaveType.MEDICAL) {
       // Purge spatial coordinates before database persistence
       telemetryPayload.latitude = null;
       telemetryPayload.longitude = null;
       telemetryPayload.accuracy = null;
       telemetryPayload.status = "MASKED_MEDICAL_LEAVE";
       return HttpResponse.ok({ tracking: "DISABLED" });
     }
     ```
3. **Manager Dashboard Masking:**
   * On the live map, workers on Medical Leave do **not** render at any coordinate pin.
   * Instead, they are pinned to an off-screen "Roster Drawer" with a Neutral Gray Shield icon and status: `On Approved Medical Leave (Location Masked)`. No historical breadcrumbs are queryable for the duration of the medical leave.

---

### 5.2 Approved Remote Work Subsystem
Field workers frequently split time between physical infrastructure sites and approved telecommuting locations (e.g., home office for administrative reporting or technical drafting).

#### Technical Implementation:
1. **Remote Geofence Provisioning:**
   * Worker submits Remote Work Request specifying approved residential address or secondary satellite hub.
   * System geocodes address via GIS geocoding service and provisions an ephemeral circular geofence with `radius = 150 meters`.
2. **Session Verification:**
   * During scheduled shift, the worker’s device executes standard geofenced verification against the ephemeral remote zone.
   * Attendance records are stamped with `shift_type = REMOTE` and `verification_method = REMOTE_GEOFENCE`.
3. **Manager Map Representation:**
   * The live map displays remote workers with an Azure Blue photo pin and a dedicated `[REMOTE]` badge.
   * The exact geofence perimeter around private residences can optionally be rendered with a privacy-preserving generalized boundary (fuzzy radius) to dispatcher views while retaining internal mathematical verification.

---

## 6. Manager Live Map & Operations Command Dashboard

### 6.1 Interactive Map Specifications
* **Engine:** Mapbox GL JS / MapLibre GL (WebGL-accelerated vector rendering) capable of smoothly rendering 2,000+ simultaneous interactive elements at 60 FPS.
* **Photo Avatar Markers:**
  * Custom HTML5/Canvas Marker: Circular employee avatar (44px diameter) with high-density retina scaling.
  * Outer 4px Concentric Status Ring with pulse animations:
    - **Emerald Green (`#10B981`):** Verified on-site inside active geofence.
    - **Amber Yellow (`#F59E0B`):** Warning state (In Grace Period, Overtime active, or Low Battery).
    - **Crimson Red (`#EF4444`):** Incident state (Boundary Breach, Unauthorized Early Departure, Late).
    - **Cobalt Blue (`#3B82F6`):** Approved Remote Telecommute site.
    - **Slate Gray (`#64748B`):** Off-duty / Masked Leave.
* **Hover Card (Micro-Tooltip):**
  * Displays Employee Name, Role, Current Site, Active Shift Elapsed Time, Overtime Accrued, Current Speed, Battery %, GPS Accuracy.
* **Click Action (Worker Focus Mode):**
  * Smooth camera fly-to animation (`zoom: 17.5`, `pitch: 45°`).
  * Activates Breadcrumb Trail for previous 8 hours with color-coded speed vectors.
  * Opens Right-Hand Inspection Drawer displaying full shift telemetry history and active audit logs.

---

### 6.2 Real-Time Alert & Incident Feed

The Operations Dashboard features a persistent, zero-latency Alert Drawer powered by WebSockets.

| Alert Identifier | Severity | Trigger Threshold | Visual & Audio Behavior | Resolution Action |
| :--- | :--- | :--- | :--- | :--- |
| `GEOFENCE_BREACH` | **CRITICAL** | Worker exits active boundary during shift without grace return > 300s. | Red flashing pin, urgent chime, modal banner. | Dispatcher calls worker / records breach waiver. |
| `LATE_ARRIVAL` | **WARNING** | Worker not checked in 15 mins post scheduled shift start. | Amber indicator ring, list warning item. | Auto-sends SMS reminder; logs tardiness. |
| `OVERTIME_THRESHOLD` | **WARNING** | Worker shift crosses 8.0 hrs and approaches daily overtime budget. | Amber pulsing ring, notification toaster. | Dispatcher approves OT or triggers shift handoff. |
| `TELEMETRY_LOST` | **CRITICAL** | No GPS packet received for > 15 minutes during active shift. | Desaturated marker, exclamation badge. | Checks network status; initiates safety check. |
| `BATTERY_CRITICAL` | **INFO** | Device battery drops $\le 15\%$ while on duty. | Battery icon on pin turns red. | Prompts worker to connect vehicle charger. |
| `MOCK_LOCATION_DETECTED`| **CRITICAL** | Hardware indicates mock location provider or spoofing app. | Immediate security flag, pin locked with red skull. | Immediate session suspension, manager audit flag. |

---

## 7. Data Model Specifications

```
                              +--------------------+
                              |     Employees      |
                              +--------------------+
                                | 1                | 1
                                |                  |
                                | *                | *
                      +-------------------+      +-------------------+
                      |       Shifts      |      |   LeaveRequests   |
                      +-------------------+      +-------------------+
                        | 1             | 1
                        |               |
                        | 1             | *
     +---------------------+          +------------------------+
     |    GeofenceZones    |          |   AttendanceSessions   |
     +---------------------+          +------------------------+
                                        | 1                  | 1
                                        |                    |
                                        | *                  | *
                              +--------------------+       +--------------------+
                              |  OvertimeRecords   |       | AlertNotifications |
                              +--------------------+       +--------------------+
```

### 7.1 Schema Specifications (PostgreSQL with PostGIS Extensions)

#### 7.1.1 Table: `Employees`
Stores worker identity, role, credentials, and real-time state flags.

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(32) UNIQUE NOT NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    phone_number VARCHAR(32) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('FIELD_WORKER', 'OPERATIONS_MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN')),
    department VARCHAR(64) NOT NULL,
    avatar_url TEXT,
    base_hourly_wage NUMERIC(10, 2) NOT NULL DEFAULT 25.00,
    current_status VARCHAR(32) NOT NULL DEFAULT 'OFF_DUTY' 
        CHECK (current_status IN ('OFF_DUTY', 'IN_TRANSIT', 'CHECKED_IN', 'ON_BREAK', 'OVERTIME', 'REMOTE', 'MEDICAL_LEAVE')),
    active_device_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_status ON employees(current_status);
CREATE INDEX idx_employees_role ON employees(role);
```

---

#### 7.1.2 Table: `GeofenceZones`
Stores physical and virtual boundary definitions supporting both radial circles and PostGIS polygonal geometries.

```sql
CREATE TABLE geofence_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    zone_code VARCHAR(32) UNIQUE NOT NULL,
    zone_type VARCHAR(16) NOT NULL CHECK (zone_type IN ('CIRCULAR', 'POLYGON')),
    -- Radial Geofence Parameters
    center_latitude DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION,
    -- Polygonal Geofence Parameters (PostGIS geometry)
    polygon_boundary GEOMETRY(Polygon, 4326),
    buffer_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    physical_address TEXT,
    organization_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_geofence_type CHECK (
        (zone_type = 'CIRCULAR' AND center_latitude IS NOT NULL AND center_longitude IS NOT NULL AND radius_meters IS NOT NULL) OR
        (zone_type = 'POLYGON' AND polygon_boundary IS NOT NULL)
    )
);

CREATE INDEX idx_geofence_zones_spatial ON geofence_zones USING GIST (polygon_boundary);
CREATE INDEX idx_geofence_zones_active ON geofence_zones(is_active);
```

---

#### 7.1.3 Table: `Shifts`
Defines planned duty windows, target sites, and overtime authorization caps.

```sql
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES geofence_zones(id) ON DELETE SET NULL,
    shift_type VARCHAR(24) NOT NULL DEFAULT 'STANDARD' CHECK (shift_type IN ('STANDARD', 'REMOTE', 'ON_CALL', 'EMERGENCY')),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    arrival_grace_minutes INT NOT NULL DEFAULT 15,
    departure_grace_minutes INT NOT NULL DEFAULT 10,
    max_approved_ot_hours NUMERIC(4, 2) NOT NULL DEFAULT 4.00,
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_shift_times CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_shifts_employee_dates ON shifts(employee_id, scheduled_start, scheduled_end);
CREATE INDEX idx_shifts_status ON shifts(status);
```

---

#### 7.1.4 Table: `AttendanceSessions`
Tracks verified geofence check-ins, check-outs, GPS audit locations, and aggregated durations.

```sql
CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES geofence_zones(id) ON DELETE SET NULL,
    -- Check-in Telemetry
    check_in_time TIMESTAMPTZ NOT NULL,
    check_in_latitude DOUBLE PRECISION NOT NULL,
    check_in_longitude DOUBLE PRECISION NOT NULL,
    check_in_accuracy_meters DOUBLE PRECISION NOT NULL,
    check_in_type VARCHAR(24) NOT NULL DEFAULT 'AUTOMATIC_GEOFENCE' 
        CHECK (check_in_type IN ('AUTOMATIC_GEOFENCE', 'MANUAL_DISPATCHER_OVERRIDE', 'OFFLINE_SYNC')),
    -- Check-out Telemetry
    check_out_time TIMESTAMPTZ,
    check_out_latitude DOUBLE PRECISION,
    check_out_longitude DOUBLE PRECISION,
    check_out_accuracy_meters DOUBLE PRECISION,
    check_out_type VARCHAR(24) 
        CHECK (check_out_type IN ('AUTOMATIC_GEOFENCE', 'MANUAL_DISPATCHER_OVERRIDE', 'AUTO_TIMEOUT', 'OFFLINE_SYNC')),
    -- Calculated Durations
    total_duration_seconds INT NOT NULL DEFAULT 0,
    regular_duration_seconds INT NOT NULL DEFAULT 0,
    overtime_duration_seconds INT NOT NULL DEFAULT 0,
    verification_status VARCHAR(24) NOT NULL DEFAULT 'VERIFIED' 
        CHECK (verification_status IN ('VERIFIED', 'FLAGGED_ANOMALY', 'PENDING_AUDIT', 'DISPUTED')),
    audit_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_employee ON attendance_sessions(employee_id);
CREATE INDEX idx_attendance_check_in ON attendance_sessions(check_in_time);
```

---

#### 7.1.5 Table: `OvertimeRecords`
Maintains granular tiered overtime audit ledger and supervisory approvals.

```sql
CREATE TABLE overtime_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    tier VARCHAR(24) NOT NULL CHECK (tier IN ('TIER_1_1_5X', 'TIER_2_2_0X', 'NIGHT_DIFFERENTIAL_1_25X')),
    duration_seconds INT NOT NULL,
    rate_multiplier NUMERIC(4, 2) NOT NULL,
    hourly_rate_applied NUMERIC(10, 2) NOT NULL,
    total_accrued_amount NUMERIC(10, 2) NOT NULL,
    approval_status VARCHAR(24) NOT NULL DEFAULT 'PENDING' 
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SYSTEM_AUTO_APPROVED')),
    approved_by_id UUID REFERENCES employees(id),
    approval_timestamp TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_overtime_session ON overtime_records(session_id);
CREATE INDEX idx_overtime_employee_status ON overtime_records(employee_id, approval_status);
```

---

#### 7.1.6 Table: `LeaveRequests`
Governs medical and remote work authorizations with location privacy controls.

```sql
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(24) NOT NULL CHECK (leave_type IN ('MEDICAL', 'ANNUAL', 'REMOTE_WORK', 'COMPASSIONATE', 'EMERGENCY')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    -- Remote Work Geofence Definition
    remote_address TEXT,
    remote_latitude DOUBLE PRECISION,
    remote_longitude DOUBLE PRECISION,
    remote_radius_meters DOUBLE PRECISION DEFAULT 150.0,
    -- Privacy Enforcement Flag
    is_location_masked BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    approval_status VARCHAR(24) NOT NULL DEFAULT 'PENDING' 
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
    approved_by_id UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_employee_dates ON leave_requests(employee_id, start_date, end_date);
CREATE INDEX idx_leave_status ON leave_requests(approval_status);
```

---

#### 7.1.7 Table: `AlertNotifications`
Persists system incidents, geofence breaches, and operational warnings.

```sql
CREATE TABLE alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(32) NOT NULL 
        CHECK (event_type IN ('GEOFENCE_BREACH', 'LATE_ARRIVAL', 'EARLY_DEPARTURE', 'OVERTIME_EXCEEDED', 'TELEMETRY_LOST', 'BATTERY_CRITICAL', 'MOCK_LOCATION')),
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES geofence_zones(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by_id UUID REFERENCES employees(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_unack ON alert_notifications(is_acknowledged) WHERE is_acknowledged = FALSE;
CREATE INDEX idx_alerts_employee ON alert_notifications(employee_id);
```

---

#### 7.1.8 Table: `TelemetryLogs` (TimescaleDB Hypertable for Raw Fixes)
High-throughput telemetry time-series store for real-time tracking and audit replays.

```sql
CREATE TABLE telemetry_logs (
    timestamp TIMESTAMPTZ NOT NULL,
    employee_id UUID NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_meters DOUBLE PRECISION,
    speed_mps DOUBLE PRECISION,
    heading_deg DOUBLE PRECISION,
    battery_pct SMALLINT,
    is_mock BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_masked BOOLEAN NOT NULL DEFAULT FALSE
);

-- TimescaleDB Hypertable partitioning by 1-day chunks
SELECT create_hypertable('telemetry_logs', 'timestamp', chunk_time_interval => INTERVAL '1 day');
CREATE INDEX idx_telemetry_emp_time ON telemetry_logs (employee_id, timestamp DESC);
```

---

## 8. State Transitions & Edge-Case Engineering

### 8.1 Finite State Machine (Worker Attendance Lifecycle)

```
                    +---------------------------+
                    |         OFF_DUTY          |
                    +---------------------------+
                                  |
                                  | Shift time arrives & Worker leaves home
                                  v
                    +---------------------------+
                    |        IN_TRANSIT         |
                    +---------------------------+
                                  |
                                  | Ingress boundary breached & Dwell >= 180s
                                  v
                    +---------------------------+
                    |        CHECKED_IN         | <-------------------+
                    +---------------------------+                     |
                       /           |          \                       |
       Shift reaches 8h /   Egress |           \ Mid-shift            | Egress < 300s
                       v           v            v Lunch               | or break ends
     +-------------------+   +-------------+  +-------------+         |
     | OVERTIME_TIER_1   |   | TEMPORARY_  |  | AUTHORIZED_ | --------+
     +-------------------+   | EGRESS_GRACE|  | BREAK       |
               |             +-------------+  +-------------+
               | Overtime          |
               | > 4h              | Departure > 300s & Shift complete
               v                   v
     +-------------------+   +---------------------------+
     | OVERTIME_TIER_2   |   |      SESSION_CLOSED       |
     +-------------------+   +---------------------------+
                                   |
                                   | Reset to off-duty
                                   v
                             [ OFF_DUTY ]
```

---

### 8.2 Comprehensive State Transition Rules

| Initial State | Event / Trigger | Guard Condition | New State | Side Effects & Outputs |
| :--- | :--- | :--- | :--- | :--- |
| `OFF_DUTY` | Shift Start Window Reached | Current time within 30m of shift start | `IN_TRANSIT` | Increases GPS polling to 30s; activates geofence listener. |
| `IN_TRANSIT` | Boundary Entry & Dwell | Distance $\le R$ for $\ge 180$ seconds | `CHECKED_IN` | Generates `AttendanceSession`; pushes WebSocket event; chime. |
| `IN_TRANSIT` | Shift Start Elapsed | Current time $> \text{start} + 15\text{m}$ & outside | `IN_TRANSIT` | Generates `LATE_ARRIVAL` alert to manager dashboard. |
| `CHECKED_IN` | Shift Hours Complete | Elapsed duration $\ge 8.0\text{ hours}$ | `OVERTIME_TIER_1` | Overtime counter armed; multiplier set to 1.5x; alert. |
| `OVERTIME_TIER_1`| Tier 1 Hours Complete| Elapsed duration $\ge 12.0\text{ hours}$ | `OVERTIME_TIER_2` | Multiplier set to 2.0x; critical manager OT alert. |
| `CHECKED_IN` | Boundary Exit | Distance $> R_{\text{exit}}$ | `TEMPORARY_EGRESS_GRACE` | Starts 300s countdown timer; warns worker on device. |
| `TEMPORARY_EGRESS_GRACE`| Boundary Re-Entry | Distance $\le R$ within 300s | `CHECKED_IN` | Cancels egress countdown; resumes normal tracking. |
| `TEMPORARY_EGRESS_GRACE`| Egress Timeout Expired| Outside $> 300$s & Shift end approaching | `SESSION_CLOSED` | Triggers `AUTOMATED_CHECK_OUT`; finalizes session hours. |
| `ANY_STATE` | Medical Leave Approved | Status set to `MEDICAL_LEAVE` | `MEDICAL_LEAVE` | **Kills GPS provider; drops coordinates; masks on map.** |

---

### 8.3 Edge-Case Engineering & Mitigation Protocols

```
+-------------------------------------------------------------------------------------------------+
|                               EDGE-CASE MITIGATION PROTOCOLS                                    |
+-------------------------------------------------------------------------------------------------+
|  1. GPS Drift / Canyon Multipath       | Discard accuracy > 30m. Dual-ring 15% hysteresis.      |
|  2. Mock Location / GPS Spoofing        | Android mock check + Network cell delta + Speed jump.   |
|  3. Cellular Dead Zones (Offline)       | SQLite store-and-forward queue with cryptographic hash. |
|  4. Midnight Shift Rollover             | Absolute UTC arithmetic; split daily OT accrual.        |
|  5. Device Battery Depletion (<15%)     | Low-battery snapshot event sent before shutdown.        |
|  6. Mid-Shift Medical Emergency         | One-tap Panic/Sick switch immediately halts tracking.   |
+-------------------------------------------------------------------------------------------------+
```

#### Detailed Mitigation Mechanics:
1. **GPS Multipath Reflection in Urban/Substation Canyons:**
   * High metal structures deflect satellite signals, reporting sudden 80m jumps.
   * *Mitigation:* Kalman filter on device smoothing raw coordinates. Fixes with `accuracy_meters > 30m` or instantaneous acceleration $> 9.8\text{ m/s}^2$ are rejected before feeding the Point-in-Polygon evaluator.
2. **Mock Location Detection & GPS Spoofing:**
   * Disgruntled workers using mock GPS apps to simulate on-site attendance from home.
   * *Mitigation:* The mobile client reads `location.isFromMockProvider()` (Android) and checks for active developer mock location flags. Telemetry payloads cross-reference Cellular Tower IDs and Wi-Fi BSSID signatures with Google Geolocation API. If a location spoof is detected, the session is flagged as `MOCK_LOCATION`, generating a critical security alert.
3. **Dead Zones & Store-and-Forward Replay Integrity:**
   * Workers inside underground vaults, basements, or rural dead zones lose cellular connection.
   * *Mitigation:* The mobile client persists telemetry fixes into an encrypted local SQLite database. Each event receives a monotonic sequence ID and a SHA-256 hash chaining back to the previous record (`prev_hash`). When cellular connectivity is restored, events are flushed in idempotent batches with an idempotency key. The server validates that local device timestamps match monotonic hardware boot clocks (`elapsedRealtimeNanos`) to prevent manual clock tampering.
4. **Device Battery Depletion at Site:**
   * If a phone drops to 15%, the app emits a `BATTERY_CRITICAL` warning packet and enters an ultra-low-power mode (reducing GPS sampling to boundary geofence monitoring only).
   * If the phone completely shuts down, the server does not register an immediate unauthorized exit; it flags the state as `TELEMETRY_INTERRUPTED_BATTERY`, initiating a 30-minute grace window before alert escalation.

---

## 9. System Architecture, APIs & Component Hierarchy

### 9.1 High-Level System Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                       CLIENT TIER                                                 |
|   +------------------------------------+             +----------------------------------------+   |
|   |  Mobile Field Worker Client App    |             |  Manager Operations Command Dashboard  |   |
|   |  (React Native / PWA / Android)    |             |  (Next.js 15 / React 19 / Mapbox GL)   |   |
|   |  - Fused Location GPS Engine       |             |  - 60 FPS WebGL Interactive Vector Map |   |
|   |  - SQLite Encrypted Offline Queue  |             |  - Real-time Alert & Incident Drawer   |   |
|   |  - Privacy Shield Hardware Kill    |             |  - Overtime Live Analytics Panel       |   |
|   +------------------------------------+             +----------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
                       |  HTTPS REST / WSS                                   ^  WSS / HTTPS
                       v                                                     |
+---------------------------------------------------------------------------------------------------+
|                                       API GATEWAY TIER                                            |
|   +-------------------------------------------------------------------------------------------+   |
|   | Reverse Proxy & Ingestion Firewall (Envoy / NGINX)                                        |   |
|   | - TLS 1.3 Termination, JWT Authentication, Rate Limiting                                  |   |
|   | - Privacy Ingestion Firewall: Strips GPS for workers on Medical Leave                     |   |
|   +-------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
                       |                                                     ^
                       v                                                     |
+---------------------------------------------------------------------------------------------------+
|                                   APPLICATION SERVICES TIER                                       |
|   +-----------------------+  +-----------------------+  +-------------------------------------+   |
|   | Geofence Rules Engine |  | Overtime Engine       |  | Alert & Notification Service        |   |
|   | - Ray-Casting & Dwell |  | - Multi-tier Accrual  |  | - WebPush, SMS, WebSockets          |   |
|   | - Anti-bounce Filter  |  | - Night Diff Splitter |  | - Incident Escalation Dispatcher    |   |
|   +-----------------------+  +-----------------------+  +-------------------------------------+   |
|   +-------------------------------------------------------------------------------------------+   |
|   | Real-Time Broadcast Gateway (Socket.io / Redis PubSub WebSocket cluster)                   |   |
|   +-------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
                       |                                                     ^
                       v                                                     |
+---------------------------------------------------------------------------------------------------+
|                                     DATA PERSISTENCE TIER                                         |
|   +------------------------------------+             +----------------------------------------+   |
|   | PostgreSQL 16 + PostGIS            |             | Redis 7 In-Memory Data Store           |   |
|   | - Spatial polygon boundaries       |             | - Active Worker Geo-indices (GEOADD)   |   |
|   | - Employees, Shifts, Timesheets    |             | - Real-time Session State Cache        |   |
|   +------------------------------------+             | - PubSub Message Distribution          |   |
|   +------------------------------------+             +----------------------------------------+   |
|   | TimescaleDB (Time-series cluster)  |                                                          |   |
|   | - High-volume Telemetry Logs       |                                                          |   |
|   +------------------------------------+                                                          |   |
+---------------------------------------------------------------------------------------------------+
```

---

### 9.2 REST API Specifications (OpenAPI Style)

#### `POST /api/v1/telemetry/ingest`
Ingests high-frequency location fixes from mobile clients with privacy and anti-spoof checks.

* **Headers:** `Authorization: Bearer <jwt>`, `X-Device-Id: <uuid>`
* **Request Body:**
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
* **Response (200 OK):**
```json
{
  "status": "PROCESSED",
  "current_state": "CHECKED_IN",
  "active_zone_id": "90e4f1a2-bdf4-4110-8547-79b8a1c97041",
  "dwell_time_seconds": 320,
  "overtime_active": false,
  "tracking_interval_seconds": 15
}
```
*(If worker is on approved Medical Leave, response is `200 OK` with `status: "MASKED_IGNORED"` and server discards coordinates immediately).*

---

#### `POST /api/v1/shifts/geofence-check`
Explicit check endpoint for mobile edge verification.

* **Request Body:**
```json
{
  "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
  "latitude": 37.774929,
  "longitude": -122.419416
}
```
* **Response (200 OK):**
```json
{
  "in_bounds": true,
  "zone_id": "90e4f1a2-bdf4-4110-8547-79b8a1c97041",
  "zone_name": "Bay Area Central Hub",
  "distance_to_center_meters": 42.1,
  "zone_type": "CIRCULAR",
  "radius_meters": 120.0
}
```

---

#### `GET /api/v1/manager/live-map/workers`
Returns real-time worker fleet positions, status rings, and telemetry for dashboard initialization.

* **Response (200 OK):**
```json
{
  "timestamp": "2026-10-11T14:30:00.000Z",
  "total_workers_active": 42,
  "workers": [
    {
      "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
      "name": "Alex Carter",
      "avatar_url": "https://assets.gwms.io/avatars/carter_a.png",
      "status": "CHECKED_IN",
      "status_badge_color": "#10B981",
      "latitude": 37.774929,
      "longitude": -122.419416,
      "accuracy_meters": 8.4,
      "battery_pct": 82,
      "current_zone_name": "Bay Area Central Hub",
      "shift_start": "2026-10-11T08:00:00Z",
      "elapsed_minutes": 390,
      "overtime_active": false,
      "overtime_minutes": 0
    },
    {
      "employee_id": "d718b291-729f-4cc5-921b-b4618274191a",
      "name": "Samantha Reed",
      "avatar_url": "https://assets.gwms.io/avatars/reed_s.png",
      "status": "MEDICAL_LEAVE",
      "status_badge_color": "#64748B",
      "latitude": null,
      "longitude": null,
      "privacy_masked": true,
      "current_zone_name": null,
      "shift_start": null,
      "elapsed_minutes": 0,
      "overtime_active": false,
      "overtime_minutes": 0
    }
  ]
}
```

---

### 9.3 Real-Time WebSocket Specifications

* **Endpoint:** `wss://stream.gwms.io/v1/operations`
* **Authentication:** Handshake query token `?token=<jwt>`

#### WebSocket Client -> Server Topics:
* `subscribe.zones`: Listen for workers in specific geofence boundaries.
* `subscribe.alerts`: Listen for real-time breach/overtime warnings.

#### WebSocket Server -> Client Broadcast Events:

```json
// Event: worker.telemetry.updated
{
  "event": "worker.telemetry.updated",
  "timestamp": "2026-10-11T14:30:01.120Z",
  "data": {
    "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
    "latitude": 37.774935,
    "longitude": -122.419420,
    "speed_mps": 0.2,
    "battery_pct": 82,
    "current_status": "CHECKED_IN"
  }
}
```

```json
// Event: alert.geofence.breach
{
  "event": "alert.geofence.breach",
  "timestamp": "2026-10-11T14:30:05.400Z",
  "severity": "CRITICAL",
  "data": {
    "alert_id": "8fa21e54-5261-419b-a010-0081e7d23a19",
    "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
    "employee_name": "Alex Carter",
    "zone_id": "90e4f1a2-bdf4-4110-8547-79b8a1c97041",
    "zone_name": "Bay Area Central Hub",
    "breach_type": "UNAUTHORIZED_EGRESS",
    "duration_outside_seconds": 310,
    "last_known_coords": [37.775810, -122.420110]
  }
}
```

```json
// Event: overtime.tier.escalated
{
  "event": "overtime.tier.escalated",
  "timestamp": "2026-10-11T16:00:00.000Z",
  "severity": "WARNING",
  "data": {
    "employee_id": "c4b3a120-410a-4a88-8422-9df739460012",
    "employee_name": "Alex Carter",
    "shift_id": "5a41e9b2-38d1-4cb9-9140-5e82b7194630",
    "previous_tier": "STANDARD_1_0X",
    "new_tier": "TIER_1_1_5X",
    "accumulated_hours": 8.01,
    "hourly_rate": 37.50
  }
}
```

---

### 9.4 Frontend Component Hierarchy

```
ManagerOperationsPortal (Root)
│
├── AppHeader
│   ├── OperationsStatusSummary (Active Workers, Sites, Active Alerts)
│   ├── QuickFilterBar (All, On-Site, In-Transit, Overtime, Remote, Medical)
│   └── UserProfileMenu
│
├── LiveOperationsMap (Full-viewport WebGL Canvas)
│   ├── MapboxControls (Zoom, Pitch, Satellite/Vector Toggle, Recenter)
│   ├── GeofenceLayer
│   │   ├── CircularGeofenceRings (Target Zone + Buffer Ring)
│   │   └── PolygonGeofenceLayers (GeoJSON Fill + Border Highlights)
│   │
│   ├── WorkerMarkerLayer
│   │   └── WorkerPhotoMarker (Avatar + Animated Status Ring)
│   │       └── MarkerHoverTooltip (Speed, Battery, Accuracy, Shift Time)
│   │
│   └── BreadcrumbHistoryLayer (Selected Worker Polyline Trail)
│
├── AlertIncidentDrawer (Slide-out Real-time Notification Panel)
│   ├── AlertFilterTabs (Critical, Warning, Info)
│   ├── AlertList
│   │   └── AlertItemCard (Timestamp, Employee, Event Type, Acknowledge Button)
│   └── EmergencyBroadcastAction
│
└── InspectorDrawer (Right Panel - Worker Detailed Drill-down)
    ├── WorkerProfileHeader (Photo, ID, Department, Contact Button)
    ├── ActiveShiftTracker
    │   ├── ShiftProgressGauge (Scheduled vs Actual)
    │   ├── RealTimeOvertimeCounter (Tier Multiplier + Live Cost Estimate)
    │   └── TelemetryVitals (Battery %, GPS Accuracy, Connection Quality)
    ├── GeofenceHistoryTimeline (Arrival, Dwell, Check-in, Departures)
    └── ManagerOverrideActions (Force Check-out, Approve OT, Grant Egress Grace)
```

---

## 10. Summary & Implementation Roadmap

The architectural blueprint specified above addresses all mission-critical requirements for the Geofenced Workforce Monitoring System:
1. **Mathematical Rigor:** Dual-concentric circular and ray-casting polygon algorithms paired with temporal dwell filters completely eliminate boundary-bounce and multipath false alarms.
2. **Real-Time Financial Precision:** A continuous multi-tier overtime computation engine provides dispatchers with instant payroll liability visibility while honoring night differential and statutory rest day premiums.
3. **Ironclad Privacy Protections:** A multi-layered privacy firewall physically halts telemetry and completely zeroes out location storage during medical leaves, preventing privacy liabilities.
4. **Resilient Offline Architecture:** Store-and-forward edge caching with cryptographic hash chains protects data integrity in cellular dead zones.

This specification serves as the foundational engineering baseline for the implementation phases.
