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

/** School calendar "today" as YYYY-MM-DD in Asia/Riyadh. */
export function schoolDateOnlyStr(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date instanceof Date ? date : new Date(date));
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/** School calendar today as UTC midnight Date (for DB date-only fields). */
export function schoolTodayUtcMidnight(date = new Date()) {
  return toUtcMidnight(schoolDateOnlyStr(date));
}

/**
 * Sunday (YYYY-MM-DD) on or before dateStr — school week key for Sun–Thu grids.
 * dateStr must already be a calendar date-only string (not a zoned Date).
 */
export function weekStartSundayStr(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

export function addDaysToDateOnlyStr(dateStr, days) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** UTC weekday 0=Sun … 6=Sat for a date-only string. */
export function weekdayUtcFromDateOnly(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Homework (and similar): editable only for the Sun–Thu week containing school-today.
 */
export function isCurrentSchoolWeekEditable(dateStr, todayStr = schoolDateOnlyStr()) {
  return weekStartSundayStr(dateStr) === weekStartSundayStr(todayStr);
}

/**
 * Weekly plan edit window (Asia/Riyadh school calendar):
 * - Saturday: teachers start the upcoming Sun–Thu week (not the week that just ended).
 * - Sunday–Friday: edit the Sun–Thu week containing today (Friday = catch-up after Thursday).
 * Past / further-future weeks are view-only.
 */
export function isWeeklyPlanWeekEditable(dateStr, todayStr = schoolDateOnlyStr()) {
  const todayWeek = weekStartSundayStr(todayStr);
  const targetWeek = weekStartSundayStr(dateStr);
  const dow = weekdayUtcFromDateOnly(todayStr);
  if (dow === 6) {
    // Saturday → upcoming Sunday week
    return targetWeek === addDaysToDateOnlyStr(todayWeek, 7);
  }
  return targetWeek === todayWeek;
}

/** Default week anchor for weekly-plan UI (upcoming week on Saturday). */
export function defaultWeeklyPlanAnchor(todayStr = schoolDateOnlyStr()) {
  const todayWeek = weekStartSundayStr(todayStr);
  const dow = weekdayUtcFromDateOnly(todayStr);
  if (dow === 6) return addDaysToDateOnlyStr(todayWeek, 7);
  return todayWeek;
}

/** Furthest Sunday week a teacher may navigate to while editing plans. */
export function maxEditableWeeklyPlanWeek(todayStr = schoolDateOnlyStr()) {
  return defaultWeeklyPlanAnchor(todayStr);
}

/** Hour 0–23 in Asia/Riyadh for a Date / ISO string. */
export function schoolHourRiyadh(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    hour12: false,
  }).format(d);
  return Number(hourStr);
}
