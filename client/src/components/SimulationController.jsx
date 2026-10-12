/**
 * @file SimulationController.jsx
 * @description Simulation Control Center for demonstrating automated geofencing,
 * dwell timing, overtime accrual, and privacy firewalls.
 */

import React from 'react';
import {
  Play,
  FastForward,
  RotateCcw,
  Zap,
  AlertTriangle,
  Clock,
  Compass,
  Home,
  HeartPulse,
} from 'lucide-react';

export function SimulationController({
  simulationSpeed = 1,
  onSetSpeed = () => {},
  onRunScenario = () => {},
  onReset = () => {},
}) {
  const scenarios = [
    {
      id: 'AUTO_CHECKIN_DWELL',
      title: 'Morning Ingress & Auto Check-in',
      desc: 'Samantha Reed enters East Bay Substation; begins 180s dwell, auto-checks in.',
      icon: Compass,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'OVERTIME_ESCALATION',
      title: 'Overtime Escalation (8h Limit)',
      desc: 'Alex Carter approaches 8h standard shift, triggers Tier 1 OT (1.5x multiplier).',
      icon: Clock,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      id: 'GEOFENCE_BREACH',
      title: 'Perimeter Egress & Breach Grace',
      desc: 'David Kim crosses perimeter; starts 300s egress grace countdown then breach.',
      icon: AlertTriangle,
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    },
    {
      id: 'MEDICAL_LEAVE_ACTIVATION',
      title: 'Medical Leave Privacy Firewall',
      desc: 'Alex Carter granted medical leave; GPS completely killed and coordinates scrubbed.',
      icon: HeartPulse,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    },
    {
      id: 'EMERGENCY_SOS',
      title: 'Lone-Worker Emergency SOS Beacon',
      desc: 'Carlos Mendez triggers distress beacon; emergency sirens and dispatch alert.',
      icon: Zap,
      color: 'text-red-400 bg-red-500/10 border-red-500/30',
    },
    {
      id: 'REMOTE_WORK_APPROVED',
      title: 'Approved Remote Telecommute',
      desc: 'Priya Patel switches to remote work; provisions ephemeral 150m home boundary.',
      icon: Home,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
  ];

  return (
    <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-4">
      {/* Header and Speed Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Interactive Scenario Simulator</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Trigger automated events to evaluate geofencing hysteresis, dwell counters, and overtime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 px-2 flex items-center gap-1">
              <FastForward className="w-3 h-3 text-cyan-400" />
              <span>Speed:</span>
            </span>
            {[1, 5, 10, 30].map((spd) => (
              <button
                key={spd}
                onClick={() => onSetSpeed(spd)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                  simulationSpeed === spd
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Reset Baseline */}
          <button
            onClick={onReset}
            className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Scenario Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          return (
            <button
              key={sc.id}
              onClick={() => onRunScenario(sc.id)}
              className="text-left p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition group flex flex-col justify-between"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`p-2 rounded-lg border ${sc.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition truncate">
                  {sc.title}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {sc.desc}
              </p>
              <div className="mt-2 text-[10px] text-cyan-400 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Simulate Scenario Now</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
