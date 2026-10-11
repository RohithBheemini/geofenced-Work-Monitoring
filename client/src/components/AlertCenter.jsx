/**
 * @file AlertCenter.jsx
 * @description Real-time Manager Alert Center & Incident Feed with audible notifications.
 */

import React, { useState } from 'react';
import {
  Bell,
  Volume2,
  VolumeX,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle,
  MapPin,
  Clock,
  X,
  Filter,
} from 'lucide-react';
import { soundManager } from '../services/soundEffects.js';

export function AlertCenter({
  alerts = [],
  isOpen = false,
  onClose = () => {},
  onAcknowledge = () => {},
  onLocateAlert = () => {},
}) {
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [isMuted, setIsMuted] = useState(soundManager.muted);

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filterSeverity === 'ALL') return true;
    return alert.severity === filterSeverity;
  });

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 w-96 max-w-[90vw] max-h-[80vh] bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-30 flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-amber-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
            Manager Alert Feed
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-lg border transition ${
              isMuted
                ? 'bg-slate-800 border-slate-700 text-slate-500'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            }`}
            title={isMuted ? 'Unmute alert sirens' : 'Mute alerts'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-slate-950/30 border-b border-slate-800/80 flex items-center gap-2 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-500" />
        <button
          onClick={() => setFilterSeverity('ALL')}
          className={`px-2 py-0.5 rounded-md font-medium transition ${
            filterSeverity === 'ALL'
              ? 'bg-slate-700 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({alerts.length})
        </button>
        <button
          onClick={() => setFilterSeverity('CRITICAL')}
          className={`px-2 py-0.5 rounded-md font-medium transition ${
            filterSeverity === 'CRITICAL'
              ? 'bg-red-500/30 text-red-300 font-bold border border-red-500/40'
              : 'text-red-400 hover:text-red-300'
          }`}
        >
          Critical
        </button>
        <button
          onClick={() => setFilterSeverity('WARNING')}
          className={`px-2 py-0.5 rounded-md font-medium transition ${
            filterSeverity === 'WARNING'
              ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
              : 'text-amber-400 hover:text-amber-300'
          }`}
        >
          Warning
        </button>
        <button
          onClick={() => setFilterSeverity('INFO')}
          className={`px-2 py-0.5 rounded-md font-medium transition ${
            filterSeverity === 'INFO'
              ? 'bg-blue-500/30 text-blue-300 font-bold border border-blue-500/40'
              : 'text-blue-400 hover:text-blue-300'
          }`}
        >
          Info
        </button>
      </div>

      {/* Alert Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No incident alerts in this filter category.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';

            return (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border transition ${
                  isCritical
                    ? 'bg-red-950/30 border-red-800/60 shadow-lg shadow-red-950/20'
                    : isWarning
                    ? 'bg-amber-950/25 border-amber-800/50'
                    : 'bg-slate-800/40 border-slate-700/50'
                } ${alert.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isCritical ? (
                      <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-bold ${
                        isCritical
                          ? 'text-red-300'
                          : isWarning
                          ? 'text-amber-300'
                          : 'text-blue-300'
                      }`}
                    >
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs text-slate-200 mt-1 leading-snug">
                  {alert.message}
                </p>

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400 font-medium">
                    {alert.workerName || 'System'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLocateAlert(alert)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition"
                      title="Focus on map"
                    >
                      <MapPin className="w-3 h-3 text-cyan-400" />
                      <span>Locate</span>
                    </button>

                    {!alert.acknowledged ? (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1 transition font-medium"
                      >
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>Ack</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-slate-500" />
                        <span>Acknowledged</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
