import { createRequire } from 'node:module';

import { defineConfig } from 'prisma/config';

// Docker standalone 运行时未必有 dotenv；DATABASE_URL 可由环境变量直接提供
try {
  createRequire(import.meta.url)('dotenv/config');
} catch {
  // ignore
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
