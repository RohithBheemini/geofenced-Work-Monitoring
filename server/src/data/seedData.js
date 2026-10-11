/**
 * @file seedData.js
 * @description Comprehensive realistic seed data for workforce monitoring.
 * Field workers with avatars, roles, geofence zones, shifts, and initial attendance.
 */

export const INITIAL_GEOFENCES = [
  {
    id: 'zone-metro-hub',
    type: 'CIRCULAR',
    name: 'Downtown Metro Telecom Hub',
    description: 'Primary cellular infrastructure & antenna grid operations center',
    center: { latitude: 37.7749, longitude: -122.4194 },
    radiusMeters: 280,
    bufferMeters: 40,
    color: '#10B981', // Emerald
    headcountTarget: 4,
  },
  {
    id: 'zone-port-cargo',
    type: 'POLYGON',
    name: 'Port Cargo Terminal Yard',
    description: 'Maritime freight loading docks and heavy machinery repair perimeter',
    vertices: [
      { latitude: 37.7890, longitude: -122.3920 },
      { latitude: 37.7940, longitude: -122.3850 },
      { latitude: 37.7880, longitude: -122.3780 },
      { latitude: 37.7820, longitude: -122.3840 },
      { latitude: 37.7840, longitude: -122.3900 },
    ],
    bufferMeters: 30,
    color: '#8B5CF6', // Purple
    headcountTarget: 3,
  },
  {
    id: 'zone-substation',
    type: 'CIRCULAR',
    name: 'East Bay Substation & Solar Complex',
    description: 'High-voltage transformer grid and solar storage facility',
    center: { latitude: 37.7650, longitude: -122.4350 },
    radiusMeters: 320,
    bufferMeters: 45,
    color: '#F59E0B', // Amber
    headcountTarget: 2,
  },
  {
    id: 'zone-silicon-campus',
    type: 'CIRCULAR',
    name: 'Silicon Valley Innovation Campus',
    description: 'Field testing lab for autonomous drones and sensors',
    center: { latitude: 37.7833, longitude: -122.4167 },
    radiusMeters: 220,
    bufferMeters: 35,
    color: '#06B6D4', // Cyan
    headcountTarget: 2,
  },
  {
    id: 'zone-remote-elena',
    type: 'CIRCULAR',
    name: 'Approved Remote Hub (Elena Rostova)',
    description: 'Authorized telecommuting micro-perimeter',
    center: { latitude: 37.7800, longitude: -122.4600 },
    radiusMeters: 150,
    bufferMeters: 25,
    color: '#3B82F6', // Blue
    isRemote: true,
    headcountTarget: 1,
  },
];

export const INITIAL_WORKERS = [
  {
    id: 'worker-alex',
    name: 'Alex Carter',
    role: 'Senior Rigging Tech',
    department: 'Telecommunications',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0142',
    baseWage: 42.50,
    assignedZoneId: 'zone-metro-hub',
    status: 'CHECKED_IN_NORMAL', // Green
    leaveType: null,
    batteryPercent: 88,
    gpsAccuracy: 4.8,
    currentLocation: { latitude: 37.7752, longitude: -122.4188 }, // Inside Metro Hub
    shift: {
      id: 'shift-alex-01',
      type: 'STANDARD',
      scheduledStart: '08:00',
      scheduledEnd: '16:00',
      checkInTime: Date.now() - (4 * 3600 + 15 * 60) * 1000, // Worked 4h 15m
      isFormallyCheckedIn: true,
    },
    breadcrumbs: [
      { latitude: 37.7735, longitude: -122.4220, timestamp: Date.now() - 4.5 * 3600 * 1000 },
      { latitude: 37.7745, longitude: -122.4200, timestamp: Date.now() - 4.3 * 3600 * 1000 },
      { latitude: 37.7752, longitude: -122.4188, timestamp: Date.now() - 4.2 * 3600 * 1000 },
    ],
  },
  {
    id: 'worker-carlos',
    name: 'Carlos Mendez',
    role: 'Infrastructure Foreman',
    department: 'Heavy Construction',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0189',
    baseWage: 48.00,
    assignedZoneId: 'zone-port-cargo',
    status: 'OVERTIME_TIER_1', // Amber/Orange
    leaveType: null,
    batteryPercent: 62,
    gpsAccuracy: 6.2,
    currentLocation: { latitude: 37.7885, longitude: -122.3855 }, // Inside Port Cargo
    shift: {
      id: 'shift-carlos-01',
      type: 'STANDARD',
      scheduledStart: '07:00',
      scheduledEnd: '15:00',
      checkInTime: Date.now() - (9 * 3600 + 35 * 60) * 1000, // Worked 9h 35m (1h 35m OT)
      isFormallyCheckedIn: true,
    },
    breadcrumbs: [
      { latitude: 37.7860, longitude: -122.3890, timestamp: Date.now() - 9.5 * 3600 * 1000 },
      { latitude: 37.7885, longitude: -122.3855, timestamp: Date.now() - 9.0 * 3600 * 1000 },
    ],
  },
  {
    id: 'worker-priya',
    name: 'Priya Patel',
    role: 'Field Safety & Compliance Lead',
    department: 'EHS & Medical',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0211',
    baseWage: 45.00,
    assignedZoneId: 'zone-silicon-campus',
    status: 'CHECKED_IN_NORMAL', // Green
    leaveType: null,
    batteryPercent: 94,
    gpsAccuracy: 3.5,
    currentLocation: { latitude: 37.7831, longitude: -122.4162 }, // Inside Campus
    shift: {
      id: 'shift-priya-01',
      type: 'STANDARD',
      scheduledStart: '09:00',
      scheduledEnd: '17:00',
      checkInTime: Date.now() - (3 * 3600 + 40 * 60) * 1000, // Worked 3h 40m
      isFormallyCheckedIn: true,
    },
    breadcrumbs: [
      { latitude: 37.7810, longitude: -122.4190, timestamp: Date.now() - 4.0 * 3600 * 1000 },
      { latitude: 37.7831, longitude: -122.4162, timestamp: Date.now() - 3.7 * 3600 * 1000 },
    ],
  },
  {
    id: 'worker-david',
    name: 'David Kim',
    role: 'Fiber-Optic Splicing Tech',
    department: 'Field Operations',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0322',
    baseWage: 39.50,
    assignedZoneId: 'zone-metro-hub',
    status: 'OUT_OF_BOUNDS_WARNING', // Amber/Yellow
    leaveType: null,
    batteryPercent: 41,
    gpsAccuracy: 8.5,
    currentLocation: { latitude: 37.7785, longitude: -122.4230 }, // Just outside Metro Hub boundary
    shift: {
      id: 'shift-david-01',
      type: 'STANDARD',
      scheduledStart: '08:00',
      scheduledEnd: '16:00',
      checkInTime: Date.now() - (5 * 3600 + 10 * 60) * 1000,
      isFormallyCheckedIn: true,
      egressGraceRemainingSeconds: 195, // 195s left before breach!
    },
    breadcrumbs: [
      { latitude: 37.7750, longitude: -122.4190, timestamp: Date.now() - 5.0 * 3600 * 1000 },
      { latitude: 37.7770, longitude: -122.4210, timestamp: Date.now() - 10 * 60 * 1000 },
      { latitude: 37.7785, longitude: -122.4230, timestamp: Date.now() - 2 * 60 * 1000 },
    ],
  },
  {
    id: 'worker-elena',
    name: 'Elena Rostova',
    role: 'Remote Dispatch Specialist',
    department: 'Operations Command',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0455',
    baseWage: 38.00,
    assignedZoneId: 'zone-remote-elena',
    status: 'APPROVED_REMOTE', // Cobalt Blue
    leaveType: 'REMOTE',
    batteryPercent: 91,
    gpsAccuracy: 5.0,
    currentLocation: { latitude: 37.7802, longitude: -122.4598 }, // Inside remote zone
    shift: {
      id: 'shift-elena-01',
      type: 'REMOTE',
      scheduledStart: '09:00',
      scheduledEnd: '17:00',
      checkInTime: Date.now() - (6 * 3600) * 1000,
      isFormallyCheckedIn: true,
    },
    breadcrumbs: [
      { latitude: 37.7802, longitude: -122.4598, timestamp: Date.now() - 6 * 3600 * 1000 },
    ],
  },
  {
    id: 'worker-marcus',
    name: 'Marcus Brody',
    role: 'High-Voltage Grid Specialist',
    department: 'Utility Operations',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0678',
    baseWage: 46.00,
    assignedZoneId: 'zone-substation',
    status: 'MEDICAL_LEAVE', // Slate Gray / Masked
    leaveType: 'MEDICAL',
    batteryPercent: 78,
    gpsAccuracy: null,
    currentLocation: null, // STRICT PRIVACY FIREWALL: NULL COORDINATES!
    shift: {
      id: 'shift-marcus-01',
      type: 'STANDARD',
      scheduledStart: '08:00',
      scheduledEnd: '16:00',
      checkInTime: null,
      isFormallyCheckedIn: false,
      leaveNotes: 'Approved Medical Recovery (Masked). Zero location telemetry broadcasted.',
    },
    breadcrumbs: [],
  },
  {
    id: 'worker-samantha',
    name: 'Samantha Reed',
    role: 'Substation Inspector',
    department: 'Grid Operations',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (415) 555-0789',
    baseWage: 44.00,
    assignedZoneId: 'zone-substation',
    status: 'IN_TRANSIT', // Blue/Cyan
    leaveType: null,
    batteryPercent: 82,
    gpsAccuracy: 6.0,
    currentLocation: { latitude: 37.7600, longitude: -122.4300 }, // En route to East Bay Substation
    shift: {
      id: 'shift-samantha-01',
      type: 'STANDARD',
      scheduledStart: '10:00',
      scheduledEnd: '18:00',
      checkInTime: null,
      isFormallyCheckedIn: false,
      ingressDwellSeconds: 45, // 45s of 180s completed
    },
    breadcrumbs: [
      { latitude: 37.7550, longitude: -122.4250, timestamp: Date.now() - 30 * 60 * 1000 },
      { latitude: 37.7600, longitude: -122.4300, timestamp: Date.now() - 5 * 60 * 1000 },
    ],
  },
];

export const INITIAL_ALERTS = [
  {
    id: 'alert-01',
    timestamp: Date.now() - 12 * 60 * 1000,
    workerId: 'worker-carlos',
    workerName: 'Carlos Mendez',
    zoneId: 'zone-port-cargo',
    zoneName: 'Port Cargo Terminal Yard',
    type: 'OVERTIME_THRESHOLD',
    severity: 'WARNING',
    message: 'Carlos Mendez exceeded 8.0h standard shift. Tier 1 Overtime (1.5x) actively accruing.',
    acknowledged: false,
  },
  {
    id: 'alert-02',
    timestamp: Date.now() - 8 * 60 * 1000,
    workerId: 'worker-david',
    workerName: 'David Kim',
    zoneId: 'zone-metro-hub',
    zoneName: 'Downtown Metro Telecom Hub',
    type: 'GEOFENCE_BREACH_WARNING',
    severity: 'WARNING',
    message: 'David Kim crossed perimeter. Egress grace countdown active (195s remaining).',
    acknowledged: false,
  },
  {
    id: 'alert-03',
    timestamp: Date.now() - 45 * 60 * 1000,
    workerId: 'worker-marcus',
    workerName: 'Marcus Brody',
    zoneId: 'zone-substation',
    zoneName: 'East Bay Substation & Solar Complex',
    type: 'MEDICAL_LEAVE_ACTIVATED',
    severity: 'INFO',
    message: 'Medical leave approved for Marcus Brody. Privacy firewall engaged (GPS tracking suspended).',
    acknowledged: true,
  },
  {
    id: 'alert-04',
    timestamp: Date.now() - 90 * 60 * 1000,
    workerId: 'worker-alex',
    workerName: 'Alex Carter',
    zoneId: 'zone-metro-hub',
    zoneName: 'Downtown Metro Telecom Hub',
    type: 'AUTO_CHECKIN_VERIFIED',
    severity: 'INFO',
    message: 'Alex Carter verified on-site after 180s spatial dwell in Downtown Metro Telecom Hub.',
    acknowledged: true,
  },
];
