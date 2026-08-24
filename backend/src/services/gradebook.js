/**
 * Elementary gradebook subject → ختامي / تكويني mapping (MoE 2025 + school locks).
 */

export const GRADE_SHAPE = {
  KHITAMI: 'KHITAMI',
  TAKWINI: 'TAKWINI',
};

/** Round half up to integer (for positive averages). */
export function roundInt(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n + 0.5);
}

export function parseGradeBand(gradeLevel) {
  const raw = String(gradeLevel ?? '').trim();
  const digit = raw.match(/[1-6]/);
  if (digit) return Number(digit[0]);
  const arMap = {
    أول: 1,
    الاولى: 1,
    الأولى: 1,
    اول: 1,
    ثاني: 2,
    الثانية: 2,
    ثالث: 3,
    الثالثة: 3,
    رابع: 4,
    الرابعة: 4,
    خامس: 5,
    الخامسة: 5,
    سادس: 6,
    السادسة: 6,
  };
  for (const [k, v] of Object.entries(arMap)) {
    if (raw.includes(k)) return v;
  }
  return null;
}

function norm(name) {
  return String(name ?? '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/** Exclude subjects never graded in v1. */
export function isExcludedSubject(nameAr) {
  const n = norm(nameAr);
  if (!n) return true;
  if (n.includes('قران') || n.includes('قرآن')) return true;
  if (n.includes('بدني')) return true;
  if (n.includes('فني')) return true;
  if (n.includes('حيات')) return true;
  if (n === 'النشاط' || n.includes('نشاططالب')) return true;
  if (n.includes('سلوك') || n.includes('مواظب')) return true;
  return false;
}

/**
 * Resolve gradebook shape for a subject + class grade level.
 * Returns null if subject is out of v1 scope.
 */
export function resolveGradeShape(nameAr, gradeLevel) {
  if (isExcludedSubject(nameAr)) return null;
  const n = norm(nameAr);
  const band = parseGradeBand(gradeLevel);

  // دين / إسلامية (not قرآن)
  if (
    n === 'دين' ||
    n.includes('اسلامي') ||
    (n.includes('دراساتاسلام') && !n.includes('قران'))
  ) {
    return {
      shape: GRADE_SHAPE.TAKWINI,
      assessmentMax: 40,
      examsMax: 60,
      periodMax: 100,
      finalMax: 0,
      key: 'دين',
    };
  }

  if (n.includes('رياض') || n.includes('matem')) {
    return {
      shape: GRADE_SHAPE.KHITAMI,
      assessmentMax: 40,
      examsMax: 20,
      periodMax: 60,
      finalMax: 40,
      key: 'الرياضيات',
    };
  }

  if (n.includes('عربي') || n.includes('لغهعربي')) {
    return {
      shape: GRADE_SHAPE.KHITAMI,
      assessmentMax: 40,
      examsMax: 20,
      periodMax: 60,
      finalMax: 40,
      key: 'اللغة العربية',
    };
  }

  if (n.includes('اجتماع')) {
    return {
      shape: GRADE_SHAPE.TAKWINI,
      assessmentMax: 40,
      examsMax: 60,
      periodMax: 100,
      finalMax: 0,
      key: 'الدراسات الاجتماعية',
    };
  }

  if (n.includes('رقمي') || n.includes('مهاراترق')) {
    return {
      shape: GRADE_SHAPE.TAKWINI,
      assessmentMax: 40,
      examsMax: 60,
      periodMax: 100,
      finalMax: 0,
      key: 'المهارات الرقمية',
    };
  }

  if (n.includes('علوم') && !n.includes('اسلام')) {
    const khitami = band == null || band >= 3;
    return khitami
      ? {
          shape: GRADE_SHAPE.KHITAMI,
          assessmentMax: 40,
          examsMax: 20,
          periodMax: 60,
          finalMax: 40,
          key: 'العلوم',
        }
      : {
          shape: GRADE_SHAPE.TAKWINI,
          assessmentMax: 40,
          examsMax: 60,
          periodMax: 100,
          finalMax: 0,
          key: 'العلوم',
        };
  }

  if (n.includes('انجليز') || n.includes('إنجليز') || n.includes('english')) {
    const khitami = band == null || band >= 3;
    return khitami
      ? {
          shape: GRADE_SHAPE.KHITAMI,
          assessmentMax: 40,
          examsMax: 20,
          periodMax: 60,
          finalMax: 40,
          key: 'اللغة الإنجليزية',
        }
      : {
          shape: GRADE_SHAPE.TAKWINI,
          assessmentMax: 40,
          examsMax: 60,
          periodMax: 100,
          finalMax: 0,
          key: 'اللغة الإنجليزية',
        };
  }

  return null;
}

export function periodTotal(assessment, exams, shapeMeta) {
  const a = Math.min(Math.max(0, Number(assessment) || 0), shapeMeta.assessmentMax);
  const e = Math.min(Math.max(0, Number(exams) || 0), shapeMeta.examsMax);
  return a + e;
}

/**
 * Build term formative + optional final. Returns null totals if either period missing.
 */
export function computeTermTotals(p1, p2, finalExam, shapeMeta) {
  if (!p1 || !p2) {
    return {
      ready: false,
      avgAssessment: null,
      avgExams: null,
      finalExam: shapeMeta.finalMax > 0 ? finalExam ?? null : null,
      total: null,
    };
  }
  const avgAssessment = roundInt((p1.assessment + p2.assessment) / 2);
  const avgExams = roundInt((p1.exams + p2.exams) / 2);
  const cappedA = Math.min(avgAssessment, shapeMeta.assessmentMax);
  const cappedE = Math.min(avgExams, shapeMeta.examsMax);
  let total = cappedA + cappedE;
  let finalVal = null;
  if (shapeMeta.finalMax > 0) {
    finalVal = Math.min(Math.max(0, Number(finalExam) || 0), shapeMeta.finalMax);
    total += finalVal;
  }
  return {
    ready: true,
    avgAssessment: cappedA,
    avgExams: cappedE,
    finalExam: finalVal,
    total,
  };
}
