# Subtitle Translator

基于 Next.js App Router 的字幕自动翻译服务，UI 使用 [Chakra UI](https://chakra-ui.com/) v3。

## 技术栈

- Next.js (App Router) + TypeScript
- Tailwind CSS + CSS Modules (SCSS)
- Chakra UI v3
- Prisma + SQLite
- chokidar / google-translate-api-x
- pnpm + ESLint + Prettier + Husky + commitlint

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

默认监听目录为项目下的 `media/`。

## Docker 部署

```bash
# 可选：指定宿主机字幕目录
# export MEDIA_PATH=/path/to/your/media

docker compose up -d --build
```

服务地址：[http://localhost:3000](http://localhost:3000)

### 卷映射

| 容器路径    | 默认宿主机 | 用途          |
| ----------- | ---------- | ------------- |
| `/media`    | `./media`  | 字幕监听目录  |
| `/app/data` | `./data`   | SQLite 数据库 |
| `/app/logs` | `./logs`   | 应用日志      |

可通过环境变量覆盖：

```bash
MEDIA_PATH=/mnt/media DATA_PATH=./data LOGS_PATH=./logs docker compose up -d
```

### 常用命令

```bash
docker compose logs -f
docker compose down
```

## 目录约定

源码在 `src/` 下，路径别名 `@` → `src`：

| 目录       | 用途               |
| ---------- | ------------------ |
| `app/`     | 页面路由           |
| `server/`  | 监听 / 解析 / 翻译 |
| `com/`     | 通用组件           |
| `service/` | 前端 API 封装      |
| `store/`   | 全局 MobX store    |
| `util/`    | 工具函数           |

## 常用脚本

```bash
pnpm dev             # 开发
pnpm lint            # 日常校验
pnpm build           # 生产构建
pnpm db:migrate      # 开发迁移
pnpm db:deploy       # 生产迁移
pnpm test:parser     # 解析器测试
pnpm smoke:translate # 翻译冒烟测试
```
