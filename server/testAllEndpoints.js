/**
 * @file testAllEndpoints.js
 * @description Comprehensive automated test runner that verifies every endpoint and feature.
 */

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('===============================================================');
  console.log('  STARTING COMPREHENSIVE ENDPOINT VERIFICATION SUITE');
  console.log(`  Target: ${BASE_URL}`);
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, method, endpoint, body = null, validate = null) {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(`${BASE_URL}${endpoint}`, options);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
      }

      if (validate) {
        validate(data);
      }

      console.log(`  [PASS] ${method.padEnd(5)} ${endpoint.padEnd(30)} - ${name}`);
      passed++;
      return data;
    } catch (err) {
      console.error(`  [FAIL] ${method.padEnd(5)} ${endpoint.padEnd(30)} - ${name}`);
      console.error(`         Error: ${err.message}`);
      failed++;
      return null;
    }
  }

  // 1. Health check
  await test('System Health & Active Headcounts', 'GET', '/health', null, (data) => {
    if (data.status !== 'ONLINE') throw new Error('Status is not ONLINE');
    if (!data.activeWorkers) throw new Error('Missing activeWorkers');
  });

  // 2. Static Root Demo Serving
  await test('Web Dashboard Frontend Index.html', 'GET', '/', null, (data) => {
    if (typeof data !== 'string' || !data.includes('GWMS')) {
      throw new Error('Frontend HTML not returned');
    }
  });

  // 3. Workers list
  const workersData = await test('Get All Field Workers', 'GET', '/api/workers', null, (data) => {
    if (!data.success || !Array.isArray(data.workers) || data.workers.length === 0) {
      throw new Error('Invalid workers payload');
    }
    // Verify privacy firewall on Marcus Brody
    const marcus = data.workers.find((w) => w.id === 'worker-marcus');
    if (!marcus || !marcus.isMasked || marcus.currentLocation !== null) {
      throw new Error('Medical leave privacy firewall failed for Marcus Brody');
    }
  });

  // 4. Geofences list
  await test('Get All Geofence Zones', 'GET', '/api/geofences', null, (data) => {
    if (!data.success || !Array.isArray(data.geofences) || data.geofences.length === 0) {
      throw new Error('Invalid geofences payload');
    }
  });

  // 5. Create new Geofence
  const newZone = await test(
    'Create Custom Geofence Zone',
    'POST',
    '/api/geofences',
    {
      name: 'Automated Test Substation Alpha',
      type: 'CIRCULAR',
      center: { latitude: 37.785, longitude: -122.42 },
      radiusMeters: 300,
      bufferMeters: 45,
      color: '#10B981',
    },
    (data) => {
      if (!data.success || !data.geofence.id) throw new Error('Failed creating geofence');
    }
  );

  // 6. Alerts list
  const alertsData = await test('Get Incident Alerts Feed', 'GET', '/api/alerts', null, (data) => {
    if (!data.success || !Array.isArray(data.alerts)) throw new Error('Invalid alerts payload');
  });

  // 7. Acknowledge Alert
  if (alertsData && alertsData.alerts && alertsData.alerts.length > 0) {
    const alertId = alertsData.alerts[0].id;
    await test(`Acknowledge Alert (${alertId})`, 'POST', `/api/alerts/${alertId}/ack`, null, (data) => {
      if (!data.success || !data.alert.acknowledged) throw new Error('Failed acknowledging alert');
    });
  }

  // 8. Ingest Telemetry
  await test(
    'Ingest Telemetry (Mobile Client Fix)',
    'POST',
    '/api/telemetry/ingest',
    {
      workerId: 'worker-alex',
      telemetry: {
        latitude: 37.775,
        longitude: -122.419,
        accuracyMeters: 5.0,
        batteryPercent: 87,
        timestamp: Date.now(),
      },
    },
    (data) => {
      if (!data.success) throw new Error('Failed ingesting telemetry');
    }
  );

  // 9. Update Worker Status (Remote)
  await test(
    'Update Worker Status to Remote Work',
    'POST',
    '/api/workers/worker-samantha/status',
    {
      status: 'APPROVED_REMOTE',
      leaveType: 'REMOTE',
    },
    (data) => {
      if (!data.success || data.worker.status !== 'APPROVED_REMOTE') {
        throw new Error('Failed updating worker status to remote');
      }
    }
  );

  // 10. Update Worker Status (Medical Leave Privacy)
  await test(
    'Update Worker Status to Medical Leave (Privacy Firewall)',
    'POST',
    '/api/workers/worker-alex/status',
    {
      status: 'MEDICAL_LEAVE',
      leaveType: 'MEDICAL',
    },
    (data) => {
      if (!data.success || data.worker.currentLocation !== null) {
        throw new Error('Privacy firewall failed to nullify coordinates on medical leave');
      }
    }
  );

  // 11. Trigger Emergency SOS
  await test(
    'Trigger Lone-Worker Emergency SOS Beacon',
    'POST',
    '/api/workers/worker-carlos/sos',
    null,
    (data) => {
      if (!data.success || data.worker.status !== 'EMERGENCY_SOS') {
        throw new Error('Failed to trigger emergency SOS');
      }
    }
  );

  // 12. Simulation Scenario Trigger
  await test(
    'Trigger Automated Scenario (AUTO_CHECKIN_DWELL)',
    'POST',
    '/api/simulation/scenario',
    { scenario: 'AUTO_CHECKIN_DWELL' },
    (data) => {
      if (!data.success) throw new Error('Failed triggering simulation scenario');
    }
  );

  // 13. Simulation Speed
  await test(
    'Set Simulation Speed to 5x',
    'POST',
    '/api/simulation/speed',
    { speed: 5 },
    (data) => {
      if (!data.success || data.speed !== 5) throw new Error('Failed updating simulation speed');
    }
  );

  // 14. Timesheet & Overtime Audit Report
  await test(
    'Get Timesheet & Overtime Financial Report',
    'GET',
    '/api/reports/timesheet',
    null,
    (data) => {
      if (!data.success || !Array.isArray(data.report) || data.report.length === 0) {
        throw new Error('Failed generating timesheet report');
      }
      const item = data.report[0];
      if (item.totalPay === undefined || item.regularPay === undefined) {
        throw new Error('Timesheet calculation missing financial numbers');
      }
    }
  );

  // 15. Simulation Reset to Baseline
  await test(
    'Reset Simulation State to Baseline Seeds',
    'POST',
    '/api/simulation/reset',
    null,
    (data) => {
      if (!data.success) throw new Error('Failed resetting simulation');
    }
  );

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
