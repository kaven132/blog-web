# 博客项目长期记忆（MEMORY.md）

## 运行环境关键约束
- **Node 版本**：项目 `better-sqlite3` 原生二进制按 **Node 23（ABI 131）** 编译。运行 dev / build / 任何涉及 DB 的脚本时，必须使用 **Node 23**（`E:/devtools/nodejs/node.exe`），受管 Node 22（ABI 127）会因 `NODE_MODULE_VERSION` 不匹配而加载失败。
- 跑脚本示例：`E:/devtools/nodejs/node.exe node_modules/tsx/dist/cli.mjs <script>`（需在仓库根目录，因为 `src/db/index.ts` 用相对路径 `./data/blog.db`）。

## 渲染模式
- Astro `output: "server"` + 详情页 `prerender = false` → 动态 SSR。文章写入 DB 后访问即见，无需重新构建（仅依赖服务进程在线）。

## 自动发文
- `scripts/post-article.ts`：直接写库发文。插入强制 `published: true`（与 `/api/posts` 一致）。`tags` 以 JSON 字符串存储，slug 自动去重（逻辑同 `src/pages/api/posts.ts` 的 resolveSlug）。
- 注意：Markdown 用手写渲染器（`src/lib/markdown.ts`），**不支持表格**；自动生成的文章正文应避免用 `|` 表格语法。

## 已知短板（代码分析）
- 认证为 demo 级：cookie 仅明文 `auth=true`，无签名/加密，`secure=false`。
- `admin` 页有"草稿/已发布"标签，但写文章 API 写死 `published:true`，无真正草稿流。
- `Header.tsx` / `Sidebar.tsx` 为废弃组件（README 已标注）。
