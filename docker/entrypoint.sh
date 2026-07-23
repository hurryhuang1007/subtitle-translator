#!/bin/sh
set -eu

mkdir -p /app/data /app/logs /media

pnpm exec prisma migrate deploy

exec pnpm start
