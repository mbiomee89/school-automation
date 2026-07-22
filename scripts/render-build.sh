#!/usr/bin/env bash
# Build for Render: Postgres schema + Prisma client + frontend + seed demo users.
set -euo pipefail

echo "==> Switching Prisma provider to PostgreSQL for this build"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

echo "==> Installing dependencies"
npm install

echo "==> Generating Prisma client + pushing schema"
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss

echo "==> Seeding demo accounts (idempotent upserts)"
node prisma/seed.js

echo "==> Building frontend"
npm run build -w frontend

echo "==> Render build complete"
