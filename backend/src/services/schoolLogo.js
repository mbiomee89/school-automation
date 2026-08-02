import fs from 'fs';
import path from 'path';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { prisma } from '../utils/prisma.js';

const SINGLETON_ID = 1;

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
};

function guessMimeFromPath(relativePath) {
  const ext = path.extname(relativePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

/** Stable public URL for <img src> (no JWT). Cache-bust with updatedAt. */
export function schoolLogoUrl(settings) {
  if (!settings) return null;
  // logoMime is set whenever logoData is stored; logoPath may exist alone (legacy disk).
  const hasLogo = !!(settings.logoData || settings.logoPath || settings.logoMime);
  if (!hasLogo) return null;
  const v = settings.updatedAt ? new Date(settings.updatedAt).getTime() : Date.now();
  return `/api/school-settings/logo?v=${v}`;
}

/**
 * Load logo bytes from DB (preferred) or disk.
 * If disk has a file but DB is empty, backfill Postgres so the next redeploy keeps it.
 */
export async function loadSchoolLogo() {
  const settings = await prisma.schoolSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!settings) return null;

  if (settings.logoData) {
    const mime = settings.logoMime || guessMimeFromPath(settings.logoPath) || 'image/png';
    const ext = MIME_EXT[mime] || path.extname(settings.logoPath || '') || '.png';
    return {
      buffer: Buffer.from(settings.logoData),
      mime,
      fileName: `school-logo${ext}`,
    };
  }

  if (settings.logoPath) {
    const absolute = path.join(UPLOAD_ROOT, settings.logoPath);
    if (fs.existsSync(absolute)) {
      const buffer = fs.readFileSync(absolute);
      const mime = settings.logoMime || guessMimeFromPath(settings.logoPath);
      // One-time migrate: persist ephemeral disk logo into Postgres.
      try {
        await prisma.schoolSettings.update({
          where: { id: SINGLETON_ID },
          data: { logoData: buffer, logoMime: mime },
        });
      } catch (err) {
        console.error('[schoolLogo] failed to backfill logo into DB', err);
      }
      const ext = MIME_EXT[mime] || path.extname(settings.logoPath) || '.png';
      return { buffer, mime, fileName: `school-logo${ext}` };
    }
  }

  return null;
}
