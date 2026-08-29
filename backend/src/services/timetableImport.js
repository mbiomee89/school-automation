import { prisma } from '../utils/prisma.js';
import { badRequest } from '../utils/errors.js';
import { hashPassword } from './auth.js';
import {
  schoolDateOnlyStr,
  isCurrentSchoolWeekEditable,
  isWeeklyPlanWeekEditable,
} from '../utils/dates.js';

const SUBJECT_EN = {
  عربي: 'Arabic',
  دين: 'Islamic Studies',
  رياضيات: 'Mathematics',
  علوم: 'Science',
  قرآن: 'Quran',
  فنية: 'Art',
  بدنية: 'PE',
  حياتية: 'Life Skills',
  رقمية: 'Digital Skills',
  اجتماعية: 'Social Studies',
  E: 'English',
};

/** Same default as Noor teacher import — admin edits name later in staff tab. */
export const TIMETABLE_TEACHER_DEFAULT_PASSWORD = 'Password123!';

function timetableTeacherEmail(tableName) {
  const slug = normalizeArKey(tableName).replace(/[^a-z0-9\u0600-\u06ff]/gi, '').slice(0, 40) || 'teacher';
  // ASCII-safe local part for email uniqueness
  const ascii = Buffer.from(slug, 'utf8').toString('hex').slice(0, 48);
  return `tt.${ascii || 'x'}@timetable.local`;
}

export function normalizeArKey(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function collapseSpaces(s) {
  let out = String(s ?? '').normalize('NFKC');
  // Fix aSc/OCR broken names like "ص لا ح" / "ع لا ء" → "صلاح" / "علاء"
  for (let i = 0; i < 4; i++) {
    out = out.replace(/\b([\u0600-\u06FF])\s+([\u0600-\u06FF])\s+([\u0600-\u06FF])\b/g, '$1$2$3');
    out = out.replace(/\b([\u0600-\u06FF])\s+([\u0600-\u06FF])\b/g, '$1$2');
  }
  return out.replace(/\s+/g, ' ').trim();
}

const SECTION_FROM_DIGIT = {
  1: 'أ',
  2: 'ب',
  3: 'ج',
  4: 'د',
  5: 'ه',
  6: 'و',
  7: 'ز',
  8: 'ح',
};

const SECTION_FROM_LATIN = {
  a: 'أ',
  b: 'ب',
  c: 'ج',
  d: 'د',
};

/**
 * Parse aSc / school class labels.
 * Letters: أول-أ · Digits (school rule): أول-1 → أول أ, أول-2 → أول ب
 */
export function parseClassLabel(label) {
  const raw = collapseSpaces(label);
  const gradeRe = 'أول|اول|ثاني|ثان|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع';

  const mNum = raw.match(new RegExp(`^(${gradeRe})\\s*[-–]?\\s*([1-8])$`));
  if (mNum) {
    let grade = mNum[1];
    if (grade === 'اول') grade = 'أول';
    if (grade === 'ثاني') grade = 'ثان';
    return { gradeLevel: grade, section: SECTION_FROM_DIGIT[Number(mNum[2])] };
  }

  const m = raw.match(new RegExp(`^(${gradeRe})\\s*[-–]?\\s*([أبجدهوزحA-Da-d])$`));
  if (!m) return null;
  let grade = m[1];
  if (grade === 'اول') grade = 'أول';
  if (grade === 'ثاني') grade = 'ثان';
  let section = m[2];
  const latin = SECTION_FROM_LATIN[section.toLowerCase()];
  if (latin) section = latin;
  return { gradeLevel: grade, section };
}

function nameTokens(name) {
  return collapseSpaces(name)
    .split(/\s+/)
    .map((t) => normalizeArKey(t))
    .filter((t) => t.length > 0);
}

/**
 * Index every useful short form of a full staff name so aSc short names
 * (first+second / first+third / first+last) resolve to the full User.name.
 */
function buildTeacherIndex(teachers) {
  const byKey = new Map(); // key -> teacher | 'AMBIGUOUS'

  function add(key, teacher) {
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, teacher);
    } else if (existing !== 'AMBIGUOUS' && existing.id !== teacher.id) {
      byKey.set(key, 'AMBIGUOUS');
    }
  }

  for (const t of teachers) {
    const toks = collapseSpaces(t.name).split(/\s+/).filter(Boolean);
    const keys = nameTokens(t.name);
    if (!keys.length) continue;

    add(keys.join(''), t); // full name compacted
    add(normalizeArKey(collapseSpaces(t.name)), t);

    // All ordered pairs and first+any later token (covers first+second, first+third, first+last)
    for (let i = 0; i < keys.length; i++) {
      add(keys[i], t); // single token — only used if unique
      for (let j = i + 1; j < keys.length; j++) {
        add(keys[i] + keys[j], t);
        add(keys[j] + keys[i], t); // reversed order in PDF
      }
    }

    // Contiguous bigrams from original tokens
    for (let i = 0; i < toks.length - 1; i++) {
      add(normalizeArKey(toks[i] + toks[i + 1]), t);
    }

    // First + last explicitly
    if (keys.length >= 2) {
      add(keys[0] + keys[keys.length - 1], t);
      add(keys[keys.length - 1] + keys[0], t);
    }
  }

  return byKey;
}

/**
 * Match a short timetable name to a teacher with a full name in the DB.
 * Prefer: exact indexed short-form → all PDF tokens ⊆ full-name tokens → scored overlap.
 */
function matchTeacher(name, index, teachers) {
  const cleaned = collapseSpaces(name);
  if (!cleaned) return null;
  const key = normalizeArKey(cleaned);
  const needleToks = nameTokens(cleaned);
  if (!needleToks.length) return null;

  const direct = index.get(key);
  if (direct && direct !== 'AMBIGUOUS') return direct;

  // Pair key already tried via full compact; also try joining tokens
  const pairKey = needleToks.join('');
  const pairHit = index.get(pairKey);
  if (pairHit && pairHit !== 'AMBIGUOUS') return pairHit;

  let best = null;
  let bestScore = 0;

  for (const t of teachers) {
    const hayToks = nameTokens(t.name);
    if (!hayToks.length) continue;
    const haySet = new Set(hayToks);

    // All short-name tokens must appear in the full name
    const allPresent = needleToks.every((tok) => haySet.has(tok));
    if (!allPresent) {
      // Allow 1-char OCR drift only on tokens length >= 4 via prefix/includes
      const softOk = needleToks.every(
        (tok) =>
          haySet.has(tok) ||
          (tok.length >= 3 && hayToks.some((h) => h.includes(tok) || tok.includes(h)))
      );
      if (!softOk) continue;
    }

    let score = 0;
    // First token of PDF should match first token of full name when possible
    if (needleToks[0] === hayToks[0]) score += 5;
    // Last PDF token matching last full-name token (family name)
    if (needleToks[needleToks.length - 1] === hayToks[hayToks.length - 1]) score += 4;
    // Prefer when PDF last token appears anywhere late in full name
    const lastNeedle = needleToks[needleToks.length - 1];
    const lastIdx = hayToks.lastIndexOf(lastNeedle);
    if (lastIdx >= 1) score += 2;
    score += needleToks.filter((tok) => haySet.has(tok)).length * 3;
    // Prefer fewer leftover tokens in full name (tighter match)
    score -= Math.max(0, hayToks.length - needleToks.length) * 0.1;

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  // Require at least a 2-token style hit (or unique strong first-name-only if only one teacher)
  if (best && bestScore >= 6) return best;

  // Unique single-token fallback (e.g. rare family name only) — only if unambiguous
  if (needleToks.length === 1) {
    const only = index.get(needleToks[0]);
    if (only && only !== 'AMBIGUOUS') return only;
  }

  return null;
}

function matchClass(label, classes) {
  const parsed = parseClassLabel(label);
  if (parsed) {
    const hit = classes.find(
      (c) =>
        normalizeArKey(c.gradeLevel) === normalizeArKey(parsed.gradeLevel) &&
        normalizeArKey(c.section || '') === normalizeArKey(parsed.section)
    );
    if (hit) return hit;
    // grade stored as "أول متوسط" etc — starts with grade
    const soft = classes.find(
      (c) =>
        normalizeArKey(c.gradeLevel).startsWith(normalizeArKey(parsed.gradeLevel)) &&
        normalizeArKey(c.section || '') === normalizeArKey(parsed.section)
    );
    if (soft) return soft;
  }

  const key = normalizeArKey(label);
  return (
    classes.find((c) => normalizeArKey(c.name) === key) ||
    classes.find((c) => normalizeArKey(c.name).includes(key) || key.includes(normalizeArKey(c.name))) ||
    null
  );
}

function matchSubject(name, subjects) {
  const cleaned = collapseSpaces(name);
  const key = normalizeArKey(cleaned);
  const aliases = {
    [normalizeArKey('عربي')]: ['عربي', 'لغة عربية', 'اللغة العربية'],
    [normalizeArKey('دين')]: ['دين', 'تربية اسلامية', 'التربية الإسلامية', 'اسلامية'],
    [normalizeArKey('E')]: ['e', 'english', 'انجليزي', 'إنجليزي', 'اللغة الإنجليزية'],
    [normalizeArKey('بدنية')]: ['بدنية', 'تربية بدنية'],
    [normalizeArKey('فنية')]: ['فنية', 'تربية فنية'],
    [normalizeArKey('حياتية')]: ['حياتية', 'مهارات حياتية'],
    [normalizeArKey('رقمية')]: ['رقمية', 'مهارات رقمية'],
    [normalizeArKey('اجتماعية')]: ['اجتماعية', 'دراسات اجتماعية'],
    [normalizeArKey('قرآن')]: ['قرآن', 'قران', 'القرآن'],
  };

  for (const s of subjects) {
    if (normalizeArKey(s.nameAr) === key || normalizeArKey(s.nameEn) === key) return s;
  }
  for (const [, list] of Object.entries(aliases)) {
    if (list.some((a) => normalizeArKey(a) === key)) {
      for (const s of subjects) {
        if (list.some((a) => normalizeArKey(s.nameAr).includes(normalizeArKey(a)))) return s;
      }
    }
  }
  for (const s of subjects) {
    if (normalizeArKey(s.nameAr).includes(key) || key.includes(normalizeArKey(s.nameAr))) return s;
  }
  return null;
}

/**
 * Preview / resolve slots. Optional maps override auto-match (table name → entity id).
 */
export async function resolveTimetableSlots(
  rawSlots,
  {
    academicYear,
    createMissingSubjects = false,
    teacherMap = {},
    classMap = {},
    subjectMap = {},
  } = {}
) {
  const settings = await prisma.schoolSettings.findFirst();
  const year = academicYear || settings?.academicYear;
  if (!year) throw badRequest('لا توجد سنة دراسية في إعدادات المدرسة');

  const [teachers, classes, subjects] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'TEACHER', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.class.findMany({
      where: { academicYear: year },
      select: { id: true, name: true, gradeLevel: true, section: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subject.findMany({
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: 'asc' },
    }),
  ]);

  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const classById = new Map(classes.map((c) => [c.id, c]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const teacherIndex = buildTeacherIndex(teachers);
  let subjectList = [...subjects];

  const teacherCounts = new Map();
  const classCounts = new Map();
  const subjectCounts = new Map();
  for (const slot of rawSlots) {
    teacherCounts.set(slot.teacherName, (teacherCounts.get(slot.teacherName) || 0) + 1);
    classCounts.set(slot.classLabel, (classCounts.get(slot.classLabel) || 0) + 1);
    subjectCounts.set(slot.subjectName, (subjectCounts.get(slot.subjectName) || 0) + 1);
  }

  function resolveTeacher(tableName) {
    const mappedId = teacherMap[tableName];
    if (mappedId != null) return teacherById.get(Number(mappedId)) || null;
    return matchTeacher(tableName, teacherIndex, teachers);
  }

  function resolveClass(tableName) {
    const mappedId = classMap[tableName];
    if (mappedId != null) return classById.get(Number(mappedId)) || null;
    return matchClass(tableName, classes);
  }

  function resolveSubject(tableName) {
    const mappedId = subjectMap[tableName];
    if (mappedId != null) return subjectById.get(Number(mappedId)) || null;
    return matchSubject(tableName, subjectList);
  }

  const teacherMappings = [...teacherCounts.entries()]
    .map(([tableName, count]) => {
      const suggested = resolveTeacher(tableName);
      return {
        tableName,
        count,
        suggestedId: suggested?.id ?? null,
        suggestedName: suggested?.name ?? null,
      };
    })
    .sort((a, b) => a.tableName.localeCompare(b.tableName, 'ar'));

  const classMappings = [...classCounts.entries()]
    .map(([tableName, count]) => {
      const suggested = resolveClass(tableName);
      return {
        tableName,
        count,
        suggestedId: suggested?.id ?? null,
        suggestedName: suggested?.name ?? null,
      };
    })
    .sort((a, b) => a.tableName.localeCompare(b.tableName, 'ar'));

  const subjectMappings = [...subjectCounts.entries()]
    .map(([tableName, count]) => {
      const suggested = resolveSubject(tableName);
      return {
        tableName,
        count,
        suggestedId: suggested?.id ?? null,
        suggestedName: suggested?.nameAr ?? null,
      };
    })
    .sort((a, b) => a.tableName.localeCompare(b.tableName, 'ar'));

  const resolved = [];
  const matched = [];
  const unmatchedTeachers = new Map();
  const unmatchedClasses = new Map();
  const unmatchedSubjects = new Map();

  for (const slot of rawSlots) {
    const teacher = resolveTeacher(slot.teacherName);
    const cls = resolveClass(slot.classLabel);
    let subject = resolveSubject(slot.subjectName);

    if (!teacher) {
      unmatchedTeachers.set(slot.teacherName, (unmatchedTeachers.get(slot.teacherName) || 0) + 1);
    }
    if (!cls) {
      unmatchedClasses.set(slot.classLabel, (unmatchedClasses.get(slot.classLabel) || 0) + 1);
    }
    if (!subject) {
      unmatchedSubjects.set(slot.subjectName, (unmatchedSubjects.get(slot.subjectName) || 0) + 1);
      if (createMissingSubjects && slot.subjectName) {
        const nameAr = collapseSpaces(slot.subjectName);
        const existing = subjectList.find((s) => normalizeArKey(s.nameAr) === normalizeArKey(nameAr));
        if (existing) {
          subject = existing;
          unmatchedSubjects.delete(slot.subjectName);
        } else {
          subject = await prisma.subject.create({
            data: {
              nameAr,
              nameEn: SUBJECT_EN[nameAr] || nameAr,
            },
          });
          subjectList.push(subject);
          subjectById.set(subject.id, subject);
          unmatchedSubjects.delete(slot.subjectName);
        }
      }
    }

    const row = {
      ...slot,
      teacherId: teacher?.id ?? null,
      classId: cls?.id ?? null,
      subjectId: subject?.id ?? null,
      academicYear: year,
      ok: Boolean(teacher && cls && subject),
    };
    resolved.push(row);
    if (row.ok) matched.push(row);
  }

  return {
    academicYear: year,
    total: rawSlots.length,
    matched: matched.length,
    unresolved: resolved.length - matched.length,
    unmatchedTeachers: [...unmatchedTeachers.entries()].map(([name, count]) => ({ name, count })),
    unmatchedClasses: [...unmatchedClasses.entries()].map(([name, count]) => ({ name, count })),
    unmatchedSubjects: [...unmatchedSubjects.entries()].map(([name, count]) => ({ name, count })),
    sample: matched.slice(0, 8),
    matchedSlots: matched,
    teacherMappings,
    classMappings,
    subjectMappings,
    teacherOptions: teachers,
    classOptions: classes.map((c) => ({ id: c.id, name: c.name })),
    subjectOptions: subjectList.map((s) => ({ id: s.id, nameAr: s.nameAr })),
    slots: rawSlots,
  };
}

/**
 * Create (or reuse) TEACHER accounts from short timetable names.
 * Name is stored as the table name — admin can edit the full name later in staff.
 * Returns map tableName → teacherId and how many were newly created.
 */
export async function ensureTeachersFromTableNames(tableNames) {
  const unique = [...new Set((tableNames || []).map((n) => collapseSpaces(n)).filter(Boolean))];
  const teacherMap = {};
  let created = 0;
  const passwordHash = await hashPassword(TIMETABLE_TEACHER_DEFAULT_PASSWORD);

  for (const tableName of unique) {
    const email = timetableTeacherEmail(tableName);
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: tableName,
          email,
          phone: null,
          passwordHash,
          role: 'TEACHER',
          langPref: 'AR',
          isActive: true,
          mustChangePassword: true,
        },
      });
      created += 1;
    } else if (user.role !== 'TEACHER') {
      throw badRequest(
        `البريد المحجوز لاسم الجدول «${tableName}» مستخدم لدور ${user.role} — اختر معلماً موجوداً بدل الإنشاء`
      );
    } else if (!user.isActive) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true, name: tableName },
      });
    }
    teacherMap[tableName] = user.id;
  }

  return { teacherMap, created, temporaryPasswordIssued: created > 0 };
}

/**
 * Replace timetable for academic year + upsert TeacherAssignment from distinct pairs.
 */
export async function applyTimetableImport(
  rawSlots,
  {
    academicYear,
    teacherMap = {},
    classMap = {},
    subjectMap = {},
    createTeachers = [],
  } = {}
) {
  const mergedTeacherMap = { ...teacherMap };
  let teachersCreated = 0;
  let temporaryPasswordIssued = false;

  if (createTeachers.length) {
    const ensured = await ensureTeachersFromTableNames(createTeachers);
    Object.assign(mergedTeacherMap, ensured.teacherMap);
    teachersCreated = ensured.created;
    temporaryPasswordIssued = !!ensured.temporaryPasswordIssued;
  }

  const preview = await resolveTimetableSlots(rawSlots, {
    academicYear,
    createMissingSubjects: true,
    teacherMap: mergedTeacherMap,
    classMap,
    subjectMap,
  });

  if (preview.matched === 0) {
    throw badRequest(
      'لم يُطابق أي درس. أكمل مطابقة أسماء المعلمين والفصول في الشبكة، أو أنشئ المعلمين من الجدول.'
    );
  }

  const year = preview.academicYear;
  const slots = preview.matchedSlots;

  // Neon serverless + pooler drops long interactive Prisma transactions
  // ("Transaction not found"). Prefer short sequential ops + createMany.
  const byClassSlot = new Map();
  for (const s of slots) {
    byClassSlot.set(`${s.classId}|${s.dayOfWeek}|${s.period}`, s);
  }
  const finalSlots = [...byClassSlot.values()];

  await prisma.timetableSlot.deleteMany({ where: { academicYear: year } });

  const slotRows = finalSlots.map((s) => ({
    teacherId: s.teacherId,
    classId: s.classId,
    subjectId: s.subjectId,
    dayOfWeek: s.dayOfWeek,
    period: String(s.period),
    academicYear: year,
  }));

  const CHUNK = 100;
  let slotsCreated = 0;
  for (let i = 0; i < slotRows.length; i += CHUNK) {
    const chunk = slotRows.slice(i, i + CHUNK);
    const created = await prisma.timetableSlot.createMany({ data: chunk });
    slotsCreated += created.count;
  }

  const pairs = new Map();
  for (const s of finalSlots) {
    pairs.set(`${s.classId}:${s.subjectId}`, s);
  }

  let assignmentsCreated = 0;
  let assignmentsReassigned = 0;
  for (const s of pairs.values()) {
    const existing = await prisma.teacherAssignment.findUnique({
      where: { classId_subjectId: { classId: s.classId, subjectId: s.subjectId } },
    });
    if (existing) {
      if (existing.teacherId !== s.teacherId) {
        await prisma.teacherAssignment.update({
          where: { id: existing.id },
          data: { teacherId: s.teacherId },
        });
        assignmentsReassigned += 1;
      }
    } else {
      await prisma.teacherAssignment.create({
        data: {
          teacherId: s.teacherId,
          classId: s.classId,
          subjectId: s.subjectId,
        },
      });
      assignmentsCreated += 1;
    }
  }

  return {
    academicYear: year,
    parsed: preview.total,
    matched: preview.matched,
    unresolved: preview.unresolved,
    unmatchedTeachers: preview.unmatchedTeachers,
    unmatchedClasses: preview.unmatchedClasses,
    unmatchedSubjects: preview.unmatchedSubjects,
    teachersCreated,
    temporaryPasswordIssued,
    slotsCreated,
    assignmentsCreated,
    assignmentsReassigned,
  };
}

/** JS getDay(): 0=Sun … 4=Thu */
export function dateToSchoolDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const map = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU' };
  return map[utc.getUTCDay()] || null;
}

export async function getTeacherDaySchedule(teacherId, dateStr, academicYear) {
  const settings = await prisma.schoolSettings.findFirst();
  const year = academicYear || settings?.academicYear;
  const dayOfWeek = dateToSchoolDay(dateStr);
  if (!dayOfWeek || !year) {
    return { date: dateStr, dayOfWeek, academicYear: year, slots: [] };
  }

  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId, dayOfWeek, academicYear: year },
    include: {
      class: true,
      subject: true,
    },
    orderBy: { period: 'asc' },
  });

  // Attach assignment ids for daily workflow
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId },
  });
  const assignByPair = new Map(assignments.map((a) => [`${a.classId}:${a.subjectId}`, a]));

  return {
    date: dateStr,
    dayOfWeek,
    academicYear: year,
    slots: slots
      .map((s) => {
        const assignment = assignByPair.get(`${s.classId}:${s.subjectId}`);
        return {
          id: s.id,
          period: s.period,
          dayOfWeek: s.dayOfWeek,
          classId: s.classId,
          className: s.class.name,
          subjectId: s.subjectId,
          subjectNameAr: s.subject.nameAr,
          subjectNameEn: s.subject.nameEn,
          assignmentId: assignment?.id ?? null,
        };
      })
      .sort((a, b) => Number(a.period) - Number(b.period)),
  };
}

/** Sunday (UTC date-only) on or before dateStr. */
export function weekStartSunday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

function addUtcDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Saturday before the Sunday week containing dateStr (digest / report key). */
export function weekStartSaturdayFromDate(dateStr) {
  return addUtcDays(weekStartSunday(dateStr), -1);
}

export { addUtcDays };

const DAY_ORDER = ['SUN', 'MON', 'TUE', 'WED', 'THU'];

/**
 * Full Sun–Thu week grid for a teacher, plus homework + weekly-plan status per cell.
 */
export async function getTeacherWeekSchedule(teacherId, anchorDateStr, academicYear) {
  const settings = await prisma.schoolSettings.findFirst();
  const year = academicYear || settings?.academicYear;
  const weekStart = weekStartSunday(anchorDateStr);
  const today = schoolDateOnlyStr();
  const editable = isCurrentSchoolWeekEditable(weekStart, today);
  const planEditable = isWeeklyPlanWeekEditable(weekStart, today);

  if (!year) {
    return {
      weekStart,
      weekEnd: addUtcDays(weekStart, 4),
      academicYear: null,
      editable,
      planEditable,
      today,
      days: DAY_ORDER.map((dayOfWeek, i) => ({
        dayOfWeek,
        date: addUtcDays(weekStart, i),
        slots: [],
      })),
    };
  }

  const weekEnd = addUtcDays(weekStart, 4);
  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId, academicYear: year, dayOfWeek: { in: DAY_ORDER } },
    include: { class: true, subject: true },
  });

  const assignments = await prisma.teacherAssignment.findMany({ where: { teacherId } });
  const assignByPair = new Map(assignments.map((a) => [`${a.classId}:${a.subjectId}`, a]));

  const from = new Date(`${weekStart}T00:00:00.000Z`);
  const to = new Date(`${weekEnd}T00:00:00.000Z`);
  const classIds = [...new Set(slots.map((s) => s.classId))];
  const homeworkRows =
    classIds.length === 0
      ? []
      : await prisma.homework.findMany({
          where: {
            classId: { in: classIds },
            date: { gte: from, lte: to },
            period: { not: '' },
          },
        });
  const hwByKey = new Map();
  for (const h of homeworkRows) {
    const key = `${h.date.toISOString().slice(0, 10)}|${h.period}|${h.classId}|${h.subjectId}`;
    hwByKey.set(key, h);
  }

  const planRows =
    classIds.length === 0
      ? []
      : await prisma.weeklyPlan.findMany({
          where: {
            classId: { in: classIds },
            date: { gte: from, lte: to },
            period: { not: '' },
          },
        });
  const planByKey = new Map();
  for (const p of planRows) {
    if (!p.date) continue;
    const key = `${p.date.toISOString().slice(0, 10)}|${p.period}|${p.classId}|${p.subjectId}`;
    planByKey.set(key, p);
  }

  const days = DAY_ORDER.map((dayOfWeek, i) => {
    const date = addUtcDays(weekStart, i);
    const daySlots = slots
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .map((s) => {
        const assignment = assignByPair.get(`${s.classId}:${s.subjectId}`);
        const hw = hwByKey.get(`${date}|${s.period}|${s.classId}|${s.subjectId}`);
        const plan = planByKey.get(`${date}|${s.period}|${s.classId}|${s.subjectId}`);
        return {
          id: s.id,
          period: s.period,
          dayOfWeek: s.dayOfWeek,
          date,
          classId: s.classId,
          className: s.class.name,
          subjectId: s.subjectId,
          subjectNameAr: s.subject.nameAr,
          subjectNameEn: s.subject.nameEn,
          assignmentId: assignment?.id ?? null,
          homeworkId: hw?.id ?? null,
          noHomework: hw?.noHomework ?? false,
          hasHomework: Boolean(hw && !hw.noHomework),
          handled: Boolean(hw),
          description: hw && !hw.noHomework ? hw.description : null,
          dueDate: hw?.dueDate ? hw.dueDate.toISOString().slice(0, 10) : null,
          planId: plan?.id ?? null,
          planTitle: plan?.title || null,
          hasPlan: Boolean(plan?.title),
        };
      })
      .sort((a, b) => Number(a.period) - Number(b.period));
    return { dayOfWeek, date, slots: daySlots };
  });

  return {
    weekStart,
    weekEnd,
    academicYear: year,
    editable,
    planEditable,
    today,
    days,
  };
}
