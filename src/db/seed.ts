import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { posts, comments, likes, profile } from "./schema";
import { endfieldPosts } from "./endfield-posts";
import { readingPosts } from "./reading-posts";

const sqlite = new Database("./data/blog.db");
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    cover_image TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT '匿名',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 0
  );

  DROP TABLE IF EXISTS profile;
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'kaven',
    bio TEXT NOT NULL DEFAULT '',
    city TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    github TEXT DEFAULT '',
    website TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Clear existing data
db.delete(posts).run();
db.delete(comments).run();
db.delete(likes).run();

// Seed posts
const seedPosts = [
  {
    title: "2026 年前端开发技术趋势：从 Server-First 到 AI 原生",
    slug: "frontend-trends-2026",
    excerpt: "TypeScript 已成标配，React 19 带来编译器革命，AI 代码占比突破 42%——一文看懂 2026 前端技术全景。",
    content: `
## Server-First：2026 前端的关键词

2026 年前端开发的核心转变可以概括为一个词：**Server-First**。更多的计算在服务端完成，更少的 JavaScript 被发送到浏览器。React Server Components (RSC) 已成为默认方案，团队报告客户端 JavaScript 体积减少了 30-70%。

## TypeScript：不再可选

TypeScript 已经完成了从"推荐"到"必需"的转变：

- **38%** 的专业开发者将 TypeScript 作为主语言
- **72%** 的前端职位要求 TypeScript 技能
- 所有主流框架和工具都优先提供 TypeScript 支持
- AI 编码工具在类型化代码库中生成更准确的建议

## React 19 的重大升级

### React Compiler（原 React Forget）
2025 年 10 月达到 1.0，提供**自动记忆化**。开发者不再需要手动编写 useMemo 和 useCallback。

### use() Hook
全新的 use() hook 支持在 render 中直接挂起 Promise，替代了传统的 useEffect + state 数据加载模式。

### Actions API
稳定的 Actions API 为表单提交和数据变更提供了内置模式。

## 2026 推荐技术栈

| 领域 | 推荐工具 |
|------|----------|
| 框架 | Next.js / TanStack Start |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4（Oxide 引擎，Rust 驱动） |
| 组件库 | shadcn/ui（187 万周下载量） |
| 服务端状态 | TanStack Query v5 |
| 客户端状态 | Zustand v5（35% 采用率） |
| 表单 | React Hook Form + Zod v4 |
| API 层 | tRPC |
| ORM | Prisma / Drizzle ORM |
| 测试 | Vitest + Playwright |
| 移动端 | React Native + Expo（新架构默认） |

## Rust 驱动的工具链

Vite 8（基于 Rolldown）、Next.js（基于 Turbopack）、Biome（替代 ESLint + Prettier）——这些 Rust 驱动的工具带来了 **10-30 倍**的构建速度提升。

## AI 原生开发

2026 年，**42% 的已提交代码**是 AI 生成的，预计到 2027 年将达到 65%。84-91% 的开发者在某种形式上使用 AI 工具。AI 不再仅仅是"快捷方式"，而是一种帮助开发者更快探索架构选项的**决策支持工具**。

## 在衰退的技术

- **Create React App**：已停止维护
- **Webpack（独立使用）**：让位于 Vite 和 Rust bundler
- **Redux（经典版）**：Zustand 成为新项目首选
- **CSS-in-JS**：与 Server Components 不兼容
    `.trim(),
    coverImage: null,
    tags: JSON.stringify(["技术", "前端", "React"]),
    published: true,
  },
  {
    title: "Tailwind CSS v4 与 shadcn/ui：现代前端样式方案",
    slug: "tailwind-v4-shadcn-ui",
    excerpt: "Tailwind CSS v4 用 Oxide 引擎重写，速度提升 5 倍；shadcn/ui 成为最受欢迎的组件库，周下载 187 万次。",
    content: `
## Tailwind CSS v4：不仅仅是版本号升级

Tailwind CSS v4 是一次**彻底的架构重写**：

### CSS 优先配置
告别 tailwind.config.js，现在你直接在 CSS 中定义主题：

\`\`\`css
@import "tailwindcss";

@theme {
  --color-primary: oklch(55% 0.19 25);
  --font-family-sans: "DM Sans", sans-serif;
  --spacing-container: 72rem;
}
\`\`\`

### Oxide 引擎
新的 Rust 驱动引擎在大型项目中比 v3 **快 5 倍以上**，在增量构建中甚至快 100 倍。

### oklch 色彩空间
全面支持 oklch 色彩空间，色域更广、更均匀，特别适合深色模式设计。

### 容器查询
内置 CSS 容器查询支持，使用 @md、@lg 等前缀即可根据容器宽度而非视口宽度调整样式：

\`\`\`html
<div class="@container">
  <div class="@lg:grid-cols-3 grid-cols-1 grid gap-4">
    <!-- 根据父容器宽度响应 -->
  </div>
</div>
\`\`\`

## shadcn/ui：不是组件库的组件库

shadcn/ui 的核心理念是**直接拥有源码**。它不是通过 npm 安装的依赖包，而是将组件源码直接复制到你的项目中。

### 为什么 shadcn/ui 如此流行？

1. **完全可定制**：源码就在你的项目中，修改不受限制
2. **TypeScript 原生支持**：所有组件都有完整类型
3. **Radix UI 驱动**：底层基于无障碍原语
4. **Tailwind 完美集成**：使用 Tailwind 类名进行样式定制
5. **AI 友好**：确定性结构，LLM 容易生成正确的 shadcn/ui 代码

### 被淘汰的方案

- **styled-components / Emotion**：因与 React Server Components 不兼容而衰退
- **Material UI**：太重，定制困难
- **Chakra UI**：发展停滞

## 实际项目中的最佳实践

一个典型的 2026 年项目样式方案：

- 使用 **Tailwind CSS v4** 处理全局样式和工具类
- 使用 **shadcn/ui** 的 Copy-Paste 模式构建基础组件
- 基于 **Radix UI** 的无障碍原语扩展自定义组件
- 使用 **CSS 变量**实现亮/暗模式切换
- 避免任何 **运行时 CSS-in-JS**
    `.trim(),
    coverImage: null,
    tags: JSON.stringify(["技术", "前端", "CSS"]),
    published: true,
  },
  {
    title: "《崩坏星穹铁道》4.4版本 Fate 联动全面解析",
    slug: "honkai-star-rail-4-4-fate-collab",
    excerpt: "姬子SP机甲形态登场，Fate/stay night [UBW] 联动开启，远坂凛与吉尔伽美什强势参战！",
    content: `
## 4.4 版本「鸣笛于归寂之时」

2026 年 7 月 15 日，星穹铁道 4.4 版本正式上线，这也是**翁法罗斯主线终章**，迎战绝灭大君「归寂」。但更让玩家沸腾的，是与 **Fate/stay night [Unlimited Blade Works]** 的深度联动。

## 姬子 SP 机甲形态「姬子·启行」

全新五星限定角色，命途 **智识·火**：

- 可召唤机甲「**星焰者**」发动支援攻击与协同追击
- **全体队友**均可指挥机甲，人人都是驾驶员
- 终结技对敌方全体发动多重强力攻击
- 探索中可操控机甲**直接消灭敌人**（无需进入战斗）

## Fate 联动限定五星角色

### 远坂凛（智识·量子）
7 月 24 日上线 | CV：植田佳奈（日）/ 朔小兔（中）

利用【宝石能量】强化战技爆发。队友消耗/恢复战技点均可为其积攒能量并提升暴击伤害。与 Archer 同队时触发**连携追加攻击**。

### 吉尔伽美什（毁灭·雷）
7 月 24 日上线 | CV：关智一（日）/ 藤新（中）

由【兴致】驱动的终结技爆发型角色。队友行动可积攒兴致、提供能量。与 Saber 同队时触发**连携追加攻击**。

## 重磅福利一览

| 福利 | 说明 |
|------|------|
| 命运契约·再启 | 登录免费领取**吉尔伽美什**或**Archer**二选一，附赠直升 60 级材料 |
| 命运赠礼 | 累计消耗 200 张星轨专票，两把联动五星光锥任选其一 |
| 巡星之礼 | 7 日签到累计领取星轨专票 ×10 |

## 联动活动

- **开拓续闻**「幻造：圣杯战争」：Fate 联动独立剧情，7 月 24 日开启
- **联动玩法**「命运/银河铁道之夜」：大回合制卡牌战斗
- **反贪「砖」家**：砂金委托的反贪调查小游戏

## 货币战争更新

千冶·刃、姬子·启行、远坂凛、吉尔伽美什同步加入货币战争模式。新增「命运圣杯」羁绊系统，晋升等级上限扩充至 **170 级**。

## 复刻角色

| 卡池 | 时间 | 角色 |
|------|------|------|
| 上半 | 7/15 - 8/5 | 火花、丹恒·腾荒、长夜月 |
| 下半 | 8/5 起 | 刻律德菈、那刻夏、砂金 |

> 联动福利力度空前，无论新老玩家都是入坑/回坑的最佳时机。
    `.trim(),
    coverImage: null,
    tags: JSON.stringify(["游戏", "崩坏星穹铁道", "Fate"]),
    published: true,
  },
  {
    title: "翁法罗斯篇回顾：从黄金裔到绝灭大君的史诗之旅",
    slug: "honkai-star-rail-amphoreus-review",
    excerpt: "回顾 3.0-4.4 翁法罗斯篇章：十二泰坦、黄金裔英雄、丹恒觉醒与 Fate 联动的故事全貌。",
    content: `
## 翁法罗斯：不断轮回的希腊史诗

翁法罗斯是星穹铁道 3.0 版本开启的全新主线篇章，世界观灵感来源于**希腊神话**。这是一个不断轮回的模拟世界，核心剧情围绕英雄团体「**黄金裔**」夺取十二泰坦权柄、拯救世界完成「再创世」展开。

## 黄金裔核心成员

### 遐蝶（记忆·量子）—— 3.2 版本
翁法罗斯的"死亡"半神，出身哀地里亚，身负「死亡之触」诅咒。量子属性记忆命途角色，以独特的死亡机制成为版本热门。

### 白厄（毁灭·物理）—— 3.4 版本
被视为"救世主"的悲剧英雄。在数千万次轮回中独自承受一切，最终成为毁灭命途的承载者。物理系的强力输出定位。

### 丹恒·腾荒（存护）—— 3.6 版本起免费送
三月七陷入沉睡后，丹恒觉醒存护命途获得新形态。作为五星存护角色，能为队友提供护盾、召唤龙灵协助作战。

## 版本时间线

| 版本 | 时间 | 关键内容 |
|------|------|----------|
| 3.0 | 2025.01 | 翁法罗斯篇开启，黄金裔首次登场 |
| 3.2 | 2025.04 | 遐蝶实装 |
| 3.4 | 2025.07 | 白厄实装，轮回真相揭晓 |
| 3.6 | 2025.10 | 丹恒·腾荒公布，长夜月剧情 |
| 4.0 | 2025 年末 | 仙舟国风角色爻光登场 |
| 4.3 | 2026.06 | 千冶·刃实装，星启模式上线 |
| 4.4 | 2026.07 | 主线终章 + Fate 联动 |

## 重要剧情节点

### 阿格莱雅与黄金裔
黄金裔领袖阿格莱雅承担着指挥与决策的重任，她的每一次选择都影响着翁法罗斯的命运走向。

### 三月七的沉睡与丹恒的觉醒
3.0 版本中三月七陷入沉睡，丹恒为守护她重返翁法罗斯，最终觉醒存护命途。这是整个 3.x 版本最动人的剧情线之一。

### 绝灭大君「归寂」
4.4 版本的最终 Boss，三阶段首领战。这位绝灭大君的登场标志着翁法罗斯篇的终结，也为后续篇章埋下伏笔。

## Fate 联动的剧情衔接

4.4 版本的 Fate 联动并非生硬穿越——「幻造：圣杯战争」作为开拓续闻，将英灵召唤体系与星穹铁道的世界观巧妙融合。远坂凛和吉尔伽美什的出现，为翁法罗斯的终章增添了史诗感。

## 展望

随着 4.4 版本主线完结，翁法罗斯篇正式落幕。4.5 及后续版本将开启**全新星球的探索旅程**，江户星、机械帝国等新地图已在预告中出现。
    `.trim(),
    coverImage: null,
    tags: JSON.stringify(["游戏", "崩坏星穹铁道", "翁法罗斯"]),
    published: true,
  },
  ...endfieldPosts,
  ...readingPosts,
];

const inserted = db.insert(posts).values(seedPosts).returning().all();

// Seed comments
db.insert(comments)
  .values([
    {
      postId: inserted[0].id,
      author: "前端开发者",
      content: "Server-First 确实是今年最大的趋势，我们的项目迁移到 RSC 后性能提升很明显。",
    },
    {
      postId: inserted[0].id,
      author: "TypeScript 爱好者",
      content: "终于有人把 2026 技术栈整理清楚了，Zustand + TanStack Query 的组合真的很好用。",
    },
    {
      postId: inserted[1].id,
      author: "CSS 玩家",
      content: "Tailwind v4 的 oklch 色彩空间太棒了，做暗色模式简单了很多。shadcn/ui 的 copy-paste 模式也非常灵活。",
    },
    {
      postId: inserted[2].id,
      author: "星铁玩家",
      content: "吉尔伽美什直接免费送！金皮卡配 Saber 的连携攻击也太帅了，米哈游这次真的大方。",
    },
    {
      postId: inserted[2].id,
      author: "Fate厨",
      content: "远坂凛的建模真的美哭了，植田佳奈的配音也太有感觉了。200 抽换光锥也很良心。",
    },
    {
      postId: inserted[3].id,
      author: "剧情党",
      content: "白厄在数千万次轮回中独自承受的那段剧情真的看哭了，翁法罗斯篇的叙事水平是米哈游的巅峰。",
    },
    {
      postId: inserted[3].id,
      author: "回合制爱好者",
      content: "绝灭大君三阶段战的设计很用心，需要合理配队才能过。4.4 的星启模式也很有挑战性。",
    },
    {
      postId: inserted[4].id,
      author: "管理员本人",
      content: "李织烟在 1.4 的弧光真的顶，跟陈千语那段对手戏看得起鸡皮疙瘩。",
    },
    {
      postId: inserted[5].id,
      author: "开荒人",
      content: "从零号委托一路玩到向渊行，每个版本都能看到明显的进步，1.4 电荷机制让输出舒服太多了。",
    },
    {
      postId: inserted[6].id,
      author: "物理队玩家",
      content: "弥弗的清波三艺拉扯聚怪是真的丝滑，配合破防辅助一套连招伤害拉满。",
    },
    {
      postId: inserted[6].id,
      author: "火队厨",
      content: "卡缪 1.3 补强后吸火效率起飞，莱万汀+卡缪的双火轴打起来很解压。",
    },
    {
      postId: inserted[7].id,
      author: "书友",
      content: "活着这本书读完心情沉重了很久，但福贵的那份平静又让人莫名获得了力量。",
    },
    {
      postId: inserted[8].id,
      author: "文学爱好者",
      content: "范晔译本真的很流畅，开篇那句「多年以后」直接把人拉进马孔多的雨里。",
    },
    {
      postId: inserted[9].id,
      author: "老读者",
      content: "小王子是每年都会重读一遍的书，「驯养」那章每次读都有新的感触。",
    },
  ])
  .run();

// Seed likes
inserted.forEach((post) => {
  db.insert(likes).values({ postId: post.id, count: Math.floor(Math.random() * 50) }).run();
});

// Seed default profile (upsert)
const existingProfile = db.select().from(profile).where(eq(profile.id, 1)).get();
if (existingProfile) {
  db.update(profile)
    .set({ name: "kaven", bio: "用代码构建更好的互联网", city: "上海", gender: "male" })
    .where(eq(profile.id, 1))
    .run();
} else {
  db.insert(profile)
    .values({ id: 1, name: "kaven", bio: "用代码构建更好的互联网", city: "上海", gender: "male" })
    .run();
}

console.log(`✅ 已插入 ${inserted.length} 篇文章`);
console.log("✅ 已插入示例评论和点赞数据");
console.log("✅ 已初始化个人信息");
console.log("🚀 运行 `npm run dev` 启动博客");
