#!/usr/bin/env bash
# Build for Render Node runtime (see render.yaml buildCommand — keep in sync).
# Install pymupdf into ./.python-deps (deployed with the app). --user alone is
# lost between build and runtime on Render.
set -euo pipefail

echo "==> Installing pymupdf into .python-deps (aSc PDF import)"
mkdir -p .python-deps
pip3 install --no-cache-dir --target .python-deps pymupdf

echo "==> Switching Prisma provider to PostgreSQL for this build"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

echo "==> Installing dependencies (include devDependencies for frontend build)"
npm install --include=dev

echo "==> Generating Prisma client"
npx prisma generate --schema=prisma/schema.prisma

echo "==> Building frontend"
npm run build -w frontend

echo "==> Render build complete"
