#!/bin/sh
set -eu

mkdir -p /app/data /app/logs /media

./prisma-cli/node_modules/.bin/prisma migrate deploy

exec node server.js
