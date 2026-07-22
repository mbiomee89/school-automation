import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';

export class AppError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export function notFound(message = 'Not found') {
  return new AppError(404, message);
}

export function badRequest(message, details) {
  return new AppError(400, message, details);
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(401, message);
}

export function forbidden(message = 'Forbidden') {
  return new AppError(403, message);
}

export function conflict(message, details) {
  return new AppError(409, message, details);
}

/**
 * Central Express error handler. Must be registered last.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    const first = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs || []).join(', ')}`)
      .find(Boolean);
    return res.status(400).json({
      error: first ? `بيانات غير صالحة — ${first}` : 'بيانات غير صالحة',
      details: err.flatten(),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 2MB)' : `Upload failed: ${err.message}`;
    return res.status(400).json({ error: message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = err.meta?.target ?? [];
      return res.status(409).json({
        error: 'A record with this value already exists',
        details: { fields },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Related record is in use or missing',
        details: { field: err.meta?.field_name },
      });
    }
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  console.error('[error]', err);
  // Surface the real message so testers on Render can see why an import/API call failed.
  const message =
    typeof err?.message === 'string' && err.message.trim()
      ? err.message
      : 'Internal server error';
  return res.status(500).json({ error: message });
}
