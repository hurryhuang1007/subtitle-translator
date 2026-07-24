# syntax=docker/dockerfile:1

# better-sqlite3@13 的 linux-arm64 预编译包需要 GLIBC >= 2.38；
# Bookworm 只有 2.36，会在 ARM 上 dlopen 失败。Trixie 满足该要求。
FROM node:22-trixie-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /app

FROM base AS builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./data/app.db"
RUN mkdir -p data \
  && pnpm exec prisma generate \
  && pnpm build

# 单独准备 migrate 用的 Prisma CLI，避免把整棵 node_modules 打进运行镜像
WORKDIR /app/prisma-cli
RUN npm init -y \
  && npm install --omit=dev prisma@7.9.0 dotenv@17.4.2

FROM node:22-trixie-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER=true
ENV WATCH_DIR=/media
ENV DATABASE_URL="file:/app/data/app.db"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /app/logs /media

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma-cli ./prisma-cli
COPY --chmod=755 docker/entrypoint.sh ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
