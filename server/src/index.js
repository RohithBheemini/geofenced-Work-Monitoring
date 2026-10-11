/**
 * @file index.js
 * @description Main server entrypoint for Geofenced Workforce Monitoring System.
 * Supports unified static hosting of client/dist and real-time Socket.io.
 */

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { INITIAL_WORKERS, INITIAL_GEOFENCES, INITIAL_ALERTS } from './data/seedData.js';
import { TelemetrySimulator } from './simulation/telemetrySimulator.js';
import { createApiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
const server = http.createServer(app);

// Enable CORS for client
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);
app.use(express.json());

// Socket.io for sub-second telemetry and alerts
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory state initialized with seed data
const workers = JSON.parse(JSON.stringify(INITIAL_WORKERS));
const geofences = JSON.parse(JSON.stringify(INITIAL_GEOFENCES));
const alerts = JSON.parse(JSON.stringify(INITIAL_ALERTS));

// Initialize and start simulation engine
const simulator = new TelemetrySimulator(workers, geofences, alerts, io);
simulator.start();

// Mount REST APIs
app.use('/api', createApiRouter(workers, geofences, alerts, simulator));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Geofenced Workforce Monitoring System (GWMS)',
    activeWorkers: workers.length,
    activeGeofences: geofences.length,
    timestamp: new Date().toISOString(),
  });
});

// Serve static frontend build if present
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Socket.io connection lifecycle
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial snapshot
  simulator.broadcastState();

  // Handle client-initiated telemetry packet
  socket.on('telemetry:send', (data) => {
    if (data && data.workerId && data.telemetry) {
      simulator.ingestTelemetry(data.workerId, data.telemetry);
    }
  });

  // Handle simulation scenario requests from client
  socket.on('simulation:trigger', (scenarioName) => {
    simulator.runScenario(scenarioName);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`  Geofenced Workforce Monitoring System (GWMS) ONLINE`);
  console.log(`  Unified Dashboard URL: http://localhost:${PORT}`);
  console.log(`  Health Check:          http://localhost:${PORT}/health`);
  console.log(`  REST API Workers:      http://localhost:${PORT}/api/workers`);
  console.log(`================================================================`);
});
