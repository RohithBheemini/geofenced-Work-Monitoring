/**
 * @file overtimeEngine.js
 * @description Continuous Multi-Tier Overtime and Payroll Accrual Engine.
 * Supports Standard 1.0x, Tier 1 1.5x, Tier 2 2.0x, and Night Differential (+0.25x).
 */

export const STANDARD_HOURS_SECONDS = 8 * 3600; // 8 hours
export const TIER_1_CAP_SECONDS = 12 * 3600;      // 12 hours

const round2 = (n) => Math.round(n * 100) / 100;

export function isNightDifferential(timestampMs) {
  const hour = new Date(timestampMs).getHours();
  return hour >= 22 || hour < 6;
}

export function calculateOvertime({
  checkInTimeMs,
  checkOutTimeMs = Date.now(),
  baseHourlyWage = 35.0,
  isRestDayOrHoliday = false,
  unpaidBreakSeconds = 0,
}) {
  const emptyResult = {
    totalDurationSeconds: 0,
    regularDurationSeconds: 0,
    tier1OtDurationSeconds: 0,
    tier2OtDurationSeconds: 0,
    nightDiffDurationSeconds: 0,
    regularPay: 0,
    tier1OtPay: 0,
    tier2OtPay: 0,
    nightDiffPay: 0,
    totalPay: 0,
    overtimeExtraPay: 0,
    currentTierMultiplier: 1.0,
    overtimeActive: false,
  };

  if (!checkInTimeMs) return emptyResult;

  const effectiveEndMs = Math.max(checkInTimeMs, checkOutTimeMs);
  const totalWorked = Math.max(0, Math.floor((effectiveEndMs - checkInTimeMs) / 1000) - unpaidBreakSeconds);

  let reg = 0;
  let ot1 = 0;
  let ot2 = 0;

  if (isRestDayOrHoliday) {
    ot2 = totalWorked;
  } else {
    reg = Math.min(totalWorked, STANDARD_HOURS_SECONDS);
    if (totalWorked > STANDARD_HOURS_SECONDS) {
      ot1 = Math.min(totalWorked - STANDARD_HOURS_SECONDS, TIER_1_CAP_SECONDS - STANDARD_HOURS_SECONDS);
    }
    if (totalWorked > TIER_1_CAP_SECONDS) {
      ot2 = totalWorked - TIER_1_CAP_SECONDS;
    }
  }

  // Sample night differential in 15-minute windows
  let nightDiffSec = 0;
  const sampleMs = 15 * 60 * 1000;
  for (let t = checkInTimeMs; t < effectiveEndMs; t += sampleMs) {
    if (isNightDifferential(t)) {
      nightDiffSec += Math.floor((Math.min(effectiveEndMs, t + sampleMs) - t) / 1000);
    }
  }

  const perSec = baseHourlyWage / 3600.0;
  const regularPay = reg * perSec * 1.0;
  const tier1OtPay = ot1 * perSec * 1.5;
  const tier2OtPay = ot2 * perSec * 2.0;
  const nightDiffPay = nightDiffSec * perSec * 0.25;

  let multiplier = isRestDayOrHoliday || totalWorked > TIER_1_CAP_SECONDS ? 2.0 : totalWorked > STANDARD_HOURS_SECONDS ? 1.5 : 1.0;
  if (isNightDifferential(effectiveEndMs)) multiplier += 0.25;

  return {
    totalDurationSeconds: totalWorked,
    regularDurationSeconds: reg,
    tier1OtDurationSeconds: ot1,
    tier2OtDurationSeconds: ot2,
    nightDiffDurationSeconds: nightDiffSec,
    regularPay: round2(regularPay),
    tier1OtPay: round2(tier1OtPay),
    tier2OtPay: round2(tier2OtPay),
    nightDiffPay: round2(nightDiffPay),
    totalPay: round2(regularPay + tier1OtPay + tier2OtPay + nightDiffPay),
    overtimeExtraPay: round2(ot1 * perSec * 0.5 + ot2 * perSec * 1.0 + nightDiffPay),
    currentTierMultiplier: multiplier,
    overtimeActive: isRestDayOrHoliday || totalWorked > STANDARD_HOURS_SECONDS,
  };
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
