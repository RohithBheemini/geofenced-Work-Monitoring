/**
 * @file OvertimeModal.jsx
 * @description Comprehensive Overtime & Timesheet Financial Audit Modal.
 * Calculates multi-tier overtime liability, rate multipliers, and CSV export.
 */

import React from 'react';
import {
  X,
  DollarSign,
  Download,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

export function OvertimeModal({
  isOpen = false,
  onClose = () => {},
  workers = [],
}) {
  if (!isOpen) return null;

  // Aggregate metrics
  let totalGrossPayroll = 0;
  let totalOvertimeLiability = 0;
  let totalOvertimeHours = 0;
  let totalRegularHours = 0;

  const rows = workers.map((worker) => {
    const ot = worker.overtime || {};
    const regHours = (ot.regularDurationSeconds || 0) / 3600;
    const ot1Hours = (ot.tier1OtDurationSeconds || 0) / 3600;
    const ot2Hours = (ot.tier2OtDurationSeconds || 0) / 3600;
    const nightHours = (ot.nightDiffDurationSeconds || 0) / 3600;
    const totalHours = regHours + ot1Hours + ot2Hours;

    totalRegularHours += regHours;
    totalOvertimeHours += ot1Hours + ot2Hours;
    totalGrossPayroll += ot.totalPay || 0;
    totalOvertimeLiability += ot.overtimeExtraPay || 0;

    return {
      worker,
      regHours: regHours.toFixed(2),
      ot1Hours: ot1Hours.toFixed(2),
      ot2Hours: ot2Hours.toFixed(2),
      nightHours: nightHours.toFixed(2),
      totalHours: totalHours.toFixed(2),
      regularPay: (ot.regularPay || 0).toFixed(2),
      overtimeExtraPay: (ot.overtimeExtraPay || 0).toFixed(2),
      totalPay: (ot.totalPay || 0).toFixed(2),
      multiplier: ot.currentTierMultiplier || 1.0,
      overtimeActive: ot.overtimeActive,
    };
  });

  const exportCsv = () => {
    const headers = [
      'Worker ID',
      'Name',
      'Department',
      'Role',
      'Status',
      'Base Wage ($/hr)',
      'Total Hours',
      'Regular Hours',
      'Tier 1 OT Hours (1.5x)',
      'Tier 2 OT Hours (2.0x)',
      'Night Diff Hours (+0.25x)',
      'Regular Pay ($)',
      'Overtime Extra Pay ($)',
      'Total Gross Pay ($)',
    ];

    const csvRows = [headers.join(',')];

    rows.forEach((r) => {
      csvRows.push(
        [
          r.worker.id,
          `"${r.worker.name}"`,
          `"${r.worker.department}"`,
          `"${r.worker.role}"`,
          `"${r.worker.status}"`,
          r.worker.baseWage.toFixed(2),
          r.totalHours,
          r.regHours,
          r.ot1Hours,
          r.ot2Hours,
          r.nightHours,
          r.regularPay,
          r.overtimeExtraPay,
          r.totalPay,
        ].join(',')
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GWMS_Overtime_Timesheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Live Overtime & Timesheet Financial Audit
              </h2>
              <p className="text-xs text-slate-400">
                Continuous mathematical accrual conforming to FLSA, California Labor Code, and EU Working Time Directive.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950/40"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aggregated KPI Cards */}
        <div className="grid grid-cols-4 gap-3 p-5 bg-slate-950/40 border-b border-slate-800">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[11px] font-semibold text-slate-400 block">Total Gross Payroll</span>
            <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
              ${totalGrossPayroll.toFixed(2)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[11px] font-semibold text-slate-400 block">Overtime Extra Liability</span>
            <span className="text-xl font-mono font-bold text-amber-400 mt-1 block">
              ${totalOvertimeLiability.toFixed(2)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[11px] font-semibold text-slate-400 block">Total Worked Hours</span>
            <span className="text-xl font-mono font-bold text-cyan-400 mt-1 block">
              {(totalRegularHours + totalOvertimeHours).toFixed(1)} hrs
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[11px] font-semibold text-slate-400 block">Overtime Burden %</span>
            <span className="text-xl font-mono font-bold text-purple-400 mt-1 block">
              {totalRegularHours > 0
                ? ((totalOvertimeHours / (totalRegularHours + totalOvertimeHours)) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Timesheet Data Table */}
        <div className="flex-1 overflow-auto p-5">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Field Worker</th>
                <th className="py-2.5 px-3">Base Wage</th>
                <th className="py-2.5 px-3">Shift Status</th>
                <th className="py-2.5 px-3 text-right">Regular Hrs</th>
                <th className="py-2.5 px-3 text-right">Tier 1 OT (1.5x)</th>
                <th className="py-2.5 px-3 text-right">Tier 2 OT (2.0x)</th>
                <th className="py-2.5 px-3 text-right">Night Diff</th>
                <th className="py-2.5 px-3 text-right">Total Hours</th>
                <th className="py-2.5 px-3 text-right">Regular Pay</th>
                <th className="py-2.5 px-3 text-right">OT Extra</th>
                <th className="py-2.5 px-3 text-right font-bold text-emerald-400">Gross Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map(({ worker, regHours, ot1Hours, ot2Hours, nightHours, totalHours, regularPay, overtimeExtraPay, totalPay, multiplier, overtimeActive }) => (
                <tr key={worker.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={worker.photoUrl}
                        alt={worker.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700"
                      />
                      <div>
                        <div className="font-bold text-white">{worker.name}</div>
                        <div className="text-[10px] text-slate-400">{worker.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">
                    ${worker.baseWage.toFixed(2)}/h
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        overtimeActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : worker.status === 'CHECKED_IN_NORMAL'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : worker.status === 'APPROVED_REMOTE'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {worker.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{regHours}h</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400 font-semibold">{ot1Hours}h</td>
                  <td className="py-3 px-3 text-right font-mono text-red-400 font-semibold">{ot2Hours}h</td>
                  <td className="py-3 px-3 text-right font-mono text-indigo-300">{nightHours}h</td>
                  <td className="py-3 px-3 text-right font-mono text-white font-bold">{totalHours}h</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">${regularPay}</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400 font-semibold">+${overtimeExtraPay}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 font-extrabold text-sm">${totalPay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
