#!/bin/sh
set -eu

mkdir -p /app/data /app/logs /media

# prisma.config.ts 从 /app 加载，模块解析需能找到 prisma-cli 里的依赖
export NODE_PATH="/app/prisma-cli/node_modules${NODE_PATH:+:$NODE_PATH}"

./prisma-cli/node_modules/.bin/prisma migrate deploy

exec node server.js
