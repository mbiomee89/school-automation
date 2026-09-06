import XLSX from 'xlsx';
import { normalizePhone } from '../utils/phone.js';

/**
 * Column aliases seen in Noor / StudentGuidance exports (Arabic + English).
 */
const COL = {
  id: ['رقم الطالب', 'رقم الهوية', 'هوية', 'id', 'studentid', 'nationalid'],
  nameAr: ['اسم الطالب', 'الاسم', 'namear', 'name', 'studentname'],
  nameEn: ['الاسم بالإنجليزية', 'nameen', 'englishname'],
  phone: ['الجوال', 'جوال ولي الأمر', 'رقم الجوال', 'الهاتف', 'phone', 'parentphone', 'mobile'],
  grade: ['رقم الصف', 'الصف', 'المرحلة', 'grade', 'gradelevel', 'الصف الدراسي'],
  section: ['الفصل', 'الشعبة', 'section', 'classsection'],
};

function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function pickColumn(headers, aliases) {
  const normalized = headers.map((h) => ({ raw: h, key: normHeader(h) }));
  for (const alias of aliases) {
    const a = normHeader(alias);
    const hit = normalized.find((h) => h.key === a || h.key.includes(a));
    if (hit) return hit.raw;
  }
  return null;
}

function cellStr(row, key) {
  if (!key) return '';
  const v = row[key];
  if (v == null) return '';
  return String(v).trim();
}

/** Excel often stores IDs as numbers → "1160286453.0" or scientific notation.
 * Avoid Number() for long IDs (precision loss past 15 digits). */
function normalizeStudentId(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d+\.0+$/.test(s)) {
    return s.replace(/\.0+$/, '');
  }
  const sci = s.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (sci) {
    const digits = sci[2] + (sci[3] || '');
    const exp = parseInt(sci[4], 10);
    const intLen = sci[2].length;
    const newPoint = intLen + exp;
    let out;
    if (newPoint <= 0) {
      out = '0';
    } else if (newPoint >= digits.length) {
      out = digits + '0'.repeat(newPoint - digits.length);
    } else {
      out = digits.slice(0, newPoint);
    }
    return out.replace(/^0+(?=\d)/, '') || '0';
  }
  // Strip accidental thousand separators / spaces
  if (/^[\d\s,]+$/.test(s)) {
    return s.replace(/[\s,]/g, '');
  }
  return s;
}

/**
 * Parse a Noor StudentGuidance workbook buffer into normalized row objects.
 * Expected Arabic headers: الجوال, الفصل, رقم الصف, اسم الطالب, رقم الطالب
 */
export function parseNoorSpreadsheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ index: 0, id: '', error: 'Empty workbook' }] };
  }

  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (rawRows.length === 0) {
    return { rows: [], errors: [{ index: 0, id: '', error: 'No data rows found' }] };
  }

  const headers = Object.keys(rawRows[0]);
  const map = {
    id: pickColumn(headers, COL.id),
    nameAr: pickColumn(headers, COL.nameAr),
    nameEn: pickColumn(headers, COL.nameEn),
    phone: pickColumn(headers, COL.phone),
    grade: pickColumn(headers, COL.grade),
    section: pickColumn(headers, COL.section),
  };

  if (!map.id || !map.nameAr || !map.grade || !map.section) {
    return {
      rows: [],
      errors: [
        {
          index: 0,
          id: '',
          error:
            'تعذّر التعرف على أعمدة نور. المطلوب: رقم الطالب، اسم الطالب، رقم الصف، الفصل',
        },
      ],
      columnMap: map,
    };
  }

  const rows = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const id = normalizeStudentId(cellStr(raw, map.id));
    const nameAr = cellStr(raw, map.nameAr);
    const nameEn = cellStr(raw, map.nameEn) || nameAr;
    const rawGrade = cellStr(raw, map.grade);
    const rawSection = cellStr(raw, map.section);
    const rawClass = rawNoorClass(rawGrade, rawSection);
    const suggested = normalizeNoorClass(rawGrade, rawSection);
    const gradeLevel = rawClass.gradeLevel;
    const section = rawClass.section;
    const phoneRaw = cellStr(raw, map.phone);

    if (!id && !nameAr && !phoneRaw) continue; // blank line

    if (!id || !nameAr || !gradeLevel || !section) {
      errors.push({
        index: i,
        id: id || '—',
        error: 'حقول ناقصة (رقم الطالب / الاسم / الصف / الفصل)',
      });
      continue;
    }

    const base = {
      index: i,
      id,
      nameAr,
      nameEn,
      gradeLevel,
      section,
      suggestedGradeLevel: suggested.gradeLevel,
      suggestedSection: suggested.section,
    };

    if (!phoneRaw) {
      rows.push({
        ...base,
        parentPhone: '',
        phoneReviewReason: 'missing',
      });
      continue;
    }

    try {
      rows.push({
        ...base,
        parentPhone: normalizePhone(phoneRaw),
      });
    } catch {
      rows.push({
        ...base,
        parentPhone: '',
        phoneReviewReason: 'invalid',
        rawPhone: phoneRaw,
      });
    }
  }

  return { rows, errors, columnMap: map };
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

const SECTION_FROM_LATIN = { a: 'أ', b: 'ب', c: 'ج', d: 'د' };

const DIGIT_FROM_SECTION = {
  أ: '1',
  ب: '2',
  ج: '3',
  د: '4',
  ه: '5',
  و: '6',
  ز: '7',
  ح: '8',
};

function foldArabicDigits(s) {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** File identity: keep Noor digits. Only fold Arabic-Indic numerals. */
export function rawNoorClass(gradeLevel, section) {
  const grade = String(gradeLevel ?? '').trim();
  const sec = foldArabicDigits(String(section ?? '').trim());
  return { gradeLevel: grade, section: sec };
}

export function fileClassKey(grade, section) {
  return `${String(grade ?? '').trim()}||${String(section ?? '').trim()}`;
}

export function fileClassLabel(grade, section) {
  const g = String(grade ?? '').trim();
  const s = String(section ?? '').trim();
  if (!s) return g;
  if (/^[1-8]$/.test(s)) return `${g} - ${s}`;
  return `${g} ${s}`.trim();
}

/**
 * Noor stores شعبة as 1/2; the weekly table uses أ/ب (أول-2 → أول ب).
 * Suggestion only — do not write this without admin choice.
 */
export function normalizeNoorClass(gradeLevel, section) {
  let grade = String(gradeLevel ?? '').trim();
  if (grade === 'اول') grade = 'أول';
  if (grade === 'ثاني') grade = 'ثان';

  let sec = foldArabicDigits(String(section ?? '').trim());
  if (/^[1-8]$/.test(sec)) sec = SECTION_FROM_DIGIT[Number(sec)];
  else if (SECTION_FROM_LATIN[sec.toLowerCase()]) sec = SECTION_FROM_LATIN[sec.toLowerCase()];

  return { gradeLevel: grade, section: sec };
}

/** Letter section → the digit Noor previously stored (ب → "2"). */
export function legacyDigitSection(section) {
  return DIGIT_FROM_SECTION[String(section ?? '').trim()] || null;
}

/** Display name, e.g. "أول ب". */
export function classDisplayName(gradeLevel, section) {
  const n = normalizeNoorClass(gradeLevel, section);
  return `${n.gradeLevel} ${n.section}`.trim();
}
