import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './utils/errors.js';
import { UPLOAD_ROOT } from './middleware/upload.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import classesRoutes from './routes/classes.js';
import subjectsRoutes from './routes/subjects.js';
import teacherAssignmentsRoutes from './routes/teacherAssignments.js';
import studentsRoutes from './routes/students.js';
import schoolSettingsRoutes from './routes/schoolSettings.js';
import attendanceRoutes from './routes/attendance.js';
import lateReportsRoutes from './routes/lateReports.js';
import homeworkRoutes from './routes/homework.js';
import weeklyPlansRoutes from './routes/weeklyPlans.js';
import absenceReasonsRoutes from './routes/absenceReasons.js';
import reportsRoutes from './routes/reports.js';
import parentRoutes from './routes/parent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FRONTEND_DIST = path.resolve(PROJECT_ROOT, 'frontend/dist');

function mountApiRoutes(app, prefix = '') {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/classes`, classesRoutes);
  app.use(`${prefix}/subjects`, subjectsRoutes);
  app.use(`${prefix}/teacher-assignments`, teacherAssignmentsRoutes);
  app.use(`${prefix}/students`, studentsRoutes);
  app.use(`${prefix}/school-settings`, schoolSettingsRoutes);
  app.use(`${prefix}/attendance`, attendanceRoutes);
  app.use(`${prefix}/late-reports`, lateReportsRoutes);
  app.use(`${prefix}/homework`, homeworkRoutes);
  app.use(`${prefix}/weekly-plans`, weeklyPlansRoutes);
  app.use(`${prefix}/absence-reasons`, absenceReasonsRoutes);
  app.use(`${prefix}/reports`, reportsRoutes);
  app.use(`${prefix}/parent`, parentRoutes);
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // SPA + same-origin /uploads; allow the app to load its own assets.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') ?? true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  const health = (_req, res) => {
    res.json({ ok: true, service: 'school-automation' });
  };
  app.get('/health', health);
  app.get('/api/health', health);

  // Uploaded files (logos, attachments) — served as static assets.
  app.use('/uploads', express.static(UPLOAD_ROOT));
  app.use('/api/uploads', express.static(UPLOAD_ROOT));

  // Local Vite proxy strips `/api` → mount APIs at root only in development.
  // In production, mounting at root would steal SPA routes like GET /reports
  // (browser refresh returns JSON auth errors instead of index.html).
  if (process.env.NODE_ENV !== 'production') {
    mountApiRoutes(app, '');
  }
  mountApiRoutes(app, '/api');

  const hasFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
  if (hasFrontend) {
    // Hashed Vite assets under /assets — cache forever (filename changes on build).
    app.use(
      '/assets',
      express.static(path.join(FRONTEND_DIST, 'assets'), {
        maxAge: '365d',
        immutable: true,
        setHeaders(res) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      })
    );
    app.use(
      express.static(FRONTEND_DIST, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/uploads') ||
        req.path === '/health'
      ) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
