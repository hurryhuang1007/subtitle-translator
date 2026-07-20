# Subtitle Translator

基于 Next.js App Router 的字幕翻译项目，UI 使用 [Chakra UI](https://chakra-ui.com/) v3。

## 技术栈

- Next.js (App Router) + TypeScript
- Tailwind CSS + CSS Modules (SCSS)
- Chakra UI v3
- MobX / ahooks
- pnpm + ESLint + Prettier + Husky + commitlint

## 开始

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

拷贝 `.env.example` 为 `.env.local` 按需填写环境变量。

## 目录约定

源码在 `src/` 下，路径别名 `@` → `src`：

| 目录       | 用途               |
| ---------- | ------------------ |
| `app/`     | 页面路由           |
| `asset/`   | 通用静态资源       |
| `com/`     | 通用组件           |
| `com/ui/`  | Chakra UI snippets |
| `config/`  | 定值配置           |
| `modal/`   | 通用弹窗           |
| `service/` | API 定义           |
| `store/`   | 全局 MobX store    |
| `util/`    | 工具函数           |

## 常用脚本

```bash
pnpm dev    # 开发
pnpm lint   # 日常校验
pnpm build  # 生产构建
```
