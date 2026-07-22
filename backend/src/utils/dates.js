/**
 * Normalize any Date / ISO string / YYYY-MM-DD to UTC midnight.
 * Required for Attendance.date, LateReport.date, Homework.date,
 * WeeklyPlan.weekStart, Notification.forDate — unique constraints depend on it.
 */
export function toUtcMidnight(input) {
  if (input == null || input === '') {
    throw new Error('Date is required');
  }

  let year;
  let month;
  let day;

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error('Invalid date');
    year = input.getUTCFullYear();
    month = input.getUTCMonth();
    day = input.getUTCDate();
  } else if (typeof input === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (dateOnly) {
      year = Number(dateOnly[1]);
      month = Number(dateOnly[2]) - 1;
      day = Number(dateOnly[3]);
    } else {
      const d = new Date(input);
      if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
      year = d.getUTCFullYear();
      month = d.getUTCMonth();
      day = d.getUTCDate();
    }
  } else {
    throw new Error('Invalid date');
  }

  return new Date(Date.UTC(year, month, day));
}

/** True if the UTC day is Saturday (WeeklyPlan.weekStart rule). */
export function isSaturdayUtc(date) {
  const d = toUtcMidnight(date);
  return d.getUTCDay() === 6;
}

/**
 * Saturday on or before `input` (UTC date-only).
 * Matches frontend weekStartSaturday() / WeeklyPlan.weekStart convention.
 */
export function weekStartSaturdayUtc(input) {
  const d = toUtcMidnight(input);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 6 ? 0 : day + 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
}

export function todayUtcMidnight() {
  return toUtcMidnight(new Date());
}
