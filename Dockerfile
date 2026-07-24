# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
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
# 预编译的 better-sqlite3 可能要求比 Bookworm（glibc 2.36）更新的 GLIBC（如 2.38），
# 在多架构/ARM 上会 dlopen 失败；强制对本镜像的 glibc 重新编译。
RUN pnpm install --frozen-lockfile \
  && pnpm rebuild better-sqlite3

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./data/app.db"
RUN mkdir -p data \
  && pnpm exec prisma generate \
  && pnpm build \
  && pnpm prune --prod --ignore-scripts \
  && pnpm rebuild better-sqlite3

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER=true
ENV WATCH_DIR=/media
ENV DATABASE_URL="file:/app/data/app.db"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /app/logs /media

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --chmod=755 docker/entrypoint.sh ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
