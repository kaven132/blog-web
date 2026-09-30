# 博客项目长期记忆

> 只留「跨会话仍有效」的规则。逐日流水账进 `.workbuddy/memory/YYYY-MM-DD.md`；各自动化线的执行明细、配图指纹表、可用/失败关键词台账进 `.workbuddy/memory/automations/<id>/memory.md`。

## 数据安全
- `data/blog.db` 是全站唯一数据源（`data/` 已 gitignore，备份只在本机）。写 `./data/` 前先备份。
- 破坏性入口只有 `npm run db:reset`（清空重建 10 篇种子）；`npm run db:seed` 安全。遗留备份 `data/backups/blog-2026-09-10T08-04-45-722Z.db` 勿删。
- 拷库副本别只 `cp blog.db`：数据可能在 `-wal` 里，先 `PRAGMA wal_checkpoint(TRUNCATE)`。库内有 37 条演示评论（id 8–44，挂 12 篇旅游文），回滚 `python scripts/_seed-comments.py --clear`。

## 运行环境
- Node 用 `E:/devtools/nodejs/node.exe`（v24），**别用 Node 22**（better-sqlite3 ABI 不兼容）。跑 tsx：`node node_modules/tsx/dist/cli.mjs <script>`，cwd 必须是仓库根。
- **每条 Bash 调用都要重做两件事**：`export NODE_OPTIONS=`（沙箱注入的 safe-delete shim）、`export PATH="…/PortableGit/versions/1.2.0/mingw64/bin:…/usr/bin:$PATH"`（漏写则 `ls/sed/grep` command not found）。
- 删改文件用 Node `fs.rmSync` 或 Edit/Write，别用 `rm -rf` / `sed -i`。`node -e "…"` 里的反引号会被 bash 当命令替换 → 含反引号的文本先 Write 落文件。
- 探本机端口必须 `curl --noproxy '*'`（本机 proxy `127.0.0.1:11755` 会劫持 localhost，不加会拿 502 误判服务没起）。git 推送无 TTY 必失败，用 `GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0` 加空 credential.helper；`.astro/`、`.workbuddy/` 已跟踪但在 .gitignore 里 → 用 `git add -u`。

## 渲染与库结构
- Astro `output:"server"` + 详情页 `prerender=false` → 写库即见，无需 rebuild。详情页路由 `/posts/<slug>`。
- `src/lib/markdown.ts` 手写渲染器：**不支持表格（正文禁 `|`）**、不支持嵌套列表；`>` 引用块按行切分；4 个半角空格变代码块。
- `posts` 列名带下划线（`cover_image`/`created_at`），`tags` 存 JSON 字符串，`created_at` 存 UTC（筛今天用 `datetime(created_at,'+8 hours')`）。
- 正文插图高度由 CSS 统一负责（`.prose img` `height:25rem`），出图不必按固定比例。

## 配图
- 🚨 **loremflickr 自 2026-09-24 起全站 401 硬封锁**（站点级反爬，任意 URL/UA/lock 都无效）→ `scripts/fetch-images.mjs` 已作废，改走替代路径。
- 现行路径：`scripts/pick-image.mjs`（Bing 图搜取候选：`--q= --name= --n= --out=<目录>`；落盘 `--pick=N --from=<目录> --dest=<文件>`）→ `scripts/montage-images.mjs`（`--dir= --out= --cols=` 拼带编号预览网格，**一次 Read 看完全部候选**）→ 目标文件必须 Read 原图肉眼确认切题、无水印、非 AI 生图。
- 各家图库搜索页/API 全被 bot 门控（pexels/unsplash/pixabay 403/401），检索只能借道 `bing.com/images`（`murl` 是 HTML 实体编码，先解 `&quot;`）。
- 选词：**「地名 + 地区名」英文查询命中率最高**；地方政府官网是好图源。带角标/水印的域名直接跳过：`english.news.cn`/`xinhuanet`/`chinadaily`/`jstv`（官媒）、`lovepik`/`58pic`/`tukuppt`/`zhituwang`/`ooopic`/`pngtree`（付费图库）、`i-blog.csdnimg.cn` 等 csdn 图常带账号角标。`stockcake` 是 **AI 生图库**（连同 openart/lexica/midjourney/nightcafe 已在 `STOCK_BLOCK`）。**严禁 AI 生图。**
- 两个高频坑：① **博客/个人站的自拍图普遍压着可见版权水印**（`© xxx.com` 在左下或右下角），切题度再好也要弃用，选图必须放大看四角；② `pick-image.mjs` 的 `--name` 前缀**在同一目录重复使用会互相覆盖**，同批次补搜要换前缀（`--name=tc` / `tc2` / `tc3`）。
- 国内题材选词（2026-09-29 景德镇线实测）：中文「**地名 + 建筑构件/食物名词**」（如 `景德镇 御窑厂遗址 窑砖 拱券`）一轮就能出 6 张干净图；泛泛的「古窑 烧窑 匠人」整批落**微信公众号名片水印**（图源 chinaguyao.com 这类景区自有站）。图源质量：`youimg1.c-ctrip.com`、`n.sinaimg.cn`（大图）干净可用；`x0.ifengimg.com`、`qnam.smzdm.com`、`pic.nximg.cn`、`img1.bala.cc` 带水印/画质差。另注意 `.prose img` 是**定高 25rem**，竖构图（如 1024x1643）会渲染成窄条，配图优先选横幅。
- 封面落 `data/uploads/_cover-tmp-<slug>.jpg`，**别下到 `scripts/`**（丢过文件 → cover_image=null）。
- 若日后 loremflickr 复活，注意历史故障形态：兜底图 / 占位帧（纯红底 + 嵌小照片）/ 截断图（下半灰块）/ 跨日复用真图 / 题材完全不搭的真图，`judge()` 全判 ✅，拦截只能靠肉眼 + `--reject-md5`。指纹明细见各线 automation memory。

## 自动发文（3 条线）
- `5cff0944` 每日 10:00 书籍 + 让 AI 编程助手更能干的工具（各 4800–5200 汉字）；`3b3c6b54` 每日 10:30 城市旅游；`a49509f8` 每月 2 日 11:00 游戏。
- **第二篇选题边界**：主题是「让 AI 编程助手（尤其 dsh）跑得更好的东西」。**五类**：①agent 技能包 ②agent 插件与扩展 ③MCP server 与工具接入 ④记忆/检索/上下文工程 ⑤执行与操作环境（沙箱/容器/远程/终端/浏览器/OCR）。**排除五类**：LLM 应用开发框架与低代码编排平台、面向终端用户的聊天客户端、模型网关/代理聚合层、纯 API 封装 SDK、与 agent 工作流无关的娱乐消费件。
- 候选池 `scripts/_dsh_candidates.mjs`（读 `C:/Users/kaven/.dsh/plugins/dsh-market/plugins-cache.json`，按五类分组并自动剔除已写过项目与娱乐件；**勿删**）。写第二篇先跑它，别凭记忆编项目名；标 `⚠️star 数存疑` 的别选。
- **dsh 扩展机制**：插件 = Cordis bundle，`dsh plugin --profile <web|desktop|headless> add <包名|github:owner/repo>`，注册在 `~/.dsh/profiles/<name>/package.json` 的 `dsh.profile.bundles`；**skill 是另一套**，放 `~/.dsh/skills/<name>/SKILL.md`；跨平台技能另有 `npx skills add owner/repo`。dsh 工作区 `E:\work\ai project\dsh`，权威定制清单 `CUSTOMIZATIONS.md`。
- **临时文件按线分目录**：`scripts/_travel/`、`scripts/_books/book|tech/`、`scripts/_game/<key>/`；**禁用通用名** `_tmp.md`/`_gen.mjs`/`_article.json`/`_cover.jpg`（多条线时间窗真实重叠，曾互删工作文件）。
- 状态文件：旅游 `scripts/_travel-state.json`；书籍 `scripts/_posted.json` 的 `books`/`plugins`；游戏 `scripts/_game-state.json`。**三线各写各的**（`skills` 是废弃键）。
- 游戏线：`_game-state.json` 按游戏记**版本号**（不是 slug），双信号判定（A 类已上线 / B 类前瞻官宣），**只有「最新版本号 ≠ 台账版本号」才写文**，每次运行都要回写台账；自检 `scripts/_game-selfcheck.mjs`。
- slug：`book-rec-YYYYMMDD` / `deepseek-YYYYMMDD` / `travel-<城市>-YYYYMMDD` / `game-<key>-YYYYMMDD`。`deepseek-*` 前缀**不要改**（去重逻辑依赖）。书籍标题与正文**禁「重读/再读/重温」**；正文插图 书籍 1 / 技术 1 / 旅游 2 / 游戏 0。

## 写长文入库流程
1. **分片写正文**（单次 Write 长中文会截断，每片 ≤900 汉字）。插图位置**必须写完整 markdown** `![图注]({{FIG1}})`；只写裸 `{{FIG1}}` 会报「正文插图 0/N」FAIL。
2. `node scripts/build-article.mjs --dir=… --slug=… --title=… --tags=… --excerpt=… --cover=… --min-han/--max-han --figs=N [--banned=…]`；**退出码 1 = 有 FAIL，先修再发**。
3. 发布：`node node_modules/tsx/dist/cli.mjs scripts/post-article.ts --file=<线目录>/article.json`。**`post-article.ts` 只本地化封面，正文插图要自己拷到 `data/uploads/<slug>-fig1.jpg`。**
4. 验收：封面在 `cover_image` 字段、**不在 `content` 里**；`renderMarkdown` 的 `<img>` 数 = 正文插图数。excerpt 80–120 字（口径 = 去空白后全部字符，ASCII 模型名/参数名都算数）；发布后才发现越界只能 `update posts set excerpt=?` 原地改库，别重发（会变 `-2`）。
5. 同文件多条 Edit 并行会**静默丢失** → 逐条顺序发，改完 Read 复核。

## 资讯面板（`src/lib/news.ts` + `NewsPanel.tsx`）
- `SOURCES` 每条带 `group`，同 `group` 自动成组随分类下发 `siblings`，组内第一条 = 该 tab 默认来源。默认只抓每组默认来源（`GET /api/news`），切其他来源才走 `?sources=<id>` 懒加载（`getNews()` 用 `Promise.allSettled`，耗时 = 最慢源）。未知 id 返回 400。
- `parseRss` **只认 RSS 2.0 的 `<item>`**，Atom 源解析出 0 条。加源前必须实测，「HTTP 200」不等于可用。
- 已接入：国内 = 中国新闻网；科技 = 极客公园；游戏 = 游戏茶馆 / 游研社 / 机核（靠 `exclude:"/radios/"` 滤播客）。
- sessionStorage 结构 `NewsStore{categories,defaults,picked}`，key = `news-panel-cache-v2-<日期>`，**改结构要同步升 key 前缀**。

## 代码缺陷（设计层，未修）
- 认证 demo 级（明文 cookie、硬编码账号）；avatar base64 入库；`published` 写死 true、`/api/comment` 无鉴权；`data/` 全相对路径（须从仓库根启动）；三处标签筛选重复；`Header/Sidebar` 死代码；搜索区分大小写。
- **上线前先跑** `tsx scripts/migrate-likes-unique.ts`。

## DeepSeek API
- **`deepseek-chat` / `deepseek-reasoner` alias 已于 2026-07-24 停用**。现行：`deepseek-flash` / `deepseek-v4-flash` / `deepseek-v4-pro` / `deepseek-v4-flash-vision-exp`（部分旧名仍接受但对应模型已退役）。思考档位 low/high/max；**思考开启时 temperature/topP 静默失效**。2026-08-16 起改峰谷定价，谷时为峰时半价，历史文里写死的单价都要重算。
- 动笔前先翻官方 Change Log（`api-docs.deepseek.com/updates`）；两处官方口径冲突时，正文并列分歧而不是硬挑一个。
