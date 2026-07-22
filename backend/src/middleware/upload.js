import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { badRequest } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src/middleware -> backend/src -> backend -> project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

/** Absolute path to the uploads root, served statically at /uploads. */
export const UPLOAD_ROOT = path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR || './backend/uploads');

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
      return cb(badRequest('Only PNG, JPEG, WebP, or PDF files are allowed'));
    }
    cb(null, true);
  },
}).single('attachment');

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

/** Relative path (e.g. "logos/abc123.png") -> public URL under /uploads, or null. */
export function logoPathToUrl(logoPath) {
  if (!logoPath) return null;
  return `/uploads/${logoPath.replace(/\\/g, '/')}`;
}

/** Relative path under uploads → public URL. */
export function uploadPathToUrl(relativePath) {
  if (!relativePath) return null;
  return `/uploads/${relativePath.replace(/\\/g, '/')}`;
}

/** Delete a previously stored upload file (relative to UPLOAD_ROOT); ignores missing files. */
export function deleteUploadFile(relativePath) {
  if (!relativePath) return;
  const absolute = path.join(UPLOAD_ROOT, relativePath);
  fs.unlink(absolute, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('[upload] failed to delete file', absolute, err);
    }
  });
}
