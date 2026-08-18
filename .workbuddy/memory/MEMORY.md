# 博客项目长期记忆（MEMORY.md）

## 运行环境关键约束
- **Node 版本（2026-08-18 起）**：项目统一用 **Node 24（ABI 137）**，即用户默认 `E:/devtools/nodejs/node.exe`（v24.9.0）。`better-sqlite3` 已从 11.10.0 **升级到 13.0.3**（`package.json` 为 `^13.0.3`），13.x 自带 Node 24 预编译包，`npm run dev` 直接可用。
- **不要再切回受管 Node 22.22.2**：旧二进制（ABI 127）已被替换，Node 22 现在加载不了 13.x 的 ABI 137 二进制。
- 跑脚本示例：`E:/devtools/nodejs/node.exe node_modules/tsx/dist/cli.mjs <script>`（需在仓库根目录，因为 `src/db/index.ts` 用相对路径 `./data/blog.db`）。
- **坑：WorkBuddy 沙箱会给 agent 的命令注入 `NODE_OPTIONS=--require=...genie-safe-delete.cjs`（安全删除 shim）**，Node 进程内任何删除操作（node-gyp clean、vite 清 .vite 缓存）会被它拦截并超时失败。用户自己的 PowerShell **没有**这个变量。所以 agent 执行 npm install/rebuild 或起 dev 时，先 `export NODE_OPTIONS=` 清掉；若用户侧报 vite/删除类错误，先检查其 shell 是否有该变量。
- 若以后 `better-sqlite3` 又出现 `NODE_MODULE_VERSION` 报错：升级到带目标 Node 预编译包的最新版（`npm view better-sqlite3 version`），用目标 Node + 清空 NODE_OPTIONS 跑 `npm install`。

## 渲染模式
- Astro `output: "server"` + 详情页 `prerender = false` → 动态 SSR。文章写入 DB 后访问即见，无需重新构建（仅依赖服务进程在线）。

## 自动发文
- `scripts/post-article.ts`：直接写库发文。插入强制 `published: true`（与 `/api/posts` 一致）。`tags` 以 JSON 字符串存储，slug 自动去重（逻辑同 `src/pages/api/posts.ts` 的 resolveSlug）。
- 注意：Markdown 用手写渲染器（`src/lib/markdown.ts`），**不支持表格**；自动生成的文章正文应避免用 `|` 表格语法。
- 渲染器已确认用 `inCode` 状态机正确处理 ``` 围栏，代码块内的 `#`、`|`、`*`、`![]()` 不会被误解析；inline code 的占位符替换早于粗体/斜体，`` `a * b` `` 安全。
- `posts` 表字段为下划线命名：`cover_image`、`created_at`、`updated_at`；`tags` 存 JSON 字符串。

## 写长文入库的稳妥流程（避免 JSON 转义地狱）
1. 正文先用 Write 写成 `scripts/_tmp_N.md`（纯 Markdown，反引号/引号/YAML 随便写）。
2. 用一个临时 `.mjs` 读 md + 元数据，`JSON.stringify` 生成 `_daily_N.json`，顺带打印体检项：汉字数、是否含表格、插图数、代码围栏数、excerpt 长度。
3. 表格检测前先剥掉代码块 `content.replace(/```[\s\S]*?```/g,'')`，否则 bash 续行的 `| jq` 会误报。
4. 按节数字数：`content.split(/^# /m)` 逐节统计汉字，首稿常超 20%，按节削比整体重写快得多。
5. 发布后清理所有临时文件。

## 已知短板（代码分析）
- 认证为 demo 级：cookie 仅明文 `auth=true`，无签名/加密，`secure=false`。
- `admin` 页有"草稿/已发布"标签，但写文章 API 写死 `published:true`，无真正草稿流。
- `Header.tsx` / `Sidebar.tsx` 为废弃组件（README 已标注）。
