import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { profile, articles, comments, likes } from "../../../db/schema";
import { count, eq } from "drizzle-orm";
import { generateId } from "../../../lib/utils";

/**
 * POST /api/demo/init — Seed demo data (public, idempotent)
 *
 * Populates the database with 5 demo articles + comments + likes.
 * Skips if articles already exist.
 * Matches Express seed data exactly.
 */
export const POST: APIRoute = () => {
  // Check if articles already exist
  const [{ cnt }] = db
    .select({ cnt: count() })
    .from(articles)
    .all();

  if (cnt > 0) {
    return new Response(
      JSON.stringify({ seeded: false, reason: "已有文章数据" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Seed demo profile
  db.update(profile)
    .set({
      name: "张三",
      bio: "热爱技术与生活，喜欢分享自己的学习心得。",
      email: "zhangsan@example.com",
      location: "北京",
      avatar: "",
      socialGithub: "https://github.com",
      socialTwitter: "",
      socialWebsite: "",
    })
    .where(eq(profile.id, 1))
    .run();

  // Demo articles data (matching Express exactly)
  const demos = [
    {
      title: "欢迎来到我的博客",
      content: `<p>你好！欢迎来到我的个人博客。</p>
<p>这里是我记录学习心得、生活感悟和技术分享的地方。</p>
<h3>关于我</h3>
<p>我是一名热爱编程的开发者，喜欢探索新技术，也喜欢分享自己的学习过程。</p>
<blockquote>学习的最大价值在于分享 —— 当你教会别人的时候，你自己也在成长。</blockquote>
<h3>这个博客有什么？</h3>
<ul>
    <li>技术文章和教程</li>
    <li>项目经验和心得</li>
    <li>生活中的思考和记录</li>
</ul>
<p>希望你能在这里找到有用的内容！</p>`,
      category: "随笔",
      subcategory: "",
      tags: ["博客", "介绍"],
      summary: "欢迎来到我的个人博客，这里记录了技术分享和生活感悟。",
      likes: 12,
      liked: true,
    },
    {
      title: "JavaScript 异步编程入门",
      content: `<p>异步编程是 JavaScript 中非常重要的一部分。理解它对于写出高效的前端代码至关重要。</p>
<h3>什么是异步？</h3>
<p>JavaScript 是单线程语言，但通过事件循环机制，可以处理异步操作而不阻塞主线程。</p>
<h3>Promise 基础</h3>
<p><code>Promise</code> 是异步编程的基石。它有三种状态：pending、fulfilled 和 rejected。</p>
<pre><code>const promise = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve('数据加载完成');
    }, 2000);
});

promise.then(data => {
    console.log(data);
}).catch(err => {
    console.error(err);
});</code></pre>
<h3>Async/Await</h3>
<p><code>async/await</code> 让异步代码看起来像是同步的，提高了可读性。</p>
<pre><code>async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('请求失败:', error);
    }
}</code></pre>
<p>掌握异步编程，你就能更好地处理网络请求、文件操作和定时任务。</p>`,
      category: "技术",
      subcategory: "",
      tags: ["JavaScript", "异步", "Promise", "Async/Await"],
      summary:
        "深入理解 JavaScript 异步编程，掌握 Promise 和 Async/Await 的使用方法。",
      likes: 8,
      liked: false,
    },
    {
      title: "CSS Grid 布局完全指南",
      content: `<p>CSS Grid 是强大的二维布局系统，它让复杂的网页布局变得简单。</p>
<h3>基础概念</h3>
<p>Grid 由容器和项目组成。设置 <code>display: grid</code> 即可启用网格布局。</p>
<pre><code>.container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}</code></pre>
<h3>网格线定位</h3>
<p>可以通过网格线编号精确控制项目位置：</p>
<pre><code>.item {
    grid-column: 1 / 3;
    grid-row: 2 / 4;
}</code></pre>
<h3>响应式布局</h3>
<p>结合 <code>auto-fit</code> 和 <code>minmax</code>，无需媒体查询就能实现响应式：</p>
<pre><code>.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}</code></pre>
<p>Grid 让布局变得直观而强大，是现代前端开发的必备技能。</p>`,
      category: "技术",
      subcategory: "",
      tags: ["CSS", "布局", "Grid"],
      summary:
        "全面介绍 CSS Grid 布局的核心概念、常用技巧和响应式实践。",
      likes: 15,
      liked: true,
    },
    {
      title: "我的 2024 年读书清单",
      content: `<p>今年读了不少好书，在这里做一个总结和推荐。</p>
<h3>技术类</h3>
<ul>
    <li><strong>《代码整洁之道》</strong> - 经典之作，每次重读都有新收获</li>
    <li><strong>《重构》</strong> - 改善既有代码的必读指南</li>
</ul>
<h3>非技术类</h3>
<ul>
    <li><strong>《人类简史》</strong> - 宏大叙事，引人深思</li>
    <li><strong>《原子习惯》</strong> - 小习惯带来大改变</li>
</ul>
<blockquote>读书不是为了记住，而是为了成为更好的自己。</blockquote>
<p>新的一年，希望能读到更多好书！</p>`,
      category: "生活",
      subcategory: "",
      tags: ["读书", "推荐", "年度总结"],
      summary: "分享今年读过的好书，涵盖技术和非技术类。",
      likes: 6,
      liked: false,
    },
    {
      title: "原神 6.7 版本「月之八」登月前瞻",
      content: `<p>原神 6.7 版本「月之八」即将于 7 月 1 日正式上线，这次更新将带我们<strong>远征月球</strong>！</p>
<h3>新角色：木偶·桑多涅</h3>
<p>愚人众第九席执行官终于实装！冰系大剑站场输出，拥有独特的召唤傀儡机制，二命性价比最高。</p>
<h3>月球探索</h3>
<p>全新永久可探索区域——月球表面，包含月球海、远古龙族遗迹和太空站。引入<strong>重力探索机制</strong>，低重力环境下战斗和移动体验完全不同。</p>
<h3>新反应：星传导</h3>
<p>冰元素 + 雷元素触发全新元素反应<strong>「星传导」</strong>，根据队友元素精通提升全队暴击伤害。</p>
<blockquote>踏上月球，揭开远古龙族与至冬国的秘密——这将是一场改变提瓦特命运的旅程。</blockquote>
<h3>夏日活动</h3>
<p>茜特菈莉泳装皮肤和夏洛蒂冬装新皮肤同步上线，千星奇域新增趣味玩法。</p>`,
      category: "游戏",
      subcategory: "米哈游",
      tags: ["原神", "米哈游", "版本更新", "6.7"],
      summary:
        "原神 6.7 版本即将上线，木偶·桑多涅实装，远征月球，全新重力机制与星传导反应登场。",
      likes: 20,
      liked: true,
    },
  ];

  // Demo comments data
  const demoComments = [
    { idx: 0, author: "李四", content: "写得太好了！期待更多内容。", offsetMs: -3600000 },
    { idx: 0, author: "王五", content: "学习了，感谢分享 👍", offsetMs: -7200000 },
    { idx: 1, author: "小明", content: "Promise 和 async/await 的对比讲得很清晰！", offsetMs: -1800000 },
    {
      idx: 1,
      author: "小红",
      content: "请问可以出一篇关于错误处理的文章吗？在实际项目中经常遇到异步错误处理的问题。",
      offsetMs: -5400000,
    },
    { idx: 2, author: "前端爱好者", content: "Grid 确实比 Flexbox 更适合二维布局，讲得很透彻。", offsetMs: -900000 },
    {
      idx: 3,
      author: "书友",
      content: "《原子习惯》我也很喜欢！推荐《深度工作》也很不错。",
      offsetMs: -2700000,
    },
  ];

  // Seed articles and likes inline (matching Express behavior — no explicit transaction)
  const articleIds: { id: string; likes: number; liked: boolean }[] = [];

  demos.forEach((d, i) => {
    const id = generateId("art");
    articleIds.push({ id, likes: d.likes, liked: d.liked });

    const createdAt = new Date(
      Date.now() - (demos.length - i) * 60000,
    ).toISOString();

    db.insert(articles)
      .values({
        id,
        title: d.title,
        content: d.content,
        category: d.category,
        subcategory: d.subcategory || "",
        tags: JSON.stringify(d.tags),
        summary: d.summary,
        coverImage: "",
        likesCount: d.likes,
        isPinned: 0,
        createdAt,
        updatedAt: createdAt,
      })
      .run();

    // Pre-populate likes
    for (let j = 0; j < d.likes; j++) {
      db.insert(likes)
        .values({
          articleId: id,
          userToken: "demo_like_user_" + j,
        })
        .run();
    }
  });

  // Insert demo comments
  demoComments.forEach((c) => {
    const cmtId = generateId("cmt");
    const cmtTime = new Date(Date.now() + c.offsetMs).toISOString();
    db.insert(comments)
      .values({
        id: cmtId,
        articleId: articleIds[c.idx].id,
        author: c.author,
        content: c.content,
        createdAt: cmtTime,
      })
      .run();
  });

  return new Response(
    JSON.stringify({ seeded: true, count: demos.length }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
