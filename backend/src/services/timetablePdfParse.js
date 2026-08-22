import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { badRequest } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARSER_SCRIPT = path.join(__dirname, 'ascTimetablePdf.py');

/**
 * Run the pymupdf aSc parser; returns { view, slots, errors, fileName }.
 */
export function parseAscTimetablePdf(buffer, originalName = 'timetable.pdf') {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asc-tt-'));
    const pdfPath = path.join(tmpDir, originalName.replace(/[^\w.\u0600-\u06FF-]+/g, '_') || 'timetable.pdf');
    const outPath = path.join(tmpDir, 'out.json');
    fs.writeFileSync(pdfPath, buffer);

    const py = process.env.PYTHON || process.env.PYTHON_PATH || 'python';
    const child = spawn(py, [PARSER_SCRIPT, pdfPath, '--out', outPath], {
      windowsHide: true,
    });

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      cleanup(tmpDir);
      reject(
        badRequest(
          `تعذّر تشغيل محلل PDF (Python). ثبّت Python وpymupdf أو ارفع ملف Excel. ${err.message}`
        )
      );
    });

    child.on('close', (code) => {
      try {
        if (!fs.existsSync(outPath)) {
          cleanup(tmpDir);
          return reject(
            badRequest(
              `فشل تحليل PDF (رمز ${code}). تأكد من تثبيت pymupdf: pip install pymupdf. ${stderr.slice(0, 200)}`
            )
          );
        }
        const raw = fs.readFileSync(outPath, 'utf8');
        const data = JSON.parse(raw);
        cleanup(tmpDir);
        if (data.error && (!data.slots || data.slots.length === 0)) {
          return reject(badRequest(data.error));
        }
        resolve({
          view: data.view || 'unknown',
          fileName: data.fileName || originalName,
          slots: data.slots || [],
          errors: data.errors || [],
        });
      } catch (err) {
        cleanup(tmpDir);
        reject(badRequest(`تعذّر قراءة نتيجة التحليل: ${err.message}`));
      }
    });
  });
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const COL = {
  teacher: ['المعلم', 'اسم المعلم', 'teacher', 'teachername', 'اسم'],
  class: ['الفصل', 'الصف', 'class', 'classname'],
  subject: ['المادة', 'الماده', 'subject', 'subjectname'],
  day: ['اليوم', 'day', 'weekday'],
  period: ['الحصة', 'الحصه', 'الفترة', 'period', 'حصة'],
};

function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function pickColumn(headers, aliases) {
  const normalized = headers.map((h, index) => ({ key: normHeader(h), index }));
  for (const alias of aliases) {
    const a = normHeader(alias);
    const hit = normalized.find((h) => h.key === a || (a.length > 1 && h.key.includes(a)));
    if (hit) return hit.index;
  }
  return -1;
}

const DAY_MAP = {
  sun: 'SUN',
  sunday: 'SUN',
  احد: 'SUN',
  الأحد: 'SUN',
  الاحد: 'SUN',
  mon: 'MON',
  monday: 'MON',
  اثنين: 'MON',
  الإثنين: 'MON',
  الاثنين: 'MON',
  tue: 'TUE',
  tuesday: 'TUE',
  ثلاثاء: 'TUE',
  الثلاثاء: 'TUE',
  wed: 'WED',
  wednesday: 'WED',
  اربعاء: 'WED',
  الأربعاء: 'WED',
  الاربعاء: 'WED',
  thu: 'THU',
  thursday: 'THU',
  خميس: 'THU',
  الخميس: 'THU',
};

function normalizeDayCell(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/^ال/, '');
  const key = s.toLowerCase().replace(/\s+/g, '');
  if (DAY_MAP[key]) return DAY_MAP[key];
  if (DAY_MAP[s]) return DAY_MAP[s];
  const upper = s.toUpperCase();
  if (['SUN', 'MON', 'TUE', 'WED', 'THU'].includes(upper)) return upper;
  return null;
}

/**
 * Flat Excel/CSV: teacher, class, subject, day, period columns (Arabic headers OK).
 */
export function parseTimetableSpreadsheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { view: 'spreadsheet', slots: [], errors: [{ error: 'المصنف فارغ' }] };
  }
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  });
  if (!aoa.length) {
    return { view: 'spreadsheet', slots: [], errors: [{ error: 'لا توجد صفوف' }] };
  }

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const joined = (aoa[i] || []).map(normHeader).join('|');
    if (
      (joined.includes('معلم') || joined.includes('teacher')) &&
      (joined.includes('فصل') || joined.includes('class')) &&
      (joined.includes('ماد') || joined.includes('subject'))
    ) {
      headerIdx = i;
      break;
    }
  }

  const headers = aoa[headerIdx] || [];
  const map = {
    teacher: pickColumn(headers, COL.teacher),
    class: pickColumn(headers, COL.class),
    subject: pickColumn(headers, COL.subject),
    day: pickColumn(headers, COL.day),
    period: pickColumn(headers, COL.period),
  };

  if (map.teacher < 0 || map.class < 0 || map.subject < 0 || map.day < 0 || map.period < 0) {
    return {
      view: 'spreadsheet',
      slots: [],
      errors: [
        {
          error:
            'أعمدة مطلوبة: المعلم، الفصل، المادة، اليوم، الحصة (أو teacher/class/subject/day/period)',
        },
      ],
    };
  }

  const slots = [];
  const errors = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    const teacherName = String(row[map.teacher] ?? '').trim();
    const classLabel = String(row[map.class] ?? '').trim();
    const subjectName = String(row[map.subject] ?? '').trim();
    const dayOfWeek = normalizeDayCell(row[map.day]);
    const period = String(row[map.period] ?? '').trim();
    if (!teacherName && !classLabel && !subjectName) continue;
    if (!teacherName || !classLabel || !subjectName || !dayOfWeek || !period) {
      errors.push({ index: i + 1, error: 'صف ناقص' });
      continue;
    }
    slots.push({ teacherName, classLabel, subjectName, dayOfWeek, period });
  }

  return { view: 'spreadsheet', slots, errors };
}

export async function parseTimetableUpload(file) {
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.pdf')) {
    return parseAscTimetablePdf(file.buffer, file.originalname);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return parseTimetableSpreadsheet(file.buffer);
  }
  throw badRequest('يُقبل PDF (جدول aSc) أو Excel/CSV');
}
