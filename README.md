# Geofenced Workforce Monitoring System (GWMS)

[![Status](https://img.shields.io/badge/Status-Production--Ready-emerald)]()
[![Platform](https://img.shields.io/badge/Platform-Full--Stack%20Web%20%2B%20Mobile-blue)]()
[![Privacy](https://img.shields.io/badge/Privacy-GDPR%20Art.%209%20Compliant-purple)]()
[![Architecture](https://img.shields.io/badge/Engine-Haversine%20%7C%20PIP%20%7C%20Hysteresis-orange)]()

A high-precision, mission-critical workforce monitoring platform designed for automated time tracking, remote employee visibility, and continuous overtime accounting across geographically distributed operations (telecommunications, construction, power grid inspection, logistics, and emergency response).

---

## 1. System Overview & Problem Statement

### Objective
Create a mobile application designed for automated time tracking and remote employee visibility with:
* **Automated check-in & check-out:** Triggered by geographic location coordinates within designated shift timings without requiring manual worker button presses.
* **Continuous Overtime Calculation:** Real-time multi-tier overtime accrual (Standard 1.0x, Tier 1 1.5x, Tier 2 2.0x, and Night Differential +0.25x).
* **Manager Notifications & Alerts:** Real-time alerts for geofence breaches, late arrivals, overtime thresholds, and lone-worker emergency SOS.
* **Live Map Dashboard:** Interactive vector map featuring employee location pins with high-resolution photos, specifically built to monitor field workers or track status during approved remote or medical leaves.

---

## 2. Multi-Agent Collaborative Engineering Pipeline

This solution was designed, audited, and implemented through a specialized multi-agent architectural pipeline:

```
+-------------------------------------------------------------------------------------------------------------+
|                                      MULTI-AGENT COLLABORATION PIPELINE                                      |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  [ Planner Agent ]  -------->  [ Critic Agent ]  -------->  [ Senior Developer ]  --------> [ Robust Builder |
|  Architecture Blueprint        Privacy & Edge Audit         Mathematical Algorithms     & Frontend Dev ]    |
|  Data Schemas & Workflows      GDPR & Battery Physics       Haversine, PIP & State      Full-Stack UI, Map  |
|  (ARCHITECTURE_SPECIFICATION)  (CRITIQUE_RECOMMENDATIONS)   (TECHNICAL_DESIGN_ALGO)     & Simulator Delivery|
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
```

1. **Planner Agent ([`ARCHITECTURE_SPECIFICATION.md`](file:///c:/Users/Rohith/Downloads/Work-Monitoring-System/ARCHITECTURE_SPECIFICATION.md)):**
   - Engineered the comprehensive 58 KB systems specification covering user personas, dual-boundary geofencing models, TimescaleDB/PostGIS data schemas, and state machine topologies.
2. **Critic Agent ([`CRITIQUE_AND_RECOMMENDATIONS.md`](file:///c:/Users/Rohith/Downloads/Work-Monitoring-System/CRITIQUE_AND_RECOMMENDATIONS.md)):**
   - Performed an exhaustive legal, privacy, and physics audit. Identified critical vectors:
     * *Medical Leave Privacy Violation:* Prohibited exposing medical leave coordinates on manager maps (GDPR Art. 9 / ADA compliance). Mandated complete hardware GPS shutoff and server-side coordinate scrubbing.
     * *Lone-Worker SOS Separation:* Decoupled Administrative Medical Leave from Industrial Emergency SOS so emergency coordinates are preserved for rescue.
     * *Mobile Battery Depletion:* Formulated an adaptive tiered energy model to replace continuous high-frequency polling.
3. **Senior Developer Agent ([`TECHNICAL_DESIGN_AND_ALGORITHMS.md`](file:///c:/Users/Rohith/Downloads/Work-Monitoring-System/TECHNICAL_DESIGN_AND_ALGORITHMS.md)):**
   - Implemented exact mathematical formulations: clamped Haversine spherical distance, Jordan Curve ray-casting point-in-polygon (PIP), dual-concentric hysteresis buffers, and continuous multi-tier overtime integration across midnight boundaries.
4. **Robust Builder & Frontend Developer:**
   - Implemented and delivered the complete, runnable full-stack application with Leaflet dark map, custom photo pins, Web Audio synthesizer alerts, mobile simulator, and interactive scenario runner.

---

## 3. Core Architectural Modules

### 3.1 Spatial Geofencing & Anti-Bounce Hysteresis Engine
* **Spherical Haversine Algorithm:** Great-circle distance calculation with numerical stability clamping:
  $$d = 2R \cdot \text{atan2}\left(\sqrt{\text{clamp}(a, 0, 1)}, \sqrt{\text{clamp}(1-a, 0, 1)}\right)$$
* **Jordan Curve Point-in-Polygon (PIP):** Half-open ray-casting algorithm for non-convex polygon perimeters (Port Cargo Yards, construction sites).
* **Concentric Spatial Hysteresis:** Prevents boundary toggle oscillation:
  * Entry Threshold: $R_{\text{entry}} = R$
  * Exit Threshold: $R_{\text{exit}} = R + \max(20\text{m}, 0.15R)$
* **Temporal Dwell State Machine:**
  * **Ingress Dwell Filter ($180\text{s}$):** Worker must maintain continuous in-bounds presence for 180 seconds with GPS accuracy $\le 30\text{m}$ before automated check-in triggers.
  * **Egress Grace Filter ($300\text{s}$):** Worker stepping outside perimeter enters a 300-second grace countdown to prevent false alarms during perimeter walks or delivery pickups.

### 3.2 Continuous Overtime & Payroll Mathematical Engine
Every second, active duty duration is continuously split into statutory rate tiers:
* **Standard Regular Hours ($D_{\text{reg}}$):** 0 to 8.0 hours per shift $\rightarrow$ **1.0x** base hourly wage.
* **Tier 1 Overtime ($D_{\text{ot1}}$):** $> 8.0$ up to 12.0 hours per day $\rightarrow$ **1.5x** base hourly wage.
* **Tier 2 Overtime ($D_{\text{ot2}}$):** $> 12.0$ hours per day or Statutory Rest Days $\rightarrow$ **2.0x** base hourly wage.
* **Night Differential ($D_{\text{night}}$):** Hours worked between 22:00 and 06:00 local time $\rightarrow$ **+0.25x** additive bonus.
* **Real-time Financial Liability:**
  $$\text{Total Pay} = \left(\frac{D_{\text{reg}}}{3600} \cdot W \cdot 1.0\right) + \left(\frac{D_{\text{ot1}}}{3600} \cdot W \cdot 1.5\right) + \left(\frac{D_{\text{ot2}}}{3600} \cdot W \cdot 2.0\right) + \left(\frac{D_{\text{night}}}{3600} \cdot W \cdot 0.25\right)$$

### 3.3 Strict Privacy Firewall & Remote Work Subsystem
* **Medical Leave Privacy Isolation:** When an employee is on approved medical leave, the client shuts off GPS and the server ingestion firewall scrubs `latitude`, `longitude`, `accuracy`, and `speed`. On manager screens, the worker appears only in a confidential Privacy Roster with zero location telemetry and a **Gray Shield** badge.
* **Approved Remote Telecommuting:** When an employee works remotely, the system provisions an ephemeral 150-meter circular micro-geofence around their authorized satellite office, rendering a **Cobalt Blue** ring.
* **Lone-Worker Emergency SOS:** One-tap emergency distress beacon that emits audible sirens, flashes the map pin in radiant red, and automatically focuses the command map.

---

## 4. User Interface Deliverables

### A. Manager Live Map Operations Dashboard
* **Full-Screen Interactive Map:** Dark vector Leaflet map with custom HTML employee photo markers.
* **Color-Coded Status Rings:**
  * **Emerald Green:** On-Site Verified (Active)
  * **Amber Yellow (Pulsing):** Overtime Tier 1 (1.5x) or Egress Grace Active
  * **Crimson Red (Pulsing):** Overtime Tier 2 (2.0x) or Geofence Breach
  * **Cobalt Blue:** Approved Remote Telecommute
  * **Slate Gray:** Medical Leave (Location Masked)
  * **Radiant Red (Flashing):** Emergency SOS Distress Beacon
* **Inspector Drawer:** Displays battery %, GPS accuracy gate, shift gauges, live overtime accrual, and manager override actions.
* **Real-Time Alert Center:** Audible notification beeps and sirens with filters for Critical, Warning, and Info incidents.
* **Overtime Audit Modal:** Comprehensive payroll report with live calculations and one-click **CSV Export**.

### B. Mobile Field Worker Application Simulator
* **Smartphone Frame:** Notch status bar, battery indicator, and 5G/Offline indicator.
* **Worker Switcher:** Toggle between any field worker identity.
* **Geofence Radar:** Live proximity display with 180s Ingress Dwell progress bar and 300s Egress Grace countdown.
* **Shift & Overtime Clock:** Continuous timer showing accrued regular hours and overtime bonus dollars.
* **Interactive Controls:**
  * *Walk Inside Site* (triggers ingress dwell and auto check-in)
  * *Step Outside Site* (triggers egress grace)
  * *Report Medical Leave* (triggers privacy firewall)
  * *Request Remote Work* (provisions ephemeral perimeter)
  * *Simulate Tunnel Dead Zone* (tests offline queueing and sync)
  * *Lone-Worker SOS Beacon* (broadcasts distress signal)

---

## 5. Quick Start & Execution

### Prerequisites
* **Node.js** v18+ (tested on Node v25)
* **npm** v9+

### Launch the Application
```powershell
# In project root: c:\Users\Rohith\Downloads\Work-Monitoring-System
npm start
```

Open your browser to:
* **Unified Dashboard:** [`http://localhost:5000`](http://localhost:5000)
* **Health Check API:** [`http://localhost:5000/health`](http://localhost:5000/health)
* **REST API Endpoints:** [`http://localhost:5000/api/workers`](http://localhost:5000/api/workers)

---

## 6. Directory Structure

```
Work-Monitoring-System/
├── ARCHITECTURE_SPECIFICATION.md       # Blueprint by Planner Agent (58 KB)
├── CRITIQUE_AND_RECOMMENDATIONS.md      # Security & Privacy Audit by Critic Agent (42 KB)
├── TECHNICAL_DESIGN_AND_ALGORITHMS.md   # Mathematical Engines by Senior Dev (84 KB)
├── package.json                         # Unified monorepo run configuration
│
├── server/                              # Node.js + Express + Socket.io Backend
│   ├── package.json
│   └── src/
│       ├── index.js                     # Server entrypoint & static host
│       ├── engine/
│       │   ├── spatialGeofence.js       # Haversine, PIP, Hysteresis & Dwell
│       │   ├── overtimeEngine.js        # Multi-tier continuous overtime math
│       │   └── privacyFirewall.js       # GDPR Art. 9 coordinate scrubber
│       ├── data/
│       │   └── seedData.js              # Field workers with photos, geofences, shifts
│       ├── simulation/
│       │   └── telemetrySimulator.js    # 6-scenario simulator & background engine
│       └── routes/
│           └── api.js                   # REST API routes & timesheet exporter
│
└── client/                              # Vite + React 19 + Tailwind CSS + Leaflet
    ├── package.json
    ├── vite.config.js                   # Vite config with @tailwindcss/vite & proxy
    ├── index.html                       # HTML document with Inter font & Leaflet CSS
    └── src/
        ├── main.jsx                     # React entrypoint
        ├── index.css                    # Tailwind CSS & custom Leaflet pin animations
        ├── App.jsx                      # Main UI controller & WebSocket bridge
        ├── services/
        │   └── soundEffects.js          # Web Audio procedural sound synthesizer
        └── components/
            ├── MapComponent.jsx         # Interactive Leaflet map with custom photo pins
            ├── WorkerDrawer.jsx         # Slide-out inspector with vitals & overrides
            ├── AlertCenter.jsx          # Audible incident notification drawer
            ├── OvertimeModal.jsx        # Timesheet financial audit with CSV download
            ├── GeofenceModal.jsx        # Provision custom circular geofences
            ├── MobileWorkerApp.jsx      # Mobile smartphone application simulator
            ├── SimulationController.jsx # 6 automated scenario triggers (1x-30x speed)
            └── PrivacyRoster.jsx        # Remote & Medical leave confidential tracking
```
