#!/usr/bin/env bash
# Build for Render Node runtime (see render.yaml buildCommand — keep in sync).
# Native images include python3-pip; pymupdf enables aSc teachers table.pdf import.
set -euo pipefail

echo "==> Installing pymupdf for aSc PDF timetable import"
pip3 install --user --no-cache-dir pymupdf

echo "==> Switching Prisma provider to PostgreSQL for this build"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

echo "==> Installing dependencies (include devDependencies for frontend build)"
npm install --include=dev

echo "==> Generating Prisma client"
npx prisma generate --schema=prisma/schema.prisma

echo "==> Building frontend"
npm run build -w frontend

echo "==> Render build complete"
