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

  if (!map.id || !map.nameAr || !map.phone || !map.grade || !map.section) {
    return {
      rows: [],
      errors: [
        {
          index: 0,
          id: '',
          error:
            'تعذّر التعرف على أعمدة نور. المطلوب: رقم الطالب، اسم الطالب، الجوال، رقم الصف، الفصل',
        },
      ],
      columnMap: map,
    };
  }

  const rows = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const id = cellStr(raw, map.id);
    const nameAr = cellStr(raw, map.nameAr);
    const nameEn = cellStr(raw, map.nameEn) || nameAr;
    const gradeLevel = cellStr(raw, map.grade);
    const section = cellStr(raw, map.section);
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

    if (!phoneRaw) {
      errors.push({ index: i, id, error: 'رقم الجوال فارغ' });
      continue;
    }

    try {
      const parentPhone = normalizePhone(phoneRaw);
      rows.push({
        index: i,
        id,
        nameAr,
        nameEn,
        parentPhone,
        gradeLevel,
        section,
      });
    } catch (e) {
      errors.push({ index: i, id, error: e.message || 'رقم جوال غير صالح' });
    }
  }

  return { rows, errors, columnMap: map };
}

/** Display name for an auto-created class, e.g. "أول - 1". */
export function classDisplayName(gradeLevel, section) {
  return `${gradeLevel} - ${section}`;
}
