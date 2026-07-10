# Kaven's Blog — 迁移到 Astro + React + TS + Tailwind + Drizzle + SQLite

## 迁移进度

| Phase | 内容 | 状态 |
|---|---|---|
| Phase 1 | 项目骨架 + Drizzle Schema + Tailwind 基础 | ✅ **已完成** (2026-07-10) |
| Phase 2 | API Routes 迁移 (18 端点) | ⬜ 待开始 |
| Phase 3 | SSR 页面 — 首页、文章详情、游戏新闻 | ⬜ 待开始 |
| Phase 4 | React Islands — 交互功能 | ⬜ 待开始 |
| Phase 5 | 清理、测试、生产加固 | ⬜ 待开始 |

## Context

当前 Kaven's Blog 使用 Express + Vanilla JS + better-sqlite3 裸 SQL + 手写 CSS 构建，约 5400 行代码分布在 4 个核心文件中。目标是迁移到现代前端栈：Astro SSR + React Islands + TypeScript + Tailwind CSS v4 + Drizzle ORM + SQLite，获得类型安全、组件化、更好的开发体验和可维护性。

用户偏好已确认：
- **Auth**: Cookie-based JWT session（替代 Bearer Token）
- **游戏新闻**: 数据库驱动（新建 `game_news` 表 + 管理 CRUD）
- **视觉**: 1:1 复刻现有设计（Tailwind @theme 映射现有设计 tokens）
- **结构**: 标准 Astro 单包结构（非 monorepo）

## 核心策略：双轨运行，渐进迁移

**最重要的设计决策**：Phase 1-4 期间 Express 和 Astro 并行运行。每一步都产出可运行、可交付的应用，旧栈作为安全网保留到 Phase 5。

---

## Phase 1: 项目骨架 + Drizzle Schema + Tailwind 基础

### 目标
在同目录下初始化 Astro 项目，Drizzle ORM 能读写现有 `data.db`，Tailwind 配置好设计 tokens。**Express 保持不变。**

### 任务清单

1. **初始化 Astro 项目**
   - 安装依赖：`drizzle-orm`, `better-sqlite3`, `@astrojs/node`, `@astrojs/react`, `react`, `react-dom`, `jose`, `@tailwindcss/vite`, `tailwindcss`, `drizzle-kit`
   - 配置 `astro.config.ts`：`output: "server"`, adapter: `node({ mode: "standalone" })`, react integration, tailwindcss vite plugin

2. **创建 Drizzle Schema** (`src/db/schema.ts`)
   - 5 张现有表：`profile`, `articles`, `comments`, `likes`, `category_tree`
   - Drizzle camelCase 列名 → snake_case 数据库列（自动映射）
   - 新增第 6 张表 `game_news`（game, tag, title, sort_order, created_at, updated_at）

3. **数据库连接** (`src/lib/db.ts`)
   - 复用 WAL + foreign_keys + busy_timeout pragmas
   - `export const db = drizzle(sqlite, { schema })`

4. **Tailwind 全局样式** (`src/styles/global.css`)
   - `@import "tailwindcss"` + `@theme` 块映射现有 CSS 变量
   - 颜色、字体、间距、阴影等设计 tokens

5. **验证页面** (`src/pages/index.astro`)
   - 查询 profile + articles，确认 Drizzle 能正确读取现有 `data.db`

### 验收标准
- [x] `astro dev` 在 :4321 启动，能读取现有 data.db
- [x] `drizzle-kit check` 验证 schema 通过
- [x] `docker compose up` 仍然正常工作（Express 不受影响）
- [x] Tailwind 编译无错误

### 核心风险：低
- Drizzle schema 列名映射准确，`drizzle-kit introspect` 可验证
- 新旧依赖共存，Express（CJS）和 Astro（ESM）各自独立

### 实际产出文件（已完成）

```
astro.config.ts              # Astro SSR + Node standalone + React + Tailwind
tsconfig.json                # TypeScript strict + baseUrl + path aliases
drizzle.config.ts            # Drizzle Kit → src/db/schema.ts + data.db
src/
  db/schema.ts               # 6 张表 Drizzle schema (5 现有 + game_news 新表)
  lib/db.ts                  # better-sqlite3 连接 (WAL + foreign_keys + busy_timeout)
  lib/utils.ts               # generateId, parseTags, articleToJSON, profileToJSON
  styles/global.css          # Tailwind v4 @theme (16 色 + 4 阴影 + 4 圆角 + 字体 + 布局)
  pages/index.astro          # SSR 验证页面 (验证 Drizzle + Tailwind 全链路)
```

**验证通过**（2026-07-10）：
- Drizzle 查询 profile (梁祖豪) / articles (9 篇) / comments (22 条) / likes (61 条) / category_tree (3 条) 全部正确
- `astro dev` SSR 页面渲染正常，Tailwind 工具类全部生效
- Express `/api/health`、`/api/profile`、`/api/articles` 仍正常响应
- 双轨运行无冲突

---

---

## Phase 2: API Routes 迁移

### 目标
18 个 REST API 端点全部重写为 Astro API Routes（`src/pages/api/*.ts`）。Auth 迁移到 JWT httpOnly cookie。**保持与旧前端 API 兼容（JSON shape 完全一致）。**

### 核心架构决策

**双认证策略**：`requireAuth()` 同时检查新 cookie（`blog_session` JWT）和旧 `Authorization: Bearer` header。旧前端无需改动即可工作。

**Auth 实现** (`src/lib/auth.ts`)：
- 密码哈希：保持 scrypt（与现有 server.js 相同算法）
- JWT：`jose` 库 SignJWT/JWTVerify，HS256，24h 过期
- Cookie：`httpOnly`, `secure`(production), `sameSite: "strict"`, `path: "/"`

### API 文件映射

| Express Route | Astro File |
|---|---|
| `POST /api/auth/login` | `src/pages/api/auth/login.ts` |
| (new) `POST /api/auth/logout` | `src/pages/api/auth/logout.ts` |
| `GET/PUT /api/profile` | `src/pages/api/profile.ts` |
| `GET/POST /api/articles` | `src/pages/api/articles/index.ts` |
| `GET/PUT/DELETE /api/articles/:id` | `src/pages/api/articles/[id].ts` |
| `POST /api/articles/:id/toggle-pin` | `src/pages/api/articles/[id]/toggle-pin.ts` |
| `GET/POST /api/articles/:id/comments` | `src/pages/api/articles/[id]/comments.ts` |
| `DELETE /api/comments/:id` | `src/pages/api/comments/[id].ts` |
| `GET/POST/DELETE /api/articles/:id/likes` | `src/pages/api/articles/[id]/likes.ts` |
| `GET /api/categories` | `src/pages/api/categories.ts` |
| `POST /api/upload` | `src/pages/api/upload.ts` |
| `POST /api/demo/init` | `src/pages/api/demo/init.ts` |
| `GET /api/health` | `src/pages/api/health.ts` |

### 关键模式

**Astro API Route 模式**（以 articles/[id].ts 为例）：
```typescript
import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { articles, comments, likes } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../../lib/auth";
import { generateId, articleToJSON } from "../../../lib/utils";

export const GET: APIRoute = async ({ params }) => {
  const article = db.select().from(articles).where(eq(articles.id, params.id!)).get();
  if (!article) return new Response(JSON.stringify({ error: "文章不存在" }), { status: 404 });
  return new Response(JSON.stringify(articleToJSON(article)), {
    headers: { "Content-Type": "application/json" },
  });
};
```

**文件上传**：用 `request.formData()` 替代 multer，保持相同的文件名校验、类型限制、大小限制。

**工具函数** (`src/lib/utils.ts`)：迁移 `generateId()`, `articleToJSON()`, `profileToJSON()`, `parseTags()` 从 server.js。

### 验收标准
- [ ] 每个 API 端点返回与 Express 完全相同的 JSON shape
- [ ] Auth 同时接受 cookie 和 Bearer token
- [ ] 文件上传功能等价（10MB 限制、图片类型校验）
- [ ] Demo init 种子数据与原来一致（5 篇文章 + 评论 + 点赞）
- [ ] 旧前端（js/app.js）指向 Astro API 端口能正常工作
- [ ] `docker compose up` 仍然正常工作

### 核心风险：中
- **Drizzle vs 裸 SQL 差异**：WHERE 条件、排序逻辑可能有细微不同。缓解：写对比测试，调同一个 DB 对比两端输出
- **文件上传处理**：`formData()` 与 multer 行为差异。缓解：测试大文件、非 Latin 文件名、边缘 MIME 类型

---

## Phase 3: SSR 页面 — 首页、文章详情、数据驱动游戏新闻

### 目标
博客可通过 Astro SSR 页面完整阅读（无需 JavaScript）。游戏新闻从硬编码 HTML 变为数据库驱动。**旧 `index.html` SPA 仍作为 fallback 可用。**

### 新建文件

```
src/pages/index.astro                    # 首页 — SSR 渲染文章列表
src/pages/article/[id].astro             # 文章详情页 — SSR 渲染
src/components/layout/BaseLayout.astro   # HTML shell（header + sidebar + slot）
src/components/layout/Header.astro       # 顶栏：logo、日期、天气、导航
src/components/layout/Sidebar.astro      # 侧边栏：个人卡片、分类、游戏新闻
src/components/article/ArticleCard.astro # 文章卡片
src/components/article/ArticleGrid.astro # 文章网格
src/components/profile/ProfileCard.astro # 个人信息卡片
src/components/game-news/GameNews.astro  # 数据驱动的游戏新闻面板
```

### 页面逻辑

**首页** (`index.astro`)：
- 读取 URL query params（`?category=&subcategory=&search=&sort=`）→ 与 Express 完全相同
- Drizzle 动态构建 WHERE + ORDER BY
- 服务端渲染文章网格，无需客户端 JS

**文章详情** (`article/[id].astro`)：
- `Astro.params.id` 获取文章 ID
- 查询文章 + 评论列表
- 内容用 `set:html` 渲染（admin 编写的 HTML，与现有行为一致）
- 404 处理

**游戏新闻** (`GameNews.astro`)：
- 从 `game_news` 表查询，按 game 分组 + sort_order 排序
- 4 个 tab（genshin, starrail, endfield, nte）动态渲染
- 种子脚本 `src/db/game-news-seed.ts` 迁移现有硬编码内容

### CSS 共存策略

1. **Tailwind 负责**：布局（flex/grid/spacing）、颜色、排版
2. **旧 `css/style.css`（通过 link 加载）**：尚未迁移的组件样式（模态框动画等）
3. 旧 CSS 后加载，优先级高于 Tailwind 冲突选择器
4. 每个后续 Phase 逐步删减 style.css 中的已替代段落

### 验收标准
- [ ] 首页 SSR 渲染文章网格，分类/搜索/排序过滤正确
- [ ] 文章详情页渲染内容，URL 可分享（`/article/art_xxx`）
- [ ] 游戏新闻从数据库读取（非硬编码 HTML）
- [ ] 页面在禁用 JS 时完全可读（纯 SSR）
- [ ] 个人信息、分类统计正确显示
- [ ] 旧 SPA（/index.html）仍完全可用

### 核心风险：中
- **Drizzle 查询翻译**：filter/search/sort 逻辑需与 Express 端一致。缓解：对比测试
- **CSS 冲突**：Tailwind utility 与旧 style.css 可能冲突。缓解：旧 CSS 后加载，逐步替换

---

## Phase 4: React Islands — 交互功能

### 目标
所有交互功能变为 React Island 组件，hydration 到客户端。Astro 页面成为主入口，React 处理用户交互。

### React 组件清单

| 组件 | Astro directive | 功能 |
|---|---|---|
| `AuthProvider.tsx` | `client:load` | 全局认证状态（React Context） |
| `LikeButton.tsx` | `client:load` | 点赞/取消，乐观更新 + 心形动画 |
| `CommentSection.tsx` | `client:visible` | 查看/添加/删除评论 |
| `ArticleEditor.tsx` | `client:only="react"` | 文章创建/编辑模态框 |
| `ProfileEditor.tsx` | `client:only="react"` | 个人信息编辑模态框 |
| `LoginModal.tsx` | `client:only="react"` | 登录模态框 |
| `ImageUpload.tsx` | `client:load` | 拖拽/粘贴上传、进度条 |
| `SearchSort.tsx` | `client:load` | 搜索框 + 排序下拉，防抖搜索 |
| `CategoryFilter.tsx` | `client:load` | 分类/子分类筛选 |
| `GameNewsEditor.tsx` | `client:only="react"` | 管理员编辑游戏新闻 |
| `Toast.tsx` | `client:load` | Toast 通知系统 |
| `LogoutButton.tsx` | `client:load` | 退出登录 |
| `SidebarToggle.tsx` | `client:idle` | 移动端侧边栏开关 |

### 关键模式

**乐观更新**（LikeButton）：先更新 UI → 发 API → 失败则回滚
**SSR fallback**：服务端渲染初始数据作为 props 传入 React，避免 hydration 不匹配
**client 指令策略**：
- `client:load` — 首屏必需（AuthProvider, LikeButton, Toast, SearchSort）
- `client:visible` — 首屏以下（CommentSection）
- `client:idle` — 非关键（SidebarToggle）
- `client:only="react"` — 模态框，无 SSR 意义（ArticleEditor, LoginModal）

### 验收标准
- [ ] 文章 CRUD 通过 React 编辑器模态框工作
- [ ] 个人信息编辑通过 React 表单工作
- [ ] 登录设置 cookie，登出清除 cookie，UI 反映认证状态
- [ ] 点赞按钮乐观更新 + 心形动画
- [ ] 评论可添加和删除
- [ ] 图片上传支持拖拽、粘贴、进度条
- [ ] 搜索/排序/分类筛选无页面刷新
- [ ] 所有模态框支持 Escape 关闭 + 点击遮罩关闭
- [ ] 移动端侧边栏开关工作
- [ ] Toast 通知覆盖所有操作
- [ ] 旧 SPA（index.html）仍作为 fallback

### 核心风险：中
- **Hydration 不匹配**：SSR 和客户端状态不一致。缓解：所有初始状态通过 props 传递，`useEffect` 处理纯客户端逻辑
- **Cookie vs sessionStorage**：认证状态管理方式变更。缓解：AuthProvider 同时检查 cookie + 调用 `/api/auth/me` 验证

---

## Phase 5: 清理、测试、生产加固

### 目标
移除旧代码，添加全面测试，最终化 Docker 构建，产出生产就绪制品。

### 5.1 清理旧代码
- 删除 `server.js`、`index.html`、`js/app.js`、`css/style.css`
- 从 `package.json` 移除 `express`、`multer`、`dotenv`
- 删除 `scripts/` 目录
- 从 `requireAuth` 移除旧 Bearer token 支持

### 5.2 更新 Docker 部署

**Dockerfile**（多阶段构建）：
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
```

**nginx.conf**：更新 upstream 端口 3000→4321，所有非静态请求 proxy 到 Astro SSR

**docker-compose.yml**：更新端口、命令、挂载路径

### 5.3 测试策略

| 层级 | 工具 | 覆盖范围 |
|---|---|---|
| 单元测试 | Vitest | `utils.ts`, `auth.ts`, API handlers（mock） |
| 集成测试 | Vitest | API routes + 真实 SQLite（内存/temp file） |
| E2E | Playwright | 关键用户流程（读取文章、点赞、评论、登录、CRUD） |
| 组件测试 | @testing-library/react | LikeButton, CommentSection, LoginModal, ImageUpload |

### 验收标准
- [ ] 所有测试通过
- [ ] `docker compose up --build` 产出可运行应用
- [ ] Health check 返回 200
- [ ] 数据库在容器重启后持久化
- [ ] Backup sidecar 继续工作
- [ ] `deploy.sh` 脚本正常运行
- [ ] Caddy HTTPS 配置可用（如适用）

### 核心风险：中
- **Standalone 构建行为**：`@astrojs/node` standalone 模式与 Express 不同。缓解：本地 `astro build && node dist/server/entry.mjs` 测试后再容器化
- **生产构建 vs 开发模式差异**：缓解：本地模拟生产环境测试

---

## 最终文件结构

```
blog2/
├── astro.config.ts
├── tsconfig.json
├── vitest.config.ts
├── drizzle.config.ts
├── package.json
├── Dockerfile
├── nginx.conf
├── Caddyfile
├── docker-compose.yml
├── docker-compose.caddy.yml
├── deploy.sh
├── .env.example
├── data.db                           # 不提交
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── article/[id].astro
│   │   └── api/
│   │       ├── auth/login.ts
│   │       ├── auth/logout.ts
│   │       ├── profile.ts
│   │       ├── articles/index.ts
│   │       ├── articles/[id].ts
│   │       ├── articles/[id]/toggle-pin.ts
│   │       ├── articles/[id]/comments.ts
│   │       ├── articles/[id]/likes.ts
│   │       ├── categories.ts
│   │       ├── comments/[id].ts
│   │       ├── upload.ts
│   │       ├── demo/init.ts
│   │       └── health.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BaseLayout.astro
│   │   │   ├── Header.astro
│   │   │   └── Sidebar.astro
│   │   ├── article/
│   │   │   ├── ArticleCard.astro
│   │   │   └── ArticleGrid.astro
│   │   ├── profile/ProfileCard.astro
│   │   ├── game-news/GameNewsPanel.astro
│   │   └── react/
│   │       ├── AuthProvider.tsx
│   │       ├── ArticleEditor.tsx
│   │       ├── ProfileEditor.tsx
│   │       ├── LoginModal.tsx
│   │       ├── LikeButton.tsx
│   │       ├── CommentSection.tsx
│   │       ├── ImageUpload.tsx
│   │       ├── SearchSort.tsx
│   │       ├── CategoryFilter.tsx
│   │       ├── GameNewsEditor.tsx
│   │       ├── Toast.tsx
│   │       ├── LogoutButton.tsx
│   │       └── SidebarToggle.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── seed.ts
│   │   └── game-news-seed.ts
│   └── styles/
│       └── global.css
├── tests/
│   ├── api/
│   └── e2e/
├── public/image/pen.png
├── uploads/
└── backups/
```

## 关键架构决策汇总

1. **双轨运行到 Phase 4**：Express + Astro 并行，Nginx 路由到两者，风险最小
2. **Cookie + JWT 认证**：无状态、适合 SSR、`jose` 库轻量
3. **Drizzle 直接读写现有 DB**：零迁移、零停机
4. **CSS 共存**：Tailwind @theme 映射现有设计 token，旧 CSS 逐步删减
5. **React 仅用于 Islands**：页面全 SSR，React 只水合交互元素
6. **Astro standalone 模式**：`@astrojs/node` standalone 自带 HTTP server，无需 Express

## 验证方式

- 每个 Phase 结束后：`docker compose up` 确认应用可运行
- Phase 2：对比新旧 API 响应 JSON
- Phase 3：禁用 JS 浏览页面（纯 SSR 验证）
- Phase 4：手动测试所有交互流程
- Phase 5：Vitest + Playwright 自动化测试套件
