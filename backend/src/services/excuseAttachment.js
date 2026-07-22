import fs from 'fs';
import path from 'path';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { notFound } from '../utils/errors.js';

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function guessMimeFromPath(relativePath) {
  const ext = path.extname(relativePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

/**
 * Load excuse attachment bytes from DB (preferred) or disk fallback.
 * Returns null if neither source is available (common after Render redeploy).
 */
export function loadExcuseAttachment(attendance) {
  if (attendance.absenceAttachmentData) {
    const mime = attendance.absenceAttachmentMime || guessMimeFromPath(attendance.absenceAttachmentUrl);
    const ext = MIME_EXT[mime] || path.extname(attendance.absenceAttachmentUrl || '') || '';
    return {
      buffer: Buffer.from(attendance.absenceAttachmentData),
      mime,
      fileName: `excuse-${attendance.id}${ext}`,
    };
  }

  if (attendance.absenceAttachmentUrl) {
    const absolute = path.join(UPLOAD_ROOT, attendance.absenceAttachmentUrl);
    if (fs.existsSync(absolute)) {
      const mime = attendance.absenceAttachmentMime || guessMimeFromPath(attendance.absenceAttachmentUrl);
      return {
        buffer: fs.readFileSync(absolute),
        mime,
        fileName: path.basename(attendance.absenceAttachmentUrl),
      };
    }
  }

  return null;
}

export function sendExcuseAttachment(res, attendance, { download = false } = {}) {
  const file = loadExcuseAttachment(attendance);
  if (!file) {
    throw notFound(
      'المرفق غير متوفر على الخادم. بعد إعادة نشر Render تُحذف الملفات القديمة — اطلب من ولي الأمر إعادة رفع العذر.'
    );
  }

  res.setHeader('Content-Type', file.mime);
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${file.fileName}"`
  );
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(file.buffer);
}

export function hasExcuseAttachment(attendance) {
  return !!(
    attendance.absenceAttachmentData ||
    attendance.absenceAttachmentUrl
  );
}

/** API path counselors use (auth required). */
export function counselorAttachmentApiPath(attendanceId) {
  return `/api/absence-reasons/${attendanceId}/attachment`;
}

/** API path parents use (auth required). */
export function parentAttachmentApiPath(attendanceId) {
  return `/api/parent/attendance/${attendanceId}/attachment`;
}
