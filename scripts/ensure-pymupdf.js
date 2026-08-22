/**
 * Ensure pymupdf is importable via .python-deps (Render build artifact).
 * If missing, try a quick pip install into that folder (first boot only).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deps = path.join(root, '.python-deps');
const py = process.env.PYTHON || 'python3';

fs.mkdirSync(deps, { recursive: true });

const env = {
  ...process.env,
  PYTHONPATH: process.env.PYTHONPATH
    ? `${deps}${path.delimiter}${process.env.PYTHONPATH}`
    : deps,
};

const check = spawnSync(py, ['-c', 'import fitz'], {
  env,
  encoding: 'utf8',
});

if (check.status === 0) {
  console.log('[start] pymupdf ok');
  process.exit(0);
}

console.log('[start] pymupdf missing — installing into .python-deps…');
const install = spawnSync(
  'pip3',
  ['install', '--no-cache-dir', '--target', deps, 'pymupdf'],
  { cwd: root, stdio: 'inherit', env }
);

if (install.status !== 0) {
  console.warn('[start] pymupdf install failed — PDF timetable import will need Excel until fixed');
  process.exit(0);
}

const recheck = spawnSync(py, ['-c', 'import fitz'], { env, encoding: 'utf8' });
if (recheck.status === 0) {
  console.log('[start] pymupdf installed');
} else {
  console.warn('[start] pymupdf still not importable after install');
}
