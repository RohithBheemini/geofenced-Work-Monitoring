/**
 * @file overtimeEngine.js
 * @description Continuous Multi-Tier Overtime and Payroll Accrual Engine.
 * Supports Standard 1.0x, Tier 1 1.5x, Tier 2 2.0x, and Night Differential (+0.25x).
 */

export const STANDARD_HOURS_SECONDS = 8 * 3600; // 8 hours
export const TIER_1_CAP_SECONDS = 12 * 3600;      // 12 hours

/**
 * Checks if a specific epoch millisecond timestamp falls within Night Differential window (22:00 - 06:00)
 */
export function isNightDifferential(timestampMs) {
  const date = new Date(timestampMs);
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

/**
 * Calculates continuous overtime and earnings for an active or completed session.
 * 
 * @param {Object} params
 * @param {number} params.checkInTimeMs - Check-in epoch ms
 * @param {number} [params.checkOutTimeMs] - Check-out epoch ms (defaults to now)
 * @param {number} [params.baseHourlyWage=35.0] - Base wage per hour
 * @param {boolean} [params.isRestDayOrHoliday=false] - If true, 2.0x applies from minute 0
 * @param {number} [params.unpaidBreakSeconds=0] - Deducted breaks in seconds
 */
export function calculateOvertime({
  checkInTimeMs,
  checkOutTimeMs = Date.now(),
  baseHourlyWage = 35.0,
  isRestDayOrHoliday = false,
  unpaidBreakSeconds = 0,
}) {
  if (!checkInTimeMs) {
    return {
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
  }

  const effectiveEndMs = Math.max(checkInTimeMs, checkOutTimeMs);
  const rawDurationSeconds = Math.max(0, Math.floor((effectiveEndMs - checkInTimeMs) / 1000));
  const totalWorkedSeconds = Math.max(0, rawDurationSeconds - unpaidBreakSeconds);

  let regularSeconds = 0;
  let tier1OtSeconds = 0;
  let tier2OtSeconds = 0;

  if (isRestDayOrHoliday) {
    // Rest day: All hours are Tier 2 (2.0x) from minute 0
    tier2OtSeconds = totalWorkedSeconds;
  } else {
    // Standard regular hours (up to 8h)
    regularSeconds = Math.min(totalWorkedSeconds, STANDARD_HOURS_SECONDS);

    // Tier 1 Overtime (8h to 12h)
    if (totalWorkedSeconds > STANDARD_HOURS_SECONDS) {
      tier1OtSeconds = Math.min(
        totalWorkedSeconds - STANDARD_HOURS_SECONDS,
        TIER_1_CAP_SECONDS - STANDARD_HOURS_SECONDS
      );
    }

    // Tier 2 Overtime (>12h)
    if (totalWorkedSeconds > TIER_1_CAP_SECONDS) {
      tier2OtSeconds = totalWorkedSeconds - TIER_1_CAP_SECONDS;
    }
  }

  // Estimate night differential seconds
  // Sampling in 15-minute intervals for performance
  let nightDiffSeconds = 0;
  const sampleIntervalMs = 15 * 60 * 1000;
  for (let t = checkInTimeMs; t < effectiveEndMs; t += sampleIntervalMs) {
    if (isNightDifferential(t)) {
      const sliceEnd = Math.min(effectiveEndMs, t + sampleIntervalMs);
      nightDiffSeconds += Math.floor((sliceEnd - t) / 1000);
    }
  }

  // Rate calculations
  const perSecondBase = baseHourlyWage / 3600.0;
  const regularPay = regularSeconds * perSecondBase * 1.0;
  const tier1OtPay = tier1OtSeconds * perSecondBase * 1.5;
  const tier2OtPay = tier2OtSeconds * perSecondBase * 2.0;
  const nightDiffPay = nightDiffSeconds * perSecondBase * 0.25;

  const totalPay = regularPay + tier1OtPay + tier2OtPay + nightDiffPay;
  // Overtime extra pay is amount earned above base 1.0x rate
  const overtimeExtraPay =
    tier1OtSeconds * perSecondBase * 0.5 +
    tier2OtSeconds * perSecondBase * 1.0 +
    nightDiffPay;

  let currentTierMultiplier = 1.0;
  if (isRestDayOrHoliday || totalWorkedSeconds > TIER_1_CAP_SECONDS) {
    currentTierMultiplier = 2.0;
  } else if (totalWorkedSeconds > STANDARD_HOURS_SECONDS) {
    currentTierMultiplier = 1.5;
  }

  if (isNightDifferential(effectiveEndMs)) {
    currentTierMultiplier += 0.25;
  }

  const overtimeActive = isRestDayOrHoliday || totalWorkedSeconds > STANDARD_HOURS_SECONDS;

  return {
    totalDurationSeconds: totalWorkedSeconds,
    regularDurationSeconds: regularSeconds,
    tier1OtDurationSeconds: tier1OtSeconds,
    tier2OtDurationSeconds: tier2OtSeconds,
    nightDiffDurationSeconds: nightDiffSeconds,
    regularPay: parseFloat(regularPay.toFixed(2)),
    tier1OtPay: parseFloat(tier1OtPay.toFixed(2)),
    tier2OtPay: parseFloat(tier2OtPay.toFixed(2)),
    nightDiffPay: parseFloat(nightDiffPay.toFixed(2)),
    totalPay: parseFloat(totalPay.toFixed(2)),
    overtimeExtraPay: parseFloat(overtimeExtraPay.toFixed(2)),
    currentTierMultiplier,
    overtimeActive,
  };
}

/**
 * Formats duration in seconds into human-readable HH:MM:SS
 */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
