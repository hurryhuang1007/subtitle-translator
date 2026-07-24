# Subtitle Translator

基于 Next.js App Router 的字幕自动翻译服务，UI 使用 [Chakra UI](https://chakra-ui.com/) v3。

镜像会通过 GitHub Actions 自动构建并推送到 GHCR：

`ghcr.io/hurryhuang1007/subtitle-translator`

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

## 部署

### 方式一：拉取预构建镜像（推荐）

`main` 分支推送后会自动发布 `latest`；打 `v*` 标签会额外发布语义化版本（如 `1.0.0`）。

```bash
mkdir -p media data logs

# 首次若镜像为私有，先登录 GHCR（公开包可跳过）
# echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

docker pull ghcr.io/hurryhuang1007/subtitle-translator:latest

docker run -d \
  --name subtitle-translator \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$PWD/media:/media" \
  -v "$PWD/data:/app/data" \
  -v "$PWD/logs:/app/logs" \
  ghcr.io/hurryhuang1007/subtitle-translator:latest
```

或使用 Compose（默认拉取 GHCR 镜像；加 `--build` 则本地构建）：

```bash
# 可选：指定宿主机字幕目录
# export MEDIA_PATH=/path/to/your/media

docker compose up -d
# 本地构建：docker compose up -d --build
```

服务地址：[http://localhost:3000](http://localhost:3000)

### 方式二：本地构建镜像

```bash
docker compose up -d --build
```

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

### 镜像标签

| 标签            | 来源                  |
| --------------- | --------------------- |
| `latest`        | 推送到默认分支 `main` |
| `sha-<commit>`  | 每次构建对应的短 SHA  |
| `1.2.3` / `1.2` | 推送 git tag `v1.2.3` |

### 常用命令

```bash
docker compose logs -f
docker compose pull && docker compose up -d
docker compose down
```

### GitHub Actions

工作流文件：`.github/workflows/docker-publish.yml`

触发条件：

- push 到 `main`
- push `v*` tag
- 手动 `workflow_dispatch`

产物推送到：`ghcr.io/hurryhuang1007/subtitle-translator`

若拉取失败，到仓库 **Packages** 将包可见性设为 Public，或确保 Actions 的 Workflow permissions 允许读写 packages。

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
