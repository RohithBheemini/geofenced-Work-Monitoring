/**
 * @file WorkerDrawer.jsx
 * @description Slide-out inspection drawer for detailed worker telemetry,
 * shift progress gauges, continuous overtime tracking, and manager override actions.
 */

import {
  X,
  Battery,
  MapPin,
  Clock,
  DollarSign,
  Shield,
  AlertTriangle,
  Building,
  Navigation,
  Phone,
  Home,
  HeartPulse,
} from 'lucide-react';

export function WorkerDrawer({
  worker,
  geofences = [],
  onClose = () => {},
  onPanToWorker = () => {},
  onUpdateStatus = () => {},
  onTriggerSos = () => {},
}) {
  if (!worker) return null;

  const assignedZone = geofences.find((g) => g.id === worker.assignedZoneId);
  const ot = worker.overtime || {};

  const formatHours = (seconds = 0) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="absolute top-0 right-0 h-full w-96 max-w-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-20 flex flex-col text-slate-100 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-slate-300">
            Field Worker Telemetry
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Profile Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <img
            src={worker.photoUrl}
            alt={worker.name}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-500/50 shadow-md"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white truncate">{worker.name}</h3>
            <p className="text-xs text-slate-400 truncate">{worker.role}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
              <Building className="w-3 h-3 text-slate-500" />
              <span>{worker.department}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Phone className="w-3 h-3 text-slate-500" />
              <span>{worker.phone}</span>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Duty Lifecycle State:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                worker.status === 'CHECKED_IN_NORMAL'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : worker.status === 'OVERTIME_TIER_1'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                  : worker.status === 'OVERTIME_TIER_2'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                  : worker.status === 'OUT_OF_BOUNDS_WARNING'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : worker.status === 'APPROVED_REMOTE'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : worker.status === 'MEDICAL_LEAVE'
                  ? 'bg-slate-700 text-slate-300 border border-slate-600'
                  : 'bg-slate-700/50 text-slate-400'
              }`}
            >
              {worker.status.replace(/_/g, ' ')}
            </span>
          </div>

          {worker.isMasked && (
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-300 flex items-start gap-2">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Firewall Active:</strong> Geographic coordinates scrubbed in accordance with GDPR Art. 9 & labor regulations.
              </span>
            </div>
          )}

          {worker.shift?.egressGraceRemainingSeconds !== undefined && worker.status === 'OUT_OF_BOUNDS_WARNING' && (
            <div className="p-2 rounded-lg bg-orange-950/40 border border-orange-700/50 text-[11px] text-orange-300 flex items-center justify-between">
              <span>Egress Grace Countdown:</span>
              <span className="font-mono font-bold text-orange-400 text-xs">
                {worker.shift.egressGraceRemainingSeconds}s remaining
              </span>
            </div>
          )}
        </div>

        {/* Live Overtime & Timesheet Financial Accrual */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Live Overtime Accrual Engine</span>
            </div>
            {ot.overtimeActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                {ot.currentTierMultiplier}x Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Total Shift Elapsed</span>
              <span className="font-mono font-bold text-white text-sm">
                {formatHours(ot.totalDurationSeconds || 0)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Base Regular Pay</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                ${(ot.regularPay || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Tier 1 OT (1.5x)</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {formatHours(ot.tier1OtDurationSeconds || 0)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                +${(ot.tier1OtPay || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Tier 2 OT (2.0x)</span>
              <span className="font-mono font-bold text-red-400 text-sm">
                {formatHours(ot.tier2OtDurationSeconds || 0)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                +${(ot.tier2OtPay || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Estimated Gross Payout:</span>
            <span className="font-mono text-base font-extrabold text-emerald-400">
              ${(ot.totalPay || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Telemetry Hardware Vitals */}
        <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-2.5 text-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Hardware & Geofence Vitals
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mobile Battery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    worker.batteryPercent > 50
                      ? 'bg-emerald-500'
                      : worker.batteryPercent > 20
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${worker.batteryPercent}%` }}
                />
              </div>
              <span className="font-mono text-white font-semibold">{worker.batteryPercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span>GPS Accuracy</span>
            </div>
            <span className="font-mono text-slate-200">
              {worker.gpsAccuracy ? `±${worker.gpsAccuracy}m (Gated < 30m)` : 'Masked'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Building className="w-3.5 h-3.5 text-purple-400" />
              <span>Assigned Geofence</span>
            </div>
            <span className="text-slate-200 font-medium truncate max-w-[160px]">
              {assignedZone ? assignedZone.name : 'None'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Scheduled Shift</span>
            </div>
            <span className="font-mono text-slate-200">
              {worker.shift?.scheduledStart} - {worker.shift?.scheduledEnd}
            </span>
          </div>
        </div>

        {/* Manager Actions & Overrides */}
        <div className="space-y-2 pt-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Operational Actions
          </div>

          {worker.currentLocation && (
            <button
              onClick={() => onPanToWorker(worker)}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Center & Track on Live Map</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdateStatus(worker.id, 'MEDICAL_LEAVE', 'MEDICAL')}
              className="py-2 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700/60 transition"
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
              <span>Medical Leave</span>
            </button>
            <button
              onClick={() => onUpdateStatus(worker.id, 'APPROVED_REMOTE', 'REMOTE')}
              className="py-2 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700/60 transition"
            >
              <Home className="w-3.5 h-3.5 text-blue-400" />
              <span>Remote Work</span>
            </button>
          </div>

          <button
            onClick={() => onTriggerSos(worker.id)}
            className="w-full py-2 px-3 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-200 text-xs font-semibold flex items-center justify-center gap-2 border border-red-700/60 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Simulate Lone-Worker SOS Alarm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
