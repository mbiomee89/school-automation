# Production image: Node API + built frontend + Python/pymupdf for aSc PDF import.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && pip3 install --no-cache-dir --break-system-packages pymupdf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY prisma ./prisma
COPY scripts ./scripts
COPY backend ./backend
COPY frontend ./frontend

RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma \
  && npm install --include=dev \
  && npx prisma generate --schema=prisma/schema.prisma \
  && npm run build -w frontend

ENV NODE_ENV=production
ENV PYTHON=python3
# Render sets PORT; Express reads process.env.PORT
EXPOSE 10000

CMD ["node", "scripts/start.js"]
