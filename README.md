# kaven 的个人网页

基于 **Astro SSR + React Islands + TypeScript + Tailwind CSS v4 + Drizzle ORM + SQLite** 构建的个人博客。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 5.x SSR（Node adapter standalone） |
| UI | React 19 Islands + Tailwind CSS v4（Oxide 引擎） |
| 语言 | TypeScript 5.x（strict） |
| 数据库 | better-sqlite3（WAL 模式） |
| ORM | Drizzle ORM（类型安全） |
| 认证 | Cookie Session |
| 样式 | 暖白单色 + 珊瑚红点缀，DM Sans / Noto Serif SC 字体 |

## 快速开始

```bash
npm install
npm run db:seed    # 初始化数据库和示例数据
npm run dev        # http://localhost:4321
```

## 项目结构

```
src/
├── components/          # React Islands 组件
│   ├── AppShell.tsx     #   页面外壳（布局容器）
│   ├── TopNav.tsx       #   顶部导航栏 + 登录/写文章按钮
│   ├── ProfileCard.tsx  #   左侧个人信息卡片（头像裁切、可编辑字段）
│   ├── PostCard.tsx     #   文章卡片（序列入场动画）
│   ├── SearchBar.tsx    #   搜索框
│   ├── LikeButton.tsx   #   点赞按钮
│   ├── ReadingProgress.tsx  # 阅读进度条
│   ├── Header.tsx       #   移动端顶栏（已不再使用）
│   └── Sidebar.tsx      #   旧侧边栏组件（已不再使用）
├── pages/
│   ├── index.astro          # 首页（搜索 + 最新文章列表）
│   ├── about.astro          # 关于页（技术栈卡片）
│   ├── 404.astro            # 404 友好提示
│   ├── login.astro          # 登录页（密码可见性切换）
│   ├── write.astro          # 写文章页（需登录，自动生成 slug）
│   ├── posts/
│   │   ├── index.astro      #   文章列表（搜索过滤）
│   │   └── [slug].astro     #   文章详情（Markdown + 评论 + 点赞）
│   └── api/
│       ├── profile.ts       #   个人信息 CRUD
│       ├── posts.ts         #   创建文章（需登录）
│       ├── like.ts          #   点赞 API
│       ├── comment.ts       #   评论 API
│       └── auth/
│           ├── login.ts     #   登录（验证账号密码）
│           ├── logout.ts    #   退出
│           └── me.ts        #   检查登录状态
├── db/
│   ├── schema.ts            #   Drizzle 表定义（posts / comments / likes / profile）
│   ├── index.ts             #   数据库连接
│   └── seed.ts              #   种子数据（4 篇文章 + 评论 + 个人信息）
├── layouts/
│   └── Layout.astro         #   HTML 外壳 + Google Fonts
└── styles/
    └── global.css           #   Tailwind v4 @theme + 全局样式 + 动画
```

## 页面与功能

| 页面 | 功能 |
|------|------|
| 首页 | 搜索框 + 最新文章卡片（序列入场动画） |
| 文章列表 | 搜索过滤，卡片网格展示 |
| 文章详情 | Markdown 渲染、阅读进度条、点赞、评论区 |
| 关于 | 技术栈卡片 + 功能列表 |
| 写文章 | 标题自动生成 slug、Markdown 编辑器（需登录） |

## 个人信息卡片

- 头像上传：拖拽或点击上传，弹窗裁切支持拖拽平移 + 滚轮缩放 + 滑块精确控制
- 可编辑字段：名字、城市、性别（SVG 图标，♂蓝色 / ♀粉色）、个性签名
- 链接：GitHub + 个人网站
- 编辑按钮仅登录后可见

## 登录

| 项目 | 值 |
|------|-----|
| 账号 | `kavenyyds` |
| 密码 | `4399123456` |
| 有效期 | 7 天（Cookie Session） |

登录后顶部导航显示「写文章」和「退出」按钮，个人信息卡片显示编辑图标。

## 数据库

```bash
npm run db:seed       # 重建数据库并填充种子数据
npm run db:generate   # 生成 Drizzle 迁移
npm run db:push       # 推送 schema 到数据库
```

## 构建部署

```bash
npm run build         # 构建生产版本
npm start             # 启动生产服务器（node dist/server/entry.mjs）
npm run preview       # 预览构建结果
```
