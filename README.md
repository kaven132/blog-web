# Kaven 的个人博客

基于 **Astro SSR + React Islands + TypeScript + Tailwind CSS v4 + Drizzle ORM + SQLite** 的个人博客系统，Docker 容器化部署。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 7.x SSR (standalone mode) |
| UI | React 19 Islands + Tailwind CSS v4 |
| 语言 | TypeScript 5.x (strict) |
| 数据库 | better-sqlite3 (WAL 模式) |
| ORM | Drizzle ORM (类型安全) |
| 认证 | JWT httpOnly Cookie (jose) |
| 部署 | Docker Compose + Nginx |
| 测试 | Vitest |
| HTTPS | 可选 Caddy (自动 Let's Encrypt) |

## 快速开始

```bash
# 开发模式
npm install
npm run dev          # http://localhost:4321

# 运行测试
npm test

# 生产构建
npm run build
npm start            # node dist/server/entry.mjs

# Docker 部署
docker compose up -d --build
```

## 项目结构

```
├── src/
│   ├── pages/
│   │   ├── index.astro                  # 首页 (SSR)
│   │   ├── article/[id].astro           # 文章详情 (SSR)
│   │   └── api/                         # 14 个 API 路由文件
│   │       ├── auth/login.ts            #   登录 (JWT cookie)
│   │       ├── auth/logout.ts           #   登出
│   │       ├── profile.ts               #   个人信息
│   │       ├── articles/index.ts        #   文章列表 + 创建
│   │       ├── articles/[id].ts         #   文章详情 + 编辑 + 删除
│   │       ├── articles/[id]/toggle-pin.ts
│   │       ├── articles/[id]/comments.ts
│   │       ├── articles/[id]/likes.ts
│   │       ├── categories.ts
│   │       ├── comments/[id].ts
│   │       ├── upload.ts
│   │       ├── demo/init.ts
│   │       └── health.ts
│   ├── components/
│   │   ├── layout/                      # Astro 布局
│   │   │   ├── BaseLayout.astro         #   HTML 外壳
│   │   │   ├── Header.astro             #   顶栏
│   │   │   └── Sidebar.astro            #   侧边栏
│   │   ├── article/                     # Astro 文章组件
│   │   │   ├── ArticleCard.astro
│   │   │   └── ArticleGrid.astro
│   │   ├── profile/ProfileCard.astro    # Astro 个人信息卡片
│   │   ├── game-news/GameNews.astro     # Astro 游戏新闻面板
│   │   └── react/                       # React Islands (13 个)
│   │       ├── Toast.tsx                #   client:load
│   │       ├── AuthProvider.tsx          #   client:load
│   │       ├── LikeButton.tsx           #   client:load
│   │       ├── CommentSection.tsx       #   client:visible
│   │       ├── LogoutButton.tsx          #   client:load
│   │       ├── SearchSort.tsx           #   client:load
│   │       ├── CategoryFilter.tsx       #   client:load
│   │       ├── ImageUpload.tsx          #   client:load
│   │       ├── SidebarToggle.tsx        #   client:idle
│   │       ├── LoginModal.tsx           #   client:only
│   │       ├── ArticleEditor.tsx        #   client:only
│   │       ├── ProfileEditor.tsx        #   client:only
│   │       └── GameNewsEditor.tsx       #   client:only
│   ├── db/schema.ts                     # Drizzle schema (6 张表)
│   ├── lib/
│   │   ├── db.ts                        # 数据库连接
│   │   ├── auth.ts                      # JWT 认证
│   │   └── utils.ts                     # 工具函数
│   └── styles/global.css                # Tailwind v4 @theme
├── public/image/pen.png                 # 静态资源 (favicon)
├── tests/                               # Vitest 测试
├── Dockerfile                           # 多阶段构建
├── nginx.conf                           # Nginx 反向代理配置
├── Caddyfile                            # Caddy HTTPS 配置 (可选)
├── docker-compose.yml                   # Docker Compose 编排
├── docker-compose.caddy.yml             # Caddy HTTPS 附加配置
├── deploy.sh                            # 一键部署脚本
├── astro.config.ts                      # Astro 配置
├── drizzle.config.ts                    # Drizzle Kit 配置
├── tsconfig.json                        # TypeScript 配置
└── vitest.config.ts                     # Vitest 配置
```

## API 端点 (18 个)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/health` | - | 健康检查 |
| POST | `/api/auth/login` | - | 登录 |
| POST | `/api/auth/logout` | - | 登出 |
| GET | `/api/profile` | - | 获取个人信息 |
| PUT | `/api/profile` | ✅ | 更新个人信息 |
| GET | `/api/articles` | - | 文章列表 (支持 ?category/subcategory/search/sort) |
| POST | `/api/articles` | ✅ | 创建文章 |
| GET | `/api/articles/:id` | - | 文章详情 |
| PUT | `/api/articles/:id` | ✅ | 更新文章 |
| DELETE | `/api/articles/:id` | ✅ | 删除文章 |
| POST | `/api/articles/:id/toggle-pin` | ✅ | 切换置顶 |
| GET | `/api/articles/:id/comments` | - | 评论列表 |
| POST | `/api/articles/:id/comments` | - | 添加评论 |
| DELETE | `/api/comments/:id` | - | 删除评论 |
| GET | `/api/articles/:id/likes` | - | 点赞状态 |
| POST | `/api/articles/:id/likes` | - | 点赞 |
| DELETE | `/api/articles/:id/likes` | - | 取消点赞 |
| GET | `/api/categories` | - | 分类 + 分类树 |
| POST | `/api/upload` | ✅ | 图片上传 (10MB) |
| POST | `/api/demo/init` | - | 初始化演示数据 |

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。

```bash
# 一键部署
chmod +x deploy.sh && ./deploy.sh

# 或手动
cp .env.example .env   # 编辑管理员密码
docker compose up -d --build
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_USERNAME` | 管理员账号 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | - (必填) |
| `AUTH_SECRET` | JWT 签名密钥 | 自动生成 |
| `PORT_EXPOSE` | 对外端口 | `80` |
| `TZ` | 时区 | `Asia/Shanghai` |
