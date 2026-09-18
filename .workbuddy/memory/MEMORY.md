# 博客项目长期记忆

> 只留「跨会话仍有效」的规则。按日期堆叠的流水账一律进 `.workbuddy/memory/YYYY-MM-DD.md`，各自动化线的执行明细进 `.workbuddy/memory/automations/<id>/memory.md`。

## 数据安全
- `data/blog.db` = 全站唯一数据源（`data/` 已 gitignore，备份只在本机）。写 `./data/` 前先备份。
- 破坏性入口只有 `npm run db:reset`（清空重建 10 篇种子）。`npm run db:seed` 安全（posts 非空即 `exit(0)`）。遗留备份 `data/backups/blog-2026-09-10T08-04-45-722Z.db` 勿删。
- **复制库副本时主库文件不够**：数据可能还在 `-wal` 里，只 `cp blog.db` 会拿到旧快照（2026-09-18 实测踩过，误判评论数为 3）。先 `PRAGMA wal_checkpoint(TRUNCATE)` 再拷，或把 `-wal`/`-shm` 一并拷。
- **库里已有一批演示评论**（2026-09-18 插入，37 条、12 篇旅游文、id 8–44），不是真实读者留言。回滚：`python scripts/_seed-comments.py --clear`（按 `scripts/_demo-comments.json` 清单精确删除）。

## 运行环境
- Node 24 = `E:/devtools/nodejs/node.exe`，**别用 Node 22**（better-sqlite3 ABI 不兼容）。跑脚本：`E:/devtools/nodejs/node.exe node_modules/tsx/dist/cli.mjs <script>`，cwd 必须是仓库根。
- 跑 npm/dev 前先 `export NODE_OPTIONS=`（沙箱注入了 safe-delete shim）。
- **Bash PATH 偶发失效**（`ls/sed/grep` command not found、命令静默不执行）：开头显式 export PortableGit 的 `mingw64/bin` 与 `usr/bin`。删改文件用 Node `fs.rmSync` 或 Edit/Write，别用 `rm -rf`/`sed -i`。
- **`node -e "…"` 里的反引号会被 bash 当命令替换**（行内代码被整段吃掉）。含反引号的文本一律用 Write 落文件再拼接。
- git 推送无 TTY 必失败，用 `GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c credential.helper=manager push origin main`。
- `.astro/`、`.workbuddy/` 已被跟踪但在 .gitignore 里 → 用 `git add -u`。
- **PATH 修复必须每次 Bash 调用都重做**：shell 状态不跨调用保留，所以 `export PATH=…PortableGit/…/mingw64/bin:…/usr/bin:$PATH` 要写在每条命令开头（漏写就 `tail/grep/ls` command not found，带管道的命令会直接 exit 127）。
- **本机有 `http_proxy/https_proxy=http://127.0.0.1:11755`，会劫持 localhost**：用 curl/urllib 探本机 dev server 会拿到 `502 Bad Gateway`（不是服务没起）。校验本机端口要么 `curl --noproxy '*'`，要么 Python 里 `urllib.request.build_opener(urllib.request.ProxyHandler({}))`。
- dev server 用 `--host 127.0.0.1` 启动；默认只监听 `[::1]:4399`，`127.0.0.1` 连不上。

## 渲染与库结构
- Astro `output:"server"` + 详情页 `prerender=false` → 写库即见，无需 rebuild。
- `src/lib/markdown.ts` 手写：**不支持表格（正文禁 `|`）**、不支持嵌套列表；`>` 引用块按行切分；4 个半角空格变代码块。
- `posts` 列名下划线（`cover_image`/`created_at`/`updated_at`），`tags` 存 JSON 字符串，`created_at` 存 UTC（筛今天用 `datetime(created_at,'+8 hours')`）。
- **正文插图统一高度（2026-09-18 定稿）**：`.prose img` = `height:25rem; width:auto; max-width:100%; object-fit:contain`（≤640px 断点降到 `14rem`）。原来的 `height:auto` 会让 4:3 竖图撑到 800+px 高、3:2 横图只有 480px，页面高矮乱跳。选 25rem 的依据：正文容器 `max-w-3xl`=768px，实测 19 张 CDN 插图宽高比 0.92–2.02（中位 1.51），25rem 下典型图宽 600px、仅 2/19 触发 contain 内缩。**插图不必再按固定比例出图**，等高由 CSS 负责。

## 配图（`scripts/fetch-images.mjs`，三条线共用）
**机制**：并发 × 多 lock → `judge()` 否决（<20KB、已知兜底指纹、`--reject-md5`、跨关键词撞图、本次运行撞图）→ 预算用尽落 `picsum.photos/seed/...`。
**铁律**：
1. 一律走脚本，别手工 curl 试探。封面落 `data/uploads/_cover-tmp-<slug>.jpg` 且 >20KB；**别下到 `scripts/`**（丢过文件 → cover_image=null）。
2. **脚本 ✅ 不等于图能用**：`judge()` 判不出是否切题，也拦不住占位帧的新尺寸变体；兜底图排在候选第一条还会被直接接受。**每轮配图后必须 Read 图片肉眼确认封面+全部插图**；跑题或发现是纯红底占位帧，就把它的 md5 塞进 `--reject-md5` 换词重抓。**2026-09-18 是最惨一轮：首批 4 张图全部报废（3 张占位帧 + 1 张跑题），重抓 4 轮才配齐。**同日还会撞到「脚本判为真图、其实是前几日刚用过的那张」（本次 `coding,monitor` 返回 09-15 的图、`book,library` 返回 09-17 的图），所以把最近一两篇已发布图的 md5 一并传进 `--reject-md5` 应当作为常规动作。
3. `--reject-md5=<前缀,…>` 当次有效，用于排「上一轮用过的真图」和「脚本 ✅ 但跑题」的图（把最近一两篇已发布图的 md5 前缀一并传进去）。**别往脚本内 `KNOWN_FALLBACK_MD5` 里塞**，那是三线共用表会误伤。
4. 重抓单张时先确认目标文件名（只传 `--fig1` 会覆盖 fig1 位）。
5. **「关键词写法」本身是独立变量，别只换词**：逗号双标签与单 token 结果可以完全不同（2026-09-18 实测 `hot,spring` 返回一杯贴金箔的冰淇淋甜品，`hotspring` 返回真温泉蒸汽图）。同理「热词」也会整批失效：`volcano`/`volcanic`/`crater`/`onsen` 同一轮全落 `248472B` 兜底图。所以一个语义要准备好几种写法（单 token / 逗号双标签 / 近义名词）再配上不同 lock。
6. 旅游线详情页路由是 `/posts/<slug>`（`/post/<slug>` 返回 404）；dev server 常在 127.0.0.1:4321，在线校验就是 curl 这一条。

**兜底图指纹表（脚本内）**：`248658B/2be570b7`（覆盖最广，城市名与单一名词基本必中）、`248685B/2cdbe2d7`、`248734B/3fa2bac5`、`248472B`（2026-09-18 最活跃的一个尺寸，`russia,winter`/`candle,dark`/`old,letter`/`winter,bridge`/`typewriter,keyboard` 全中）、故障占位帧（纯红底+中间嵌小照片+角落印字）**截至 2026-09-18 已发现 6 个尺寸变体**：`79863B/f987912f`、`45092B/88b3637c`、`48635B/099cb6b1`、`50499B/f321533b`、`43945B`、`38059B/ee95f869` —— 能正常解码且过 20KB 门槛，**只能靠 md5 拦，且每次字节数/md5 都可能不同，只能见一只补一只**。
**故障模式**：整站退化（任何词同一张、单次 ~19s）；一批词 HTTP 500（`market,food`/`rice,field`/`chinese,village`/`nuts,heap`/`broth,bowl`）；返回前几轮用过的真图造成跨篇重复。**打通不了就立刻换语义完全不同的词，同时换 lock；同词同 lock 也不保证复现。** 关键词台账见各线 automation memory。

## 自动发文（3 条线）
- `5cff0944` 每日 10:00 书籍 + DeepSeek 项目（各 4800–5200 汉字）；`3b3c6b54` 每日 10:30 城市旅游（3600–4000 汉字，四类轮转）；`a49509f8` 每月 2 日 11:00 游戏（2800–3200 字）。每日线 `validUntil=2026-09-29T16:00Z`。
- **临时文件按线分目录**：`scripts/_travel/`、`scripts/_books/book|tech/`、`scripts/_game/<key>/`；**禁用通用名** `_tmp.md`/`_gen.mjs`/`_article.json`/`_cover.jpg`（两线真实重叠，曾互删）。
- 状态文件：旅游 `scripts/_travel-state.json`；书籍 `scripts/_posted.json` 的 `books`/`plugins`。**两线各写各的，别交叉。**
- slug：`book-rec-YYYYMMDD`/`deepseek-YYYYMMDD`/`travel-<城市>-YYYYMMDD`/`game-<endfield|hsr|genshin>-YYYYMMDD`。书籍标题正文**禁「重读/再读/重温」**；正文插图 书籍1/技术1/旅游2/游戏0。

## 写长文入库流程
1. **分片写正文**（单次 Write 长中文必截断）。旅游线 7 片各 ≤560 汉字。插图位置**必须写完整 markdown** `![图注]({{FIG1}})`，只写 `{{FIG1}}` 会报「正文插图 0/N」FAIL。
2. `node scripts/build-article.mjs --dir=… --slug=… --title=… --tags=… --excerpt=… --cover=… --min-han/--max-han --figs=N`；**退出码 1 = 有 FAIL，先修再发**。`--title` 与分片首行 `# 标题` 二者必居其一，都没有 exit 2。
3. 发布：`export NODE_OPTIONS= && E:/devtools/nodejs/node.exe node_modules/tsx/dist/cli.mjs scripts/post-article.ts --file=<线目录>/article.json`。
4. 验收：封面在 `cover_image` 字段、**不在 `content` 里**，`renderMarkdown` 的 `<img>` 数 = 正文插图数（不是 1 封面 + N）。
5. 技术线（代码密集）首稿中文常差 1000 字以上（代码是 ASCII 不计入），补字数往代码节里加解释；书籍线首稿接近满额。

## 代码缺陷
- **已修**：`--font-*` 变量；`ProfileCard.cropToAvatar` 映射与拖拽缩放；`ProfileCard` 展示模式；`write.astro` `wrapSelection` 插链接；`PostCard` transition；`/api/news?fresh=1`；`likes` 唯一索引（`scripts/migrate-likes-unique.ts`）+ onConflictDoUpdate；`tsc --noEmit` 0 错。
- **未修**（设计层）：认证 demo 级（明文 cookie、硬编码账号）；avatar base64 入库；`published` 写死 true、`/api/comment` 无鉴权；`data/` 全相对路径（须仓库根启动）；三处标签筛选重复；`Header/Sidebar` 死代码；搜索区分大小写。
- **上线前**：先跑 `tsx scripts/migrate-likes-unique.ts`，否则 `/api/like` 的 `ON CONFLICT` 报错。
- 2026-09-17 观察：09-11~09-16 六篇旅游文的 `cover_image` 已被改成哈希名（如 `/uploads/1789528298554-833f7479.jpg`），原因未查，未触碰。

## 资讯面板（`src/lib/news.ts` + `NewsPanel.tsx`）
- `SOURCES` 每条带 `group`：**一个 tab（group）可以挂多个来源**，`group` 相同的来源自动互为一组，随分类一起下发 `siblings`，前端据此渲染「来源：xxx」右侧的切换按钮。`group` 内第一条 = 该 tab 的默认来源。
- **默认请求只抓每组的默认来源**（`GET /api/news`），切到其他来源才走 `GET /api/news?sources=<id>` 懒加载。原因：`getNews()` 用 `Promise.allSettled`，**接口耗时 = 最慢源**，把 5 个源全塞进首屏会让每次开首页都等最慢的那个。未知 id 返回 400。
- 加新来源 = 在 `SOURCES` 里加一条同 `group` 的记录，其余全自动（含切换按钮）；可选 `exclude` 字段按 link 子串丢弃条目。
- 已接入：国内=中国新闻网；**科技=极客公园**；**游戏=游戏茶馆 / 游研社(`yystv.cn/rss/feed`) / 机核(`gcores.com/rss`，靠 `exclude:"/radios/"` 滤掉播客)**。
- `parseRss` **只认 RSS 2.0 的 `<item>`**，Atom 源（V8/Deno/Chrome Releases/阮一峰）会解析出 0 条 → 界面显示「暂无资讯」。**加源前必须用 Node fetch + 复制出的 `parseRss` 实测**（方法见 `blog2-audit` 技能），「HTTP 200」不等于可用。
- 前端 sessionStorage 结构是 `NewsStore{categories,defaults,picked}`，key = `news-panel-cache-v2-<日期>`。**改这个结构要同步升 key 前缀**，否则旧缓存会让 `store.categories` 变 undefined。

## 已知陷阱
- 同文件多条 Edit 并行会互相覆盖 → 逐条顺序发，或整文件单 Write。

## DeepSeek API（写「DeepSeek 生态」篇前必查）
- **`deepseek-chat` / `deepseek-reasoner` alias 已于 2026-07-24 停用**。现行：`deepseek-flash` / `deepseek-v4-flash` / `deepseek-v4-pro` / `deepseek-v4-flash-vision-exp`。历史文章里的旧 alias 是「当时正确、现已过期」，新文别照抄；沿用旧 alias 的第三方工具教程要提醒读者改。
- 思考档位 low/high/max；**2026-08-16 16:00 UTC 起改峰谷定价，谷时单价为峰时一半**，历史文里写死的单价都要重算。V4-Flash 2026-04-24 口径：缓存命中输入 0.2 元/百万 token、未命中 1 元、输出 2 元（英文来源给 $0.14/$0.28，币种口径不一致，引用标清来源）。
- **动笔前先翻官方 Change Log**（api-docs.deepseek.com/updates）；官方 provider 文档示例常落后于 changelog。
