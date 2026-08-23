import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { badRequest } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src/middleware -> backend/src -> backend -> project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

/** Absolute path to the uploads root (not publicly served). */
export const UPLOAD_ROOT = path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR || './backend/uploads');

/**
 * Return a relative path safe to store under UPLOAD_ROOT, or null if unsafe.
 * Rejects empty, absolute, NUL, and any `..` segment.
 */
export function sanitizeUploadRelativePath(relativePath) {
  if (relativePath == null) return null;
  const raw = String(relativePath).trim();
  if (!raw || raw.includes('\0')) return null;
  if (path.isAbsolute(raw)) return null;
  // Windows drive / UNC disguised as relative
  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\')) return null;

  const forward = raw.replace(/\\/g, '/');
  if (forward.split('/').includes('..')) return null;

  const normalized = path.posix.normalize(forward);
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized) ||
    normalized.split('/').includes('..')
  ) {
    return null;
  }
  return normalized;
}

/**
 * Resolve a stored relative upload path to an absolute path under UPLOAD_ROOT.
 * Returns null if the path would escape the uploads root.
 */
export function resolveSafeUploadPath(relativePath) {
  const safeRel = sanitizeUploadRelativePath(relativePath);
  if (!safeRel) return null;
  const root = path.resolve(UPLOAD_ROOT);
  const absolute = path.resolve(root, safeRel);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(prefix)) return null;
  return absolute;
}

const LOGO_DIR = path.join(UPLOAD_ROOT, 'logos');
fs.mkdirSync(LOGO_DIR, { recursive: true });

const ATTACHMENT_DIR = path.join(UPLOAD_ROOT, 'absence-reasons');
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });

const ALLOWED_LOGO_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  // SVG omitted — can embed scripts and is an XSS risk when served same-origin.
]);
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const ALLOWED_ATTACHMENT_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);
const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGO_DIR),
  filename: (_req, file, cb) => {
    // Random server-generated filename — never trust the client's original name.
    const ext = ALLOWED_LOGO_MIME.get(file.mimetype) ?? path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

/** Single-file "logo" upload middleware: image MIME allowlist + 2MB size cap. */
export const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: MAX_LOGO_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_LOGO_MIME.has(file.mimetype)) {
      return cb(badRequest('Only PNG, JPEG, or SVG images are allowed'));
    }
    cb(null, true);
  },
}).single('logo');

const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACHMENT_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_ATTACHMENT_MIME.get(file.mimetype) ?? path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

/** Optional single-file absence-reason attachment: image/PDF, 2MB cap. */
export const uploadAbsenceAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_ATTACHMENT_MIME.has(file.mimetype)) {
      return cb(badRequest('يُسمح بملفات PNG أو JPEG أو WebP أو PDF فقط'));
    }
    cb(null, true);
  },
}).single('attachment');

/** Sniff PNG/JPEG/WebP/PDF from magic bytes; ignore client-claimed MIME. */
export function sniffAttachmentMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  return null;
}

/** After multer: verify magic bytes and overwrite file.mimetype with sniffed type. */
export function assertSniffedAttachment(req, _res, next) {
  if (!req.file) return next();
  try {
    const buf = fs.readFileSync(req.file.path);
    const sniffed = sniffAttachmentMime(buf);
    if (!sniffed || !ALLOWED_ATTACHMENT_MIME.has(sniffed)) {
      fs.unlink(req.file.path, () => {});
      return next(badRequest('محتوى الملف غير مسموح. استخدم PNG أو JPEG أو WebP أو PDF'));
    }
    req.file.mimetype = sniffed;
    return next();
  } catch (err) {
    return next(err);
  }
}

const ALLOWED_SPREADSHEET_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'text/csv',
  'application/csv',
]);
const MAX_SPREADSHEET_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** In-memory spreadsheet upload for Noor import (xlsx/xls/csv). */
export const uploadNoorSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SPREADSHEET_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const okExt = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
    if (!okExt && !ALLOWED_SPREADSHEET_MIME.has(file.mimetype)) {
      return cb(badRequest('Only Excel (.xlsx/.xls) or CSV files are allowed'));
    }
    cb(null, true);
  },
}).single('file');

const ALLOWED_TIMETABLE_MIME = new Set([
  ...ALLOWED_SPREADSHEET_MIME,
  'application/pdf',
]);

/** In-memory upload for aSc timetable PDF or flat Excel/CSV. */
export const uploadTimetableFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SPREADSHEET_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const okExt =
      name.endsWith('.pdf') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      name.endsWith('.csv');
    if (!okExt && !ALLOWED_TIMETABLE_MIME.has(file.mimetype)) {
      return cb(badRequest('يُقبل PDF أو Excel (.xlsx/.xls) أو CSV'));
    }
    cb(null, true);
  },
}).single('file');

const TEACHER_DOC_DIR = path.join(UPLOAD_ROOT, 'teacher-documents');
fs.mkdirSync(TEACHER_DOC_DIR, { recursive: true });

const MAX_TEACHER_PDF_BYTES = 5 * 1024 * 1024; // 5MB

/** In-memory PDF upload for teacher employment dossier (5MB). */
export const uploadTeacherPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TEACHER_PDF_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const okExt = name.endsWith('.pdf');
    if (!okExt && file.mimetype !== 'application/pdf') {
      return cb(badRequest('يُسمح بملفات PDF فقط'));
    }
    cb(null, true);
  },
}).single('file');

/** True when buffer starts with PDF magic bytes `%PDF`. */
export function isPdfBuffer(buffer) {
  return Boolean(
    buffer &&
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
  );
}

/** After multer memory upload: require PDF magic bytes. */
export function assertPdfSniff(req, _res, next) {
  if (!req.file) return next(badRequest('الملف مطلوب'));
  if (!isPdfBuffer(req.file.buffer)) {
    return next(badRequest('محتوى الملف ليس PDF صالحاً'));
  }
  req.file.mimetype = 'application/pdf';
  return next();
}

/** Safe display name for stored PDFs (basename + strip control chars). */
export function safePdfDisplayName(originalName) {
  const base = path.basename(String(originalName || 'document.pdf')).replace(/[^\w.\u0600-\u06FF\- ]+/g, '_');
  const trimmed = base.trim().slice(0, 180) || 'document.pdf';
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

/** Optional local disk mirror under uploads/teacher-documents (Render-ephemeral). */
export function writeTeacherPdfMirror(teacherId, docType, buffer) {
  const rel = path.posix.join(
    'teacher-documents',
    String(teacherId),
    `${docType}-${crypto.randomBytes(8).toString('hex')}.pdf`
  );
  const absolute = resolveSafeUploadPath(rel);
  if (!absolute) return null;
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, buffer);
  return rel;
}

/** @deprecated Logos are served from GET /api/school-settings/logo — do not use public /uploads. */
export function logoPathToUrl(logoPath) {
  if (!logoPath) return null;
  return `/api/school-settings/logo`;
}

/** @deprecated Sensitive files must not be exposed via public /uploads URLs. */
export function uploadPathToUrl(_relativePath) {
  return null;
}

/** Delete a previously stored upload file (relative to UPLOAD_ROOT); ignores missing/unsafe paths. */
export function deleteUploadFile(relativePath) {
  const absolute = resolveSafeUploadPath(relativePath);
  if (!absolute) return;
  fs.unlink(absolute, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('[upload] failed to delete file', absolute, err);
    }
  });
}
