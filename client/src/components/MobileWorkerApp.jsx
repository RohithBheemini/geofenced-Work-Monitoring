/**
 * @file MobileWorkerApp.jsx
 * @description Mobile Field Worker Application simulator with automated geofencing,
 * ingress dwell countdown, continuous overtime tracking, and privacy firewalls.
 */

import { useState, useEffect } from 'react';
import {
  Compass,
  Clock,
  Shield,
  Battery,
  Wifi,
  WifiOff,
  AlertTriangle,
  MapPin,
  HeartPulse,
  Home,
  Navigation,
  CheckCircle,
} from 'lucide-react';

export function MobileWorkerApp({
  workers = [],
  geofences = [],
  selectedWorkerId,
  onSelectWorker = () => {},
  onSendTelemetry = () => {},
  onUpdateStatus = () => {},
  onTriggerSos = () => {},
}) {
  const [internalWorkerId, setInternalWorkerId] = useState(null);
  const [isDeadZone, setIsDeadZone] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [useDeviceGps, setUseDeviceGps] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const activeWorkerId = selectedWorkerId || internalWorkerId || (workers[0] ? workers[0].id : '');
  const worker = workers.find((w) => w.id === activeWorkerId) || workers[0];
  const assignedZone = geofences.find((g) => g.id === worker?.assignedZoneId);
  const ot = worker?.overtime || {};

  // Real device GPS listener
  useEffect(() => {
    if (!useDeviceGps || !navigator.geolocation || !worker) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const payload = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          speedMps: pos.coords.speed || 0,
          timestamp: pos.timestamp,
          batteryPercent: worker.batteryPercent,
        };

        if (isDeadZone) {
          setOfflineQueue((q) => [...q, payload]);
        } else {
          onSendTelemetry(worker.id, payload);
        }
      },
      (err) => {
        console.warn('Device GPS error:', err.message);
        setStatusMessage(`GPS warning: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [useDeviceGps, isDeadZone, worker, onSendTelemetry]);

  if (!worker) return null;

  // Unified Simulate Step (Inside or Outside)
  const simulateStep = (isInside) => {
    if (!assignedZone) return;
    let targetLat = 37.7749;
    let targetLng = -122.4194;

    if (assignedZone.type === 'CIRCULAR') {
      const offset = isInside ? 0.0003 : 0.008;
      targetLat = assignedZone.center.latitude + offset;
      targetLng = assignedZone.center.longitude + (isInside ? 0.0002 : 0.008);
    } else if (isInside && assignedZone.vertices?.[0]) {
      targetLat = assignedZone.vertices[0].latitude;
      targetLng = assignedZone.vertices[0].longitude;
    } else {
      targetLat += 0.008;
      targetLng += 0.008;
    }

    const telemetry = {
      latitude: targetLat,
      longitude: targetLng,
      accuracyMeters: isInside ? 4.5 : 6.0,
      batteryPercent: worker.batteryPercent,
      timestamp: Date.now(),
    };

    if (isDeadZone) {
      setOfflineQueue((prev) => [...prev, telemetry]);
      setStatusMessage(isInside ? 'Fix buffered in offline encrypted queue.' : 'Fix buffered in offline queue.');
    } else {
      onSendTelemetry(worker.id, telemetry);
      setStatusMessage(
        isInside
          ? `Emitted GPS fix inside ${assignedZone.name}.`
          : 'Emitted GPS fix outside perimeter. Egress grace armed.'
      );
    }
  };

  // Toggle Dead Zone
  const toggleDeadZone = () => {
    if (isDeadZone) {
      // Reconnected! Flush offline queue
      if (offlineQueue.length > 0) {
        offlineQueue.forEach((item) => {
          onSendTelemetry(worker.id, item);
        });
        setStatusMessage(`Cellular restored! Flushed ${offlineQueue.length} offline records to server.`);
        setOfflineQueue([]);
      }
      setIsDeadZone(false);
    } else {
      setIsDeadZone(true);
      setStatusMessage('Cellular dead-zone active: Telemetry stored in edge SQLite buffer.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Smartphone Device Frame */}
      <div className="w-[370px] h-[780px] bg-slate-950 rounded-[48px] border-[10px] border-slate-800 shadow-2xl relative flex flex-col overflow-hidden text-slate-100 ring-1 ring-slate-700/50">
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-30 flex items-center justify-center">
          <div className="w-10 h-3.5 bg-black rounded-full flex items-center justify-end px-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>

        {/* Mobile Top Status Bar */}
        <div className="pt-2 px-6 pb-1 flex items-center justify-between text-[11px] text-slate-400 z-20 font-medium">
          <span>09:41</span>
          <div className="flex items-center gap-2">
            {isDeadZone ? (
              <span className="flex items-center gap-1 text-red-400 font-bold text-[10px]">
                <WifiOff className="w-3 h-3" /> No Service
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-300">
                <Wifi className="w-3 h-3" /> 5G
              </span>
            )}
            <div className="flex items-center gap-1">
              <span>{worker.batteryPercent}%</span>
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Worker Switcher Bar */}
        <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Field Client:</span>
          <select
            value={activeWorkerId}
            onChange={(e) => {
              setInternalWorkerId(e.target.value);
              onSelectWorker(e.target.value);
            }}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1 text-white font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.role.split(' ')[0]})
              </option>
            ))}
          </select>
        </div>

        {/* Main Mobile Screen Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Worker Badge */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
            <img
              src={worker.photoUrl}
              alt={worker.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/60"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{worker.name}</h2>
              <p className="text-[11px] text-slate-400 truncate">{worker.role}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  {worker.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy Firewall Banner (If Medical Leave) */}
          {worker.isMasked && (
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-200 flex items-start gap-2.5">
              <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white text-xs">Privacy Firewall Active</strong>
                <p className="text-[11px] text-cyan-300/90 leading-tight mt-0.5">
                  GPS location tracking is disabled by system policy. Zero coordinates are broadcasted.
                </p>
              </div>
            </div>
          )}

          {/* Automated Geofence Radar Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Geofence Radar</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {assignedZone ? assignedZone.name : 'No Zone'}
              </span>
            </div>

            {/* Dwell Progress (Ingress) */}
            {worker.status === 'IN_TRANSIT' && worker.shift?.ingressDwellSeconds !== undefined && (
              <div className="space-y-1.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">180s Ingress Dwell Counter:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {worker.shift.ingressDwellSeconds}s / 180s
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (worker.shift.ingressDwellSeconds / 180) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block text-right">
                  Auto check-in triggers upon 180s continuous dwell.
                </span>
              </div>
            )}

            {/* Egress Grace Countdown */}
            {worker.status === 'OUT_OF_BOUNDS_WARNING' && worker.shift?.egressGraceRemainingSeconds !== undefined && (
              <div className="p-2 rounded-xl bg-orange-950/40 border border-orange-700/50 space-y-1 text-xs">
                <div className="flex items-center justify-between text-orange-300 font-bold">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Egress Grace Active:
                  </span>
                  <span className="font-mono text-orange-400">
                    {worker.shift.egressGraceRemainingSeconds}s
                  </span>
                </div>
                <p className="text-[10px] text-orange-300/80">
                  Return inside perimeter before timer reaches 0 to avoid breach penalty.
                </p>
              </div>
            )}

            {/* On-Site Status Check */}
            {worker.status === 'CHECKED_IN_NORMAL' && (
              <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verified On-Site. Zero-touch geofence active.</span>
              </div>
            )}
          </div>

          {/* Time Tracking & Continuous Overtime Counter */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Shift & Overtime Clock</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {worker.shift?.scheduledStart} - {worker.shift?.scheduledEnd}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Logged Hours</span>
                <span className="font-mono text-white text-base font-bold">
                  {((ot.totalDurationSeconds || 0) / 3600).toFixed(2)}h
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Rate Multiplier</span>
                <span
                  className={`font-mono text-base font-bold ${
                    ot.currentTierMultiplier > 1.0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                  }`}
                >
                  {ot.currentTierMultiplier || 1.0}x
                </span>
              </div>
            </div>

            {ot.overtimeActive && (
              <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200 flex items-center justify-between">
                <span>Overtime Bonus Earned:</span>
                <span className="font-mono font-bold text-amber-300 text-xs">
                  +${(ot.overtimeExtraPay || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Simulated Edge Telemetry Actions */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
              Location Simulation Controls
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => simulateStep(true)}
                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition shadow-md"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Walk Inside Site</span>
              </button>
              <button
                onClick={() => simulateStep(false)}
                className="py-2.5 px-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition shadow-md"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Step Outside</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateStatus(worker.id, 'MEDICAL_LEAVE', 'MEDICAL')}
                className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1 border border-slate-700 transition"
              >
                <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                <span>Medical Leave</span>
              </button>
              <button
                onClick={() => onUpdateStatus(worker.id, 'APPROVED_REMOTE', 'REMOTE')}
                className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1 border border-slate-700 transition"
              >
                <Home className="w-3.5 h-3.5 text-blue-400" />
                <span>Remote Work</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleDeadZone}
                className={`py-2 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${
                  isDeadZone
                    ? 'bg-red-950/60 border-red-700 text-red-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>{isDeadZone ? 'Restore Cellular' : 'Simulate Tunnel'}</span>
              </button>

              <button
                onClick={() => setUseDeviceGps(!useDeviceGps)}
                className={`py-2 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${
                  useDeviceGps
                    ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>{useDeviceGps ? 'Phone GPS On' : 'Use Real GPS'}</span>
              </button>
            </div>

            {/* Lone Worker Distress SOS */}
            <button
              onClick={() => onTriggerSos(worker.id)}
              className="w-full py-3 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition tracking-wide uppercase active:scale-95"
            >
              <AlertTriangle className="w-4 h-4 text-white animate-bounce" />
              <span>Lone-Worker Emergency SOS Beacon</span>
            </button>
          </div>

          {statusMessage && (
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-cyan-300 text-center font-mono">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Mobile Bottom Home Indicator */}
        <div className="py-2 flex items-center justify-center bg-slate-950">
          <div className="w-32 h-1 bg-slate-700 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
