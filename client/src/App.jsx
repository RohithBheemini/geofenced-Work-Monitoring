/**
 * @file App.jsx
 * @description Main application controller connecting real-time WebSockets,
 * Live Leaflet Map, Mobile Field Worker simulator, Overtime audits, and Alert feeds.
 */

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import {
  MapPin,
  Smartphone,
  Shield,
  Bell,
  DollarSign,
  Plus,
  Play,
  Compass,
  FileSpreadsheet,
} from 'lucide-react';

import { MapComponent } from './components/MapComponent.jsx';
import { WorkerDrawer } from './components/WorkerDrawer.jsx';
import { AlertCenter } from './components/AlertCenter.jsx';
import { OvertimeModal } from './components/OvertimeModal.jsx';
import { GeofenceModal } from './components/GeofenceModal.jsx';
import { MobileWorkerApp } from './components/MobileWorkerApp.jsx';
import { SimulationController } from './components/SimulationController.jsx';
import { PrivacyRoster } from './components/PrivacyRoster.jsx';
import { soundManager } from './services/soundEffects.js';

export default function App() {
  const [workers, setWorkers] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [focusCoordinate, setFocusCoordinate] = useState(null);
  const [currentView, setCurrentView] = useState('MAP'); // 'MAP' | 'MOBILE' | 'ROSTER' | 'SIMULATION'
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isOvertimeOpen, setIsOvertimeOpen] = useState(false);
  const [isGeofenceOpen, setIsGeofenceOpen] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // 1. WebSocket & Initial REST Hydration
  useEffect(() => {
    // Fetch initial state
    fetch('/api/workers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setWorkers(data.workers);
      })
      .catch((err) => console.error('Fetch workers error:', err));

    fetch('/api/geofences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setGeofences(data.geofences);
      })
      .catch((err) => console.error('Fetch geofences error:', err));

    fetch('/api/alerts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAlerts(data.alerts);
      })
      .catch((err) => console.error('Fetch alerts error:', err));

    // Connect WebSocket
    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('telemetry:workers', (updatedWorkers) => {
      setWorkers(updatedWorkers);
    });

    socket.on('telemetry:alerts', (updatedAlerts) => {
      setAlerts(updatedAlerts);
    });

    socket.on('alert:new', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);

      // Sound alerts
      if (newAlert.severity === 'CRITICAL' || newAlert.type === 'EMERGENCY_SOS') {
        soundManager.playSiren();
      } else if (newAlert.severity === 'WARNING') {
        soundManager.playWarningBeep();
      } else {
        soundManager.playChime();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Handlers
  const handleSelectWorker = (id) => {
    setSelectedWorkerId(id);
    const worker = workers.find((w) => w.id === id);
    if (worker && worker.currentLocation) {
      setFocusCoordinate(worker.currentLocation);
    }
  };

  const handlePanToWorker = (worker) => {
    if (worker && worker.currentLocation) {
      setFocusCoordinate(worker.currentLocation);
    }
  };

  const handleLocateAlert = (alert) => {
    if (alert.workerId) {
      const worker = workers.find((w) => w.id === alert.workerId);
      if (worker && worker.currentLocation) {
        setFocusCoordinate(worker.currentLocation);
        setSelectedWorkerId(worker.id);
        setCurrentView('MAP');
        setIsAlertOpen(false);
        return;
      }
    }
    if (alert.zoneId) {
      const zone = geofences.find((g) => g.id === alert.zoneId);
      if (zone && zone.center) {
        setFocusCoordinate(zone.center);
        setCurrentView('MAP');
        setIsAlertOpen(false);
      }
    }
  };

  const handleAcknowledgeAlert = (id) => {
    fetch(`/api/alerts/${id}/ack`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAlerts((prev) =>
            prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
          );
        }
      });
  };

  const handleSendTelemetry = (workerId, telemetry) => {
    if (socketRef.current) {
      socketRef.current.emit('telemetry:send', { workerId, telemetry });
    } else {
      fetch('/api/telemetry/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, telemetry }),
      });
    }
  };

  const handleUpdateStatus = (workerId, status, leaveType) => {
    fetch(`/api/workers/${workerId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, leaveType }),
    });
  };

  const handleTriggerSos = (workerId) => {
    fetch(`/api/workers/${workerId}/sos`, { method: 'POST' });
  };

  const handleRunScenario = (scenario) => {
    if (socketRef.current) {
      socketRef.current.emit('simulation:trigger', scenario);
    } else {
      fetch('/api/simulation/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
    }
  };

  const handleSetSpeed = (speed) => {
    setSimulationSpeed(speed);
    fetch('/api/simulation/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed }),
    });
  };

  const handleResetSimulation = () => {
    fetch('/api/simulation/reset', { method: 'POST' });
  };

  const handleCreateZone = (newZoneData) => {
    fetch('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newZoneData),
    });
  };

  // Aggregated Header Counters
  const onSiteCount = workers.filter((w) => w.status === 'CHECKED_IN_NORMAL').length;
  const overtimeCount = workers.filter(
    (w) => w.status === 'OVERTIME_TIER_1' || w.status === 'OVERTIME_TIER_2'
  ).length;
  const remoteCount = workers.filter(
    (w) => w.status === 'APPROVED_REMOTE' || w.leaveType === 'REMOTE'
  ).length;
  const medicalCount = workers.filter(
    (w) => w.status === 'MEDICAL_LEAVE' || w.leaveType === 'MEDICAL'
  ).length;
  const unreadAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  const totalOvertimeCost = workers.reduce((acc, w) => {
    return acc + (w.overtime?.overtimeExtraPay || 0);
  }, 0);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Operations Header */}
      <header className="h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/90 px-4 flex items-center justify-between shrink-0 z-40">
        {/* Left: Branding & Connection Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-wider uppercase text-white">
                GWMS Command Center
              </h1>
              <span
                className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                {isConnected ? 'LIVE 60FPS' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Autonomous Geofenced Attendance & Continuous Overtime Governance
            </p>
          </div>
        </div>

        {/* Center: Live KPI Metric Badges */}
        <div className="hidden lg:flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-400">On-Site:</span>
            <span className="font-mono font-bold text-white">{onSiteCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-slate-400">Overtime:</span>
            <span className="font-mono font-bold text-amber-400">{overtimeCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-slate-400">Remote:</span>
            <span className="font-mono font-bold text-blue-400">{remoteCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
            <span className="text-slate-400">Medical:</span>
            <span className="font-mono font-bold text-slate-300">{medicalCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">OT Liability:</span>
            <span className="font-mono font-bold text-emerald-400">
              ${totalOvertimeCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Right: View Toggles & Actions */}
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setCurrentView('MAP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'MAP'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Live Map</span>
            </button>
            <button
              onClick={() => setCurrentView('MOBILE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'MOBILE'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Mobile Client</span>
            </button>
            <button
              onClick={() => setCurrentView('ROSTER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'ROSTER'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Leave Roster</span>
            </button>
            <button
              onClick={() => setCurrentView('SIMULATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'SIMULATION'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Simulations</span>
            </button>
          </div>

          {/* Overtime Audit Modal Trigger */}
          <button
            onClick={() => setIsOvertimeOpen(true)}
            className="py-1.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 border border-emerald-700/60 transition shadow-sm"
            title="Overtime Audit Timesheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Overtime Audit</span>
          </button>

          {/* New Geofence Trigger */}
          <button
            onClick={() => setIsGeofenceOpen(true)}
            className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition"
            title="Add Geofence"
          >
            <Plus className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline">New Geofence</span>
          </button>

          {/* Alert Center Trigger */}
          <button
            onClick={() => setIsAlertOpen(!isAlertOpen)}
            className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            title="Alert Feed"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white ring-2 ring-slate-950 animate-pulse">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 relative overflow-hidden flex">
        {/* VIEW: LIVE MAP DASHBOARD */}
        {currentView === 'MAP' && (
          <div className="w-full h-full relative">
            <MapComponent
              workers={workers}
              geofences={geofences}
              selectedWorkerId={selectedWorkerId}
              onSelectWorker={handleSelectWorker}
              focusCoordinate={focusCoordinate}
            />

            {/* Slide-out Inspector Drawer */}
            {selectedWorker && (
              <WorkerDrawer
                worker={selectedWorker}
                geofences={geofences}
                onClose={() => setSelectedWorkerId(null)}
                onPanToWorker={handlePanToWorker}
                onUpdateStatus={handleUpdateStatus}
                onTriggerSos={handleTriggerSos}
              />
            )}
          </div>
        )}

        {/* VIEW: MOBILE FIELD WORKER APPLICATION */}
        {currentView === 'MOBILE' && (
          <div className="w-full h-full overflow-y-auto bg-slate-900/60 flex items-center justify-center py-6">
            <MobileWorkerApp
              workers={workers}
              geofences={geofences}
              selectedWorkerId={selectedWorkerId}
              onSelectWorker={handleSelectWorker}
              onSendTelemetry={handleSendTelemetry}
              onUpdateStatus={handleUpdateStatus}
              onTriggerSos={handleTriggerSos}
            />
          </div>
        )}

        {/* VIEW: APPROVED LEAVES & PRIVACY ROSTER */}
        {currentView === 'ROSTER' && (
          <div className="w-full h-full overflow-y-auto p-6 bg-slate-900/40">
            <div className="max-w-5xl mx-auto space-y-6">
              <PrivacyRoster
                workers={workers}
                onSelectWorker={handleSelectWorker}
                onApproveRemote={(id) => handleUpdateStatus(id, 'APPROVED_REMOTE', 'REMOTE')}
                onApproveMedical={(id) => handleUpdateStatus(id, 'MEDICAL_LEAVE', 'MEDICAL')}
              />
            </div>
          </div>
        )}

        {/* VIEW: SIMULATION CONTROLLER */}
        {currentView === 'SIMULATION' && (
          <div className="w-full h-full overflow-y-auto p-6 bg-slate-900/40">
            <div className="max-w-5xl mx-auto space-y-6">
              <SimulationController
                simulationSpeed={simulationSpeed}
                onSetSpeed={handleSetSpeed}
                onRunScenario={handleRunScenario}
                onReset={handleResetSimulation}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating Alert Feed Drawer */}
      <AlertCenter
        alerts={alerts}
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        onAcknowledge={handleAcknowledgeAlert}
        onLocateAlert={handleLocateAlert}
      />

      {/* Overtime & Timesheet Audit Modal */}
      <OvertimeModal
        isOpen={isOvertimeOpen}
        onClose={() => setIsOvertimeOpen(false)}
        workers={workers}
      />

      {/* Geofence Creation Modal */}
      <GeofenceModal
        isOpen={isGeofenceOpen}
        onClose={() => setIsGeofenceOpen(false)}
        onCreateZone={handleCreateZone}
      />
    </div>
  );
}
