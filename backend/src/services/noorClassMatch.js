import { badRequest, notFound } from '../utils/errors.js';
import {
  classDisplayName,
  fileClassKey,
  fileClassLabel,
  normalizeNoorClass,
} from './noorImport.js';

export function parseLeftoverClassIds(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
  } catch {
    return [];
  }
}

export function serializeLeftoverClassIds(ids) {
  return JSON.stringify([...new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]);
}

export function parsePreviewJson(raw) {
  if (!raw) return { rows: [], errors: [] };
  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
    return { rows, errors };
  } catch {
    return { rows: [], errors: [] };
  }
}

function gradeVariants(grade) {
  const g = String(grade ?? '').trim();
  const out = new Set([g]);
  if (g === 'اول' || g === 'أول') {
    out.add('اول');
    out.add('أول');
  }
  if (g === 'ثاني' || g === 'ثان') {
    out.add('ثاني');
    out.add('ثان');
  }
  return out;
}

export function gradesMatch(a, b) {
  const left = gradeVariants(a);
  for (const v of gradeVariants(b)) {
    if (left.has(v)) return true;
  }
  return false;
}

function findByGradeSection(classes, grade, section) {
  const sec = String(section ?? '').trim();
  return (classes || []).filter(
    (c) => gradesMatch(c.gradeLevel, grade) && String(c.section ?? '').trim() === sec
  );
}

function studentCount(cls) {
  return cls?._count?.students ?? 0;
}

function timetableHits(labels, ...names) {
  const set = new Set((labels || []).map((l) => String(l).trim()).filter(Boolean));
  if (set.size === 0) return true;
  return names.some((n) => n && set.has(String(n).trim()));
}

/**
 * Per Noor file class: recommendation + admin options. Does not write.
 */
export function buildNoorClassPreview(rows, schoolClasses, { timetableLabels = [] } = {}) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = fileClassKey(row.gradeLevel, row.section);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        fileGrade: row.gradeLevel,
        fileSection: row.section,
        studentCount: 0,
      });
    }
    groups.get(key).studentCount += 1;
  }

  const all = schoolClasses || [];
  const active = all.filter((c) => !c.retiredAt);

  const mappings = [];
  for (const g of groups.values()) {
    const suggested = normalizeNoorClass(g.fileGrade, g.fileSection);
    const letterDifferent =
      suggested.section !== g.fileSection || suggested.gradeLevel !== g.fileGrade;

    const exactAll = findByGradeSection(all, g.fileGrade, g.fileSection);
    const letterAll = findByGradeSection(all, suggested.gradeLevel, suggested.section);
    const exactActive = exactAll.filter((c) => !c.retiredAt);
    const letterActive = letterAll.filter((c) => !c.retiredAt);

    const exact = exactActive[0] || null;
    const letter =
      letterActive.find((c) => !exact || c.id !== exact.id) ||
      (letterDifferent ? letterActive[0] || null : null);

    let suggestedAction = 'createLetter';
    let suggestedClassId = null;
    let recommendedLabel = `إنشاء ${classDisplayName(g.fileGrade, g.fileSection)}`;
    let warning = null;
    let canRename = false;
    let renameClassId = null;

    if (exact && letter && exact.id !== letter.id) {
      const pick = studentCount(letter) >= studentCount(exact) ? letter : exact;
      suggestedAction = 'use';
      suggestedClassId = pick.id;
      recommendedLabel = `مطابقة مع ${pick.name}`;
      warning = `يوجد ${exact.name} و${letter.name} — لن يُدمجا تلقائياً`;
    } else if (letter && letterDifferent && !exact) {
      suggestedAction = 'use';
      suggestedClassId = letter.id;
      recommendedLabel = `مطابقة مع ${letter.name}`;
    } else if (exact && !letterDifferent) {
      suggestedAction = 'use';
      suggestedClassId = exact.id;
      recommendedLabel = `استخدم ${exact.name}`;
    } else if (exact && letterDifferent && !letter) {
      suggestedAction = 'use';
      suggestedClassId = exact.id;
      recommendedLabel = `الإبقاء على ${exact.name}`;
      canRename = true;
      renameClassId = exact.id;
    } else if (exact && letter && exact.id === letter.id) {
      suggestedAction = 'use';
      suggestedClassId = exact.id;
      recommendedLabel = `استخدم ${exact.name}`;
    }

    const letterName = classDisplayName(g.fileGrade, g.fileSection);
    const noorName = fileClassLabel(g.fileGrade, g.fileSection);
    if (
      timetableLabels.length > 0 &&
      !timetableHits(timetableLabels, letterName, noorName, exact?.name, letter?.name)
    ) {
      const weekly = 'هذا الفصل غير موجود في الجدول الأسبوعي';
      warning = warning ? `${warning} · ${weekly}` : weekly;
    }

    mappings.push({
      key: g.key,
      fileGrade: g.fileGrade,
      fileSection: g.fileSection,
      fileLabel: noorName,
      studentCount: g.studentCount,
      suggestedAction,
      suggestedClassId,
      recommendedLabel,
      warning,
      canRename,
      renameClassId,
      letterLabel: letterName,
      noorLabel: noorName,
    });
  }

  mappings.sort((a, b) => a.fileLabel.localeCompare(b.fileLabel, 'ar'));

  return {
    mappings,
    classOptions: active.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      section: c.section,
      studentCount: studentCount(c),
    })),
  };
}

async function restoreIfRetired(tx, cls, extra = {}) {
  if (!cls.retiredAt && Object.keys(extra).length === 0) return cls;
  return tx.class.update({
    where: { id: cls.id },
    data: { retiredAt: null, ...extra },
  });
}

async function findYearClass(tx, { gradeLevel, section, academicYear }) {
  return tx.class.findUnique({
    where: {
      gradeLevel_section_academicYear: { gradeLevel, section, academicYear },
    },
  });
}

/**
 * Resolve one admin choice to a Class row. Never silent-renames another class.
 */
export async function resolveNoorClassChoice(tx, { choice, fileGrade, fileSection, academicYear }) {
  const action = choice?.action;
  const suggested = normalizeNoorClass(fileGrade, fileSection);

  if (action === 'use') {
    const id = Number(choice.classId);
    if (!id) throw badRequest(`اختر فصلاً لـ ${fileClassLabel(fileGrade, fileSection)}`);
    const cls = await tx.class.findUnique({ where: { id } });
    if (!cls) throw notFound('الفصل غير موجود');
    if (cls.academicYear !== academicYear) {
      throw badRequest(`الفصل ${cls.name} ليس لنفس العام الدراسي`);
    }
    return restoreIfRetired(tx, cls);
  }

  if (action === 'rename') {
    const id = Number(choice.classId);
    if (!id) throw badRequest('إعادة التسمية تحتاج فصلًا موجودًا');
    const cls = await tx.class.findUnique({ where: { id } });
    if (!cls) throw notFound('الفصل غير موجود');
    const clash = await findYearClass(tx, {
      gradeLevel: suggested.gradeLevel,
      section: suggested.section,
      academicYear,
    });
    if (clash && clash.id !== cls.id) {
      throw badRequest(
        `لا يمكن إعادة تسمية ${cls.name} إلى ${classDisplayName(fileGrade, fileSection)} — الفصل موجود مسبقاً`
      );
    }
    return tx.class.update({
      where: { id: cls.id },
      data: {
        gradeLevel: suggested.gradeLevel,
        section: suggested.section,
        name: classDisplayName(fileGrade, fileSection),
        retiredAt: null,
      },
    });
  }

  if (action === 'createLetter' || action === 'createNoor') {
    const gradeLevel = action === 'createLetter' ? suggested.gradeLevel : String(fileGrade).trim();
    const section = action === 'createLetter' ? suggested.section : String(fileSection).trim();
    const name =
      action === 'createLetter'
        ? classDisplayName(fileGrade, fileSection)
        : fileClassLabel(fileGrade, fileSection);
    const existing = await findYearClass(tx, { gradeLevel, section, academicYear });
    if (existing) return restoreIfRetired(tx, existing, { name });
    return tx.class.create({
      data: { name, gradeLevel, section, academicYear },
    });
  }

  throw badRequest(`مطابقة ناقصة لـ ${fileClassLabel(fileGrade, fileSection)}`);
}

export function leftoverClassIdsFromSchool(schoolClasses, usedIds) {
  const used = new Set((usedIds || []).map(Number));
  return (schoolClasses || [])
    .filter((c) => !c.retiredAt && !used.has(c.id))
    .map((c) => c.id);
}

/**
 * Retire leftover empty classes only (not mapping targets). History stays.
 */
export async function retireLeftoverEmptyClasses(db, { leftoverClassIds, protectedClassIds = [] }) {
  const protectedSet = new Set((protectedClassIds || []).map(Number));
  const ids = [...new Set((leftoverClassIds || []).map(Number))].filter(
    (id) => id > 0 && !protectedSet.has(id)
  );
  const retired = [];
  for (const id of ids) {
    const cls = await db.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!cls || cls.retiredAt) continue;
    if (cls._count.students > 0) continue;
    await db.class.update({ where: { id }, data: { retiredAt: new Date() } });
    retired.push({ id: cls.id, name: cls.name });
  }
  return retired;
}

export async function loadTimetableClassLabels(db, academicYear) {
  const rows = await db.timetableSlot.findMany({
    where: { academicYear },
    select: { class: { select: { name: true } } },
  });
  return [...new Set(rows.map((r) => r.class?.name).filter(Boolean))];
}
