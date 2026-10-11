/**
 * @file PrivacyRoster.jsx
 * @description Dedicated Management Roster for Approved Remote Telecommute & Medical Leaves.
 * Compliant with GDPR/Labor regulations by maintaining strict privacy isolation.
 */

import React from 'react';
import {
  Shield,
  HeartPulse,
  Home,
  Clock,
  EyeOff,
  UserCheck,
  CheckCircle,
  FileText,
} from 'lucide-react';

export function PrivacyRoster({
  workers = [],
  onSelectWorker = () => {},
  onApproveRemote = () => {},
  onApproveMedical = () => {},
}) {
  const leaveWorkers = workers.filter(
    (w) =>
      w.status === 'MEDICAL_LEAVE' ||
      w.leaveType === 'MEDICAL' ||
      w.status === 'APPROVED_REMOTE' ||
      w.leaveType === 'REMOTE'
  );

  return (
    <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Approved Remote & Medical Leave Roster</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Protected status tracking for field workers on verified remote telecommute or confidential medical leave.
          </p>
        </div>

        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          {leaveWorkers.length} Active Leaves
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {leaveWorkers.map((worker) => {
          const isMedical = worker.status === 'MEDICAL_LEAVE' || worker.leaveType === 'MEDICAL';

          return (
            <div
              key={worker.id}
              onClick={() => onSelectWorker(worker.id)}
              className={`p-4 rounded-xl border transition cursor-pointer group ${
                isMedical
                  ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  : 'bg-blue-950/20 border-blue-900/40 hover:border-blue-700/60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <img
                    src={worker.photoUrl}
                    alt={worker.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-700"
                  />
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      isMedical ? 'bg-slate-700' : 'bg-blue-600'
                    }`}
                  >
                    {isMedical ? <HeartPulse className="w-3 h-3 text-rose-400" /> : <Home className="w-3 h-3 text-white" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition truncate">
                      {worker.name}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isMedical
                          ? 'bg-slate-800 text-slate-300 border-slate-700'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {isMedical ? 'MEDICAL LEAVE' : 'REMOTE WORK'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{worker.role} • {worker.department}</p>

                  {/* Privacy Badge */}
                  <div className="mt-2 text-[11px] space-y-1">
                    {isMedical ? (
                      <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                        <EyeOff className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">
                          <strong>Privacy Firewall:</strong> Coordinates Masked (No Map Pin)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-blue-300 bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-800/40">
                        <Home className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">
                          Authorized Home Perimeter (150m Ephemeral Geofence)
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>Shift: {worker.shift?.scheduledStart} - {worker.shift?.scheduledEnd}</span>
                      <span>Battery: {worker.batteryPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
