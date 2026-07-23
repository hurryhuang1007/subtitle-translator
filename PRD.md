# SubtitleTranslator（项目代号）

你是一名资深全栈工程师，请帮我设计并开发一个可长期运行的字幕自动翻译服务。

## 项目定位

SubtitleTranslator 是一个类似 Sonarr / Radarr 的后台服务。

它长期监听指定目录，当检测到新的字幕文件时，自动进行翻译，并生成新的字幕文件。

整个项目需要提供现代化 Web UI，方便查看运行状态、任务队列、日志以及配置。

整个项目采用 **TypeScript** 开发。

---

# 第一版目标（MVP）

第一版只实现以下能力：

- 自动监听目录
- 自动翻译字幕
- 支持 Google Translate
- Web 管理后台
- Docker 部署

不要提前实现 OpenAI、Gemini、DeepL 等 Provider。

整个项目先围绕 Google Translate 做到稳定即可。

---

# 技术栈

必须使用：

- Next.js（App Router）
- React
- TypeScript
- Tailwind CSS
- Chakra UI v3
- Prisma
- SQLite
- chokidar（监听目录）
- google-translate-api-x（Google Translate）
- better-sqlite3

尽量不要引入 Redis。

任务队列第一版可以使用内存队列即可。

---

# 项目结构

请设计合理的目录结构。

例如：

```
src/

  app/
      dashboard/
      tasks/
      settings/
      logs/

  server/
      watcher/
      translator/
      parser/
      queue/
      db/

  lib/

  types/

prisma/

config/

logs/
```

要求：

前后端职责明确。

不要把所有逻辑塞进 API Route。

---

# 核心功能

## 1. 文件监听

支持：

递归监听多个目录。

监听：

- 新增文件
- 修改文件
- 文件移动

监听扩展名：

- .srt
- .ass
- .ssa
- .vtt

忽略：

- mkv
- mp4
- jpg
- png
- tmp
- hidden files

支持 debounce。

防止一个字幕连续触发多次。

---

## 2. 自动翻译

发现字幕：

例如：

```
Frieren.ass
```

立即进入任务队列。

流程：

```
发现字幕

↓

解析字幕

↓

Google Translate

↓

生成字幕

↓

保存

↓

更新数据库
```

---

## 3. 字幕解析

支持：

SRT

需要：

- 保留序号
- 保留时间轴
- 仅翻译文本

ASS

需要：

保留：

- Header
- Style
- Script Info
- Events

仅翻译：

Dialogue 文本。

不要破坏：

```
{\i1}
{\b1}
{\an8}
```

等 ASS Tag。

---

## 4. 输出规则

输入：

```
Frieren.ass
```

输出：

```
Frieren.zh.ass
```

不要覆盖原文件。

如果：

```
Frieren.zh.ass
```

已经存在：

默认跳过。

后续允许：

重新翻译。

输入可以设置，可以配置正则来做。

自定义配置输出：输出规则也可以自定义，zh 等语言标识用目标语言占位符表示。

---

## 5. 数据库

使用：

SQLite

Prisma

Task：

字段：

```
id

path

filename

hash

status

progress

language

error

createdAt

updatedAt
```

Status：

```
PENDING

RUNNING

SUCCESS

FAILED

SKIPPED
```

---

## 6. Dashboard

首页展示：

服务状态。

例如：

```
Watching

Running

Waiting

Success Today

Failed Today

CPU

Memory
```

可以增加：

最近翻译。

---

## 7. Task 页面

展示：

任务列表。

支持：

- 查看详情
- Retry
- Delete
- Filter

展示：

```
文件名

状态

开始时间

结束时间

耗时

错误信息
```

---

## 8. Settings

支持：

监听目录。

例如：

```
/media
```

支持多个目录。

支持：

输出语言。

例如：

```
zh-CN
```

支持：

输出后缀：

```
.zh
```

Google Translate：

API Key。

支持：

自动启动。

所有配置保存到数据库。

不要写死。

---

## 9. 日志

提供：

Logs 页面。

支持：

实时滚动。

支持：

按等级过滤：

INFO

WARN

ERROR

同时：

输出：

stdout

文件：

```
logs/app.log
```

---

## 10. 文件去重

避免重复翻译。

建议：

记录：

```
SHA256

mtime

size
```

如果：

文件没有变化。

直接：

SKIPPED。

---

## 11. UI

整体风格：

现代化。

参考：

- Vercel
- Trigger.dev
- Railway
- shadcn/ui Dashboard

要求：

简洁。

深色模式优先。

响应式布局。

左侧菜单。

顶部状态栏。

支持实时刷新。

---

## 12. Docker

提供：

Dockerfile

docker-compose.yml

映射：

```
/media
```

持久化：

SQLite

logs

config

---

## 13. API

REST API：

```
GET /api/tasks

GET /api/tasks/:id

POST /api/tasks/retry

DELETE /api/tasks/:id

GET /api/settings

PUT /api/settings

GET /api/status
```

---

## 14. 代码要求

全部使用 TypeScript。

严格类型。

不要使用 any。

合理拆分模块。

优先可维护性。

不要过度设计。

不要为了以后可能支持 OpenAI 而增加复杂抽象。

保持 MVP 简洁。

---

## 开发方式

不要一次输出全部代码。

按照以下流程进行：

第一步：

输出：

- 系统架构
- 数据流
- 项目目录
- Prisma Schema
- 数据库设计

等待确认。

第二步：

实现基础框架。

第三步：

实现文件监听。

第四步：

实现字幕解析。

第五步：

实现 Google Translate。

第六步：

实现 Dashboard。

第七步：

实现任务管理。

第八步：

实现 Docker。

整个开发过程中，请遵循“小步提交、可运行、可测试”的原则，每完成一个阶段，都确保项目能够正常启动和运行，再进入下一阶段。
