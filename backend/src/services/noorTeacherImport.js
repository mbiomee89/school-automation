import XLSX from 'xlsx';
import { normalizePhone } from '../utils/phone.js';

/**
 * Noor GetSchoolTeachersDataReport columns we care about.
 * The workbook has title rows; real headers include: الإسم، البريد الإلكتروني، الجوال، رقم الهوية
 */
const COL = {
  name: ['الإسم', 'الاسم', 'اسم المعلم', 'name', 'teachername'],
  email: ['البريد الإلكتروني', 'البريد الالكتروني', 'email', 'mail'],
  phone: ['الجوال', 'جوال', 'الهاتف', 'phone', 'mobile'],
  nationalId: ['رقم الهوية', 'الهوية', 'هوية', 'nationalid', 'id'],
};

function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\n/g, '');
}

function pickColumn(headers, aliases) {
  const normalized = headers.map((h, index) => ({ raw: h, key: normHeader(h), index }));
  for (const alias of aliases) {
    const a = normHeader(alias);
    const hit = normalized.find((h) => h.key === a || (a.length > 2 && h.key.includes(a)));
    if (hit) return hit.index;
  }
  return -1;
}

function cellAt(row, index) {
  if (index < 0 || !row) return '';
  const v = row[index];
  if (v == null) return '';
  return String(v).trim();
}

function looksLikeHeaderRow(row) {
  const joined = row.map((c) => normHeader(c)).join('|');
  return (
    (joined.includes('الاسم') || joined.includes('الإسم') || joined.includes('name')) &&
    (joined.includes('البريد') || joined.includes('email')) &&
    (joined.includes('الجوال') || joined.includes('phone') || joined.includes('mobile'))
  );
}

/**
 * Parse Noor GetSchoolTeachersDataReport workbook.
 * Only extracts: name, email, phone (optional nationalId for error rows).
 */
export function parseNoorTeachersSpreadsheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ index: 0, id: '', error: 'المصنف فارغ' }] };
  }

  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  });

  const headerIdx = aoa.findIndex((row) => Array.isArray(row) && looksLikeHeaderRow(row));
  if (headerIdx < 0) {
    return {
      rows: [],
      errors: [
        {
          index: 0,
          id: '',
          error:
            'تعذّر التعرف على أعمدة تقرير معلمي نور. المطلوب: الإسم، البريد الإلكتروني، الجوال',
        },
      ],
    };
  }

  const headerRow = aoa[headerIdx];
  const map = {
    name: pickColumn(headerRow, COL.name),
    email: pickColumn(headerRow, COL.email),
    phone: pickColumn(headerRow, COL.phone),
    nationalId: pickColumn(headerRow, COL.nationalId),
  };

  if (map.name < 0 || map.email < 0 || map.phone < 0) {
    return {
      rows: [],
      errors: [
        {
          index: headerIdx,
          id: '',
          error:
            'تعذّر التعرف على أعمدة تقرير معلمي نور. المطلوب: الإسم، البريد الإلكتروني، الجوال',
        },
      ],
      columnMap: map,
    };
  }

  const rows = [];
  const errors = [];

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const raw = aoa[i];
    if (!Array.isArray(raw)) continue;

    const name = cellAt(raw, map.name);
    const emailRaw = cellAt(raw, map.email);
    const phoneRaw = cellAt(raw, map.phone);
    const nationalId = cellAt(raw, map.nationalId);

    if (!name && !emailRaw && !phoneRaw && !nationalId) continue;

    if (!name || !emailRaw) {
      errors.push({
        index: i,
        id: nationalId || emailRaw || '—',
        error: 'حقول ناقصة (الإسم / البريد الإلكتروني)',
      });
      continue;
    }

    const email = emailRaw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ index: i, id: nationalId || email, error: 'بريد إلكتروني غير صالح' });
      continue;
    }

    if (!phoneRaw) {
      errors.push({ index: i, id: nationalId || email, error: 'رقم الجوال فارغ' });
      continue;
    }

    try {
      // Sheet often stores 9665XXXXXXXX without leading +
      const phone = normalizePhone(phoneRaw.startsWith('+') ? phoneRaw : `+${phoneRaw}`);
      rows.push({
        index: i,
        name,
        email,
        phone,
        nationalId: nationalId || null,
      });
    } catch (e) {
      errors.push({
        index: i,
        id: nationalId || email,
        error: e.message || 'رقم جوال غير صالح',
      });
    }
  }

  return { rows, errors, columnMap: map };
}
