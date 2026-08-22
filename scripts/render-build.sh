#!/usr/bin/env bash
# Build for Render (no DB access during build — see scripts/start.js).
# Invoked by render.yaml buildCommand — keep these in sync.
set -euo pipefail

echo "==> Switching Prisma provider to PostgreSQL for this build"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

echo "==> Installing dependencies (include devDependencies for frontend build)"
npm install --include=dev

echo "==> Installing pymupdf for aSc timetable PDF import (optional but recommended)"
python3 -m pip install --user pymupdf 2>/dev/null || python -m pip install --user pymupdf 2>/dev/null || echo "WARN: pymupdf not installed; timetable PDF import needs Python+pymupdf"

echo "==> Generating Prisma client"
npx prisma generate --schema=prisma/schema.prisma

echo "==> Building frontend"
npm run build -w frontend

echo "==> Render build complete"
