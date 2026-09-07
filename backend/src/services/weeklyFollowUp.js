/**
 * Weekly follow-up (المتابعة الأسبوعية) — not the periodic gradebook.
 */

import {
  addDaysToDateOnlyStr,
  schoolDateOnlyStr,
  toUtcMidnight,
  weekStartSundayStr,
} from '../utils/dates.js';
import { badRequest } from '../utils/errors.js';
import { prisma } from '../utils/prisma.js';

export const SCORE_FIELDS = [
  'participation',
  'homeworkScore',
  'understanding',
  'discipline',
  'interaction',
  'progress',
];

export const NOTES_MAX = 500;

function norm(name) {
  return String(name ?? '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/** PE / تربية بدنية only — do not reuse gradebook isExcludedSubject. */
export function isPeSubject(nameAr) {
  const n = norm(nameAr);
  if (!n) return true;
  if (n.includes('بدني')) return true;
  if (n === 'pe') return true;
  return false;
}

/**
 * Sum integers 1–5 only. Empty is skipped (not 0).
 * @returns {number | null}
 */
export function followUpTotal(scores) {
  let sum = 0;
  let any = false;
  for (const key of SCORE_FIELDS) {
    const v = scores?.[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) continue;
    sum += n;
    any = true;
  }
  return any ? sum : null;
}

export function isBlankFollowUpRow(row) {
  for (const key of SCORE_FIELDS) {
    if (row?.[key] != null) return false;
  }
  return !String(row?.notes ?? '').trim();
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseWeekStartParam(raw) {
  const s = String(raw ?? '').trim().slice(0, 10);
  if (!DATE_ONLY.test(s)) {
    throw badRequest('تاريخ الأسبوع غير صالح');
  }
  const sundayStr = weekStartSundayStr(s);
  return {
    sundayStr,
    sundayDate: toUtcMidnight(sundayStr),
  };
}

export function currentSchoolWeekSunday() {
  return weekStartSundayStr(schoolDateOnlyStr());
}

export function isFutureWeek(sundayStr) {
  return String(sundayStr) > currentSchoolWeekSunday();
}

export function weekEndThursday(sundayStr) {
  return addDaysToDateOnlyStr(sundayStr, 4);
}

export function parseScore(value, label = 'درجة التقييم') {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    value = Number(t);
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw badRequest(`${label} من 1 إلى 5`);
  }
  return value;
}

export function parseNotes(value) {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  if (t.length > NOTES_MAX) {
    throw badRequest('الملاحظة أطول من الحد المسموح');
  }
  return t;
}

export function serializeFollowUpScores(row) {
  const scores = {
    participation: row?.participation ?? null,
    homeworkScore: row?.homeworkScore ?? null,
    understanding: row?.understanding ?? null,
    discipline: row?.discipline ?? null,
    interaction: row?.interaction ?? null,
    progress: row?.progress ?? null,
    notes: row?.notes ?? null,
  };
  return {
    ...scores,
    total: followUpTotal(scores),
  };
}

/**
 * Scores follow the student (unique key), not the class they were last saved in.
 * Roster is still the current class; classId is only written on save.
 */
export async function loadFollowUpRowsByStudent({ studentIds, subjectId, academicYear, sundayDate }) {
  if (!studentIds.length) return new Map();
  const saved = await prisma.weeklyFollowUp.findMany({
    where: {
      studentId: { in: studentIds },
      subjectId,
      academicYear,
      weekStart: sundayDate,
    },
  });
  return new Map(saved.map((s) => [s.studentId, s]));
}

export async function loadFollowUpClassSheet({ classId, subjectId, academicYear, sundayDate }) {
  const students = await prisma.student.findMany({
    where: { classId, isActive: true },
    orderBy: { nameAr: 'asc' },
    select: { id: true, nameAr: true },
  });
  const byStudent = await loadFollowUpRowsByStudent({
    studentIds: students.map((s) => s.id),
    subjectId,
    academicYear,
    sundayDate,
  });
  return students.map((st) => ({
    studentId: st.id,
    studentNameAr: st.nameAr,
    ...serializeFollowUpScores(byStudent.get(st.id)),
  }));
}
