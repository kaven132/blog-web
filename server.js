/* ============================================
   Kaven's Blog — Backend Server
   Express + better-sqlite3 + Nginx reverse proxy
   ============================================ */

// Load .env file for local development (ignored in production)
try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────
app.use(express.json());
// NOTE: Static file serving is handled by Nginx in production.
// For local dev without Docker, serve static files as fallback:
if (!process.env.NO_STATIC) {
  app.use(express.static(__dirname));
}

// ── File Upload (multer) ────────────────────────
const multer = require('multer');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const name = 'img_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex') + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PNG / JPG / GIF / WebP / SVG / AVIF 格式'));
    }
  }
});

// ── Database (better-sqlite3 — synchronous, native) ──
const Database = require('better-sqlite3');
const dbPath = path.join(__dirname, 'data.db');

const db = new Database(dbPath);

// Performance & safety pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Alter existing articles table to add columns (safe if already exists)
for (const col of [
  'ALTER TABLE articles ADD COLUMN is_pinned INTEGER DEFAULT 0',
  'ALTER TABLE articles ADD COLUMN subcategory TEXT DEFAULT \'\''
]) {
  try { db.exec(col); } catch (e) { /* column already exists */ }
}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
    name TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    email TEXT DEFAULT '',
    location TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    social_github TEXT DEFAULT '',
    social_twitter TEXT DEFAULT '',
    social_website TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    summary TEXT DEFAULT '',
    cover_image TEXT DEFAULT '',
    likes_count INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    author TEXT DEFAULT '匿名',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    user_token TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(article_id, user_token),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS category_tree (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent TEXT NOT NULL,
    child TEXT NOT NULL,
    UNIQUE(parent, child)
  )
`);

// Seed default category hierarchy
const seedTree = [
  ['游戏', '米哈游'],
  ['游戏', '鹰角'],
];
const insertTree = db.prepare('INSERT OR IGNORE INTO category_tree (parent, child) VALUES (?, ?)');
for (const [parent, child] of seedTree) {
  insertTree.run(parent, child);
}

// Ensure default profile row
db.prepare('INSERT OR IGNORE INTO profile (id) VALUES (1)').run();

console.log('Database initialized:', dbPath);

// ── Auth ────────────────────────────────────────

// Credentials: env vars take priority, otherwise auto-generated on first run
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('hex');
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// If no env vars were set, mark credentials as auto-generated
const CREDS_AUTO_GENERATED = !process.env.ADMIN_PASSWORD && !process.env.AUTH_SECRET;

// Hash the password at startup using scrypt (salt derived from secret)
function hashPassword(password) {
  const salt = crypto.createHash('sha256').update('blog_salt_' + AUTH_SECRET).digest().subarray(0, 16);
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

const PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);

// Verify password using timing-safe comparison
function verifyPassword(password) {
  const hash = hashPassword(password);
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(PASSWORD_HASH, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Create HMAC-based auth token: base64("username:timestamp:hmac")
function createAuthToken(username) {
  const timestamp = Date.now();
  const payload = `${username}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  const token = `${payload}:${hmac}`;
  return Buffer.from(token).toString('base64');
}

// Verify auth token with expiration check
function verifyAuthToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const idx1 = decoded.indexOf(':');
    const idx2 = decoded.lastIndexOf(':');
    if (idx1 === -1 || idx2 === -1 || idx1 === idx2) return false;

    const username = decoded.substring(0, idx1);
    const timestamp = parseInt(decoded.substring(idx1 + 1, idx2), 10);
    const hmac = decoded.substring(idx2 + 1);

    if (!username || !timestamp || !hmac) return false;

    // Check expiration
    if (Date.now() - timestamp > TOKEN_EXPIRY_MS) return false;

    // Verify HMAC
    const payload = `${username}:${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');

    // Timing-safe comparison
    const bufA = Buffer.from(hmac, 'hex');
    const bufB = Buffer.from(expectedHmac, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

// Middleware to require auth
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录', requireAuth: true });
  }
  const token = authHeader.slice(7);
  if (!verifyAuthToken(token)) {
    return res.status(401).json({ error: '登录已过期，请重新登录', requireAuth: true });
  }
  next();
}

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  // Timing-safe username comparison
  const inputUser = Buffer.from(username);
  const storedUser = Buffer.from(ADMIN_USERNAME);
  const maxLen = Math.max(inputUser.length, storedUser.length);
  const paddedInput = Buffer.alloc(maxLen, 0);
  const paddedStored = Buffer.alloc(maxLen, 0);
  inputUser.copy(paddedInput);
  storedUser.copy(paddedStored);
  const userMatch = crypto.timingSafeEqual(paddedInput, paddedStored);

  if (!userMatch || !verifyPassword(password)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const token = createAuthToken(username);
  res.json({ token, username });
});

// ── File Upload Endpoint ────────────────────────
app.use('/uploads', express.static(uploadsDir));

// Upload (auth required)
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未选择文件' });
  }
  const url = '/uploads/' + req.file.filename;
  res.json({ url, filename: req.file.filename, size: req.file.size });
});

// ── Helpers ─────────────────────────────────────
function generateId(prefix = 'art') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function parseTags(tagsStr) {
  try {
    return JSON.parse(tagsStr || '[]');
  } catch {
    return [];
  }
}

function articleToJSON(row) {
  return {
    ...row,
    tags: parseTags(row.tags)
  };
}

function profileToJSON(row) {
  return {
    name: row.name,
    bio: row.bio,
    email: row.email,
    location: row.location,
    avatar: row.avatar,
    social: {
      github: row.social_github,
      twitter: row.social_twitter,
      website: row.social_website
    }
  };
}

// ════════════════════════════════════════════════
//  PROFILE API
// ════════════════════════════════════════════════

app.get('/api/profile', (_req, res) => {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profileToJSON(row));
});

app.put('/api/profile', requireAuth, (req, res) => {
  const { name, bio, email, location, avatar, social } = req.body;
  db.prepare(`
    UPDATE profile SET
      name = ?, bio = ?, email = ?, location = ?, avatar = ?,
      social_github = ?, social_twitter = ?, social_website = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(
    name || '', bio || '', email || '', location || '', avatar || '',
    (social && social.github) || '', (social && social.twitter) || '', (social && social.website) || ''
  );
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profileToJSON(row));
});

// ════════════════════════════════════════════════
//  ARTICLES API
// ════════════════════════════════════════════════

app.get('/api/articles', (req, res) => {
  const { category, subcategory, search, sort } = req.query;

  let sql = 'SELECT * FROM articles WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (subcategory && subcategory !== 'all') {
    sql += ' AND subcategory = ?';
    params.push(subcategory);
  }

  if (search && search.trim()) {
    sql += ' AND (title LIKE ? OR summary LIKE ? OR content LIKE ? OR tags LIKE ?)';
    const q = '%' + search.trim() + '%';
    params.push(q, q, q, q);
  }

  switch (sort) {
    case 'oldest':
      sql += ' ORDER BY is_pinned DESC, created_at ASC';
      break;
    case 'title':
      sql += ' ORDER BY is_pinned DESC, title COLLATE NOCASE ASC';
      break;
    case 'newest':
    default:
      sql += ' ORDER BY is_pinned DESC, created_at DESC';
  }

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(articleToJSON));
});

app.get('/api/articles/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: '文章不存在' });
  }
  res.json(articleToJSON(row));
});

// Ensure subcategory exists in category_tree
function ensureSubcategory(category, subcategory) {
  if (!category || !subcategory) return;
  db.prepare(
    'INSERT OR IGNORE INTO category_tree (parent, child) VALUES (?, ?)'
  ).run(category.trim(), subcategory.trim());
}

app.post('/api/articles', requireAuth, (req, res) => {
  const { title, content, category, subcategory, tags, summary, coverImage, isPinned } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' });
  }

  const cat = (category || '').trim();
  const subcat = (subcategory || '').trim();
  ensureSubcategory(cat, subcat);

  const id = generateId('art');
  const now = new Date().toISOString();
  const tagsStr = JSON.stringify(tags || []);

  db.prepare(`
    INSERT INTO articles (id, title, content, category, subcategory, tags, summary, cover_image, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title.trim(), content || '', cat, subcat, tagsStr, (summary || '').trim(), (coverImage || '').trim(), isPinned ? 1 : 0, now, now);

  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  res.status(201).json(articleToJSON(row));
});

app.put('/api/articles/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const { title, content, category, subcategory, tags, summary, coverImage, isPinned } = req.body;
  const cat = category !== undefined ? (category || '').trim() : existing.category;
  const subcat = subcategory !== undefined ? (subcategory || '').trim() : (existing.subcategory || '');
  ensureSubcategory(cat, subcat);
  const tagsStr = tags !== undefined ? JSON.stringify(tags) : existing.tags;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE articles SET
      title = ?, content = ?, category = ?, subcategory = ?, tags = ?, summary = ?,
      cover_image = ?, is_pinned = ?, updated_at = ?
    WHERE id = ?
  `).run(
    (title !== undefined ? title.trim() : existing.title),
    content !== undefined ? content : existing.content,
    cat,
    subcat,
    tagsStr,
    summary !== undefined ? (summary || '').trim() : existing.summary,
    coverImage !== undefined ? (coverImage || '').trim() : existing.cover_image,
    isPinned !== undefined ? (isPinned ? 1 : 0) : existing.is_pinned,
    now,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  res.json(articleToJSON(row));
});

app.delete('/api/articles/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '文章不存在' });
  }

  // Delete related comments and likes, then article
  db.prepare('DELETE FROM comments WHERE article_id = ?').run(req.params.id);
  db.prepare('DELETE FROM likes WHERE article_id = ?').run(req.params.id);
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// ── Toggle Pin ────────────────────────────────

app.post('/api/articles/:id/toggle-pin', requireAuth, (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const newPinned = article.is_pinned ? 0 : 1;
  db.prepare('UPDATE articles SET is_pinned = ? WHERE id = ?').run(newPinned, req.params.id);

  res.json({ isPinned: !!newPinned });
});

// ════════════════════════════════════════════════
//  CATEGORIES API
// ════════════════════════════════════════════════

app.get('/api/categories', (_req, res) => {
  const counts = {};
  const countRows = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM articles
    WHERE category IS NOT NULL AND category != ''
    GROUP BY category
    ORDER BY category COLLATE NOCASE ASC
  `).all();

  for (const row of countRows) {
    counts[row.category] = row.count;
  }

  // Get category tree (parent → children mapping)
  const treeRows = db.prepare('SELECT parent, child FROM category_tree ORDER BY parent, child').all();
  const tree = {};
  for (const row of treeRows) {
    if (!tree[row.parent]) tree[row.parent] = [];
    tree[row.parent].push(row.child);
  }

  res.json({ counts, tree });
});

// ════════════════════════════════════════════════
//  COMMENTS API
// ════════════════════════════════════════════════

app.get('/api/articles/:id/comments', (req, res) => {
  const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const rows = db.prepare(`
    SELECT * FROM comments
    WHERE article_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);
  res.json(rows);
});

app.post('/api/articles/:id/comments', (req, res) => {
  const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const { author, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }

  const id = generateId('cmt');
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO comments (id, article_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, (author || '').trim() || '匿名', content.trim(), now);

  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.delete('/api/comments/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '评论不存在' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ════════════════════════════════════════════════
//  LIKES API
// ════════════════════════════════════════════════

app.get('/api/articles/:id/likes', (req, res) => {
  const article = db.prepare('SELECT id, likes_count FROM articles WHERE id = ?').get(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const userToken = req.query.userToken;
  let isLiked = false;
  if (userToken) {
    const like = db.prepare('SELECT id FROM likes WHERE article_id = ? AND user_token = ?').get(req.params.id, userToken);
    isLiked = !!like;
  }

  res.json({
    count: article.likes_count,
    isLiked
  });
});

app.post('/api/articles/:id/like', (req, res) => {
  const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const { userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: '缺少 userToken' });

  // Check existing
  const existing = db.prepare('SELECT id FROM likes WHERE article_id = ? AND user_token = ?').get(req.params.id, userToken);
  if (existing) {
    return res.status(409).json({ error: '已经点过赞了', count: getLikeCount(req.params.id) });
  }

  db.prepare('INSERT INTO likes (article_id, user_token) VALUES (?, ?)').run(req.params.id, userToken);
  db.prepare('UPDATE articles SET likes_count = likes_count + 1 WHERE id = ?').run(req.params.id);

  res.json({ count: getLikeCount(req.params.id), isLiked: true });
});

app.delete('/api/articles/:id/like', (req, res) => {
  const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }

  const { userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: '缺少 userToken' });

  const existing = db.prepare('SELECT id FROM likes WHERE article_id = ? AND user_token = ?').get(req.params.id, userToken);
  if (!existing) {
    return res.status(404).json({ error: '还没有点赞', count: getLikeCount(req.params.id) });
  }

  db.prepare('DELETE FROM likes WHERE article_id = ? AND user_token = ?').run(req.params.id, userToken);
  db.prepare('UPDATE articles SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(req.params.id);

  res.json({ count: getLikeCount(req.params.id), isLiked: false });
});

function getLikeCount(articleId) {
  const row = db.prepare('SELECT likes_count FROM articles WHERE id = ?').get(articleId);
  return row ? row.likes_count : 0;
}

// ════════════════════════════════════════════════
//  DEMO DATA API
// ════════════════════════════════════════════════

app.post('/api/demo/init', (req, res) => {
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM articles').get();

  if (cnt > 0) {
    return res.json({ seeded: false, reason: '已有文章数据' });
  }

  // Demo profile
  db.prepare(`
    UPDATE profile SET
      name = ?, bio = ?, email = ?, location = ?, avatar = ?,
      social_github = ?, social_twitter = ?, social_website = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run('张三', '热爱技术与生活，喜欢分享自己的学习心得。', 'zhangsan@example.com', '北京', '',
    'https://github.com', '', '');

  const demos = [
    {
      title: '欢迎来到我的博客',
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
      category: '随笔',
      tags: ['博客', '介绍'],
      summary: '欢迎来到我的个人博客，这里记录了技术分享和生活感悟。',
      likes: 12, liked: true
    },
    {
      title: 'JavaScript 异步编程入门',
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
      category: '技术',
      tags: ['JavaScript', '异步', 'Promise', 'Async/Await'],
      summary: '深入理解 JavaScript 异步编程，掌握 Promise 和 Async/Await 的使用方法。',
      likes: 8, liked: false
    },
    {
      title: 'CSS Grid 布局完全指南',
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
      category: '技术',
      tags: ['CSS', '布局', 'Grid'],
      summary: '全面介绍 CSS Grid 布局的核心概念、常用技巧和响应式实践。',
      likes: 15, liked: true
    },
    {
      title: '我的 2024 年读书清单',
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
      category: '生活',
      tags: ['读书', '推荐', '年度总结'],
      summary: '分享今年读过的好书，涵盖技术和非技术类。',
      likes: 6, liked: false
    },
    {
      title: '原神 6.7 版本「月之八」登月前瞻',
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
      category: '游戏',
      subcategory: '米哈游',
      tags: ['原神', '米哈游', '版本更新', '6.7'],
      summary: '原神 6.7 版本即将上线，木偶·桑多涅实装，远征月球，全新重力机制与星传导反应登场。',
      likes: 20, liked: true
    }
  ];

  const insertArticle = db.prepare(`
    INSERT INTO articles (id, title, content, category, subcategory, tags, summary, cover_image, likes_count, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLike = db.prepare('INSERT OR IGNORE INTO likes (article_id, user_token) VALUES (?, ?)');

  const articleIds = [];
  const insertMany = db.transaction(() => {
    demos.forEach((d, i) => {
      const id = generateId('art');
      articleIds.push({ id, likes: d.likes, liked: d.liked });

      const createdAt = new Date(Date.now() - (demos.length - i) * 60000).toISOString();
      insertArticle.run(id, d.title, d.content, d.category, d.subcategory || '', JSON.stringify(d.tags), d.summary, '', d.likes, 0, createdAt, createdAt);

      // Pre-populate likes
      for (let j = 0; j < d.likes; j++) {
        insertLike.run(id, 'demo_like_user_' + j);
      }
    });

    // Demo comments
    const insertComment = db.prepare(
      'INSERT INTO comments (id, article_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    const comments = [
      { idx: 0, author: '李四', content: '写得太好了！期待更多内容。', offsetMs: -3600000 },
      { idx: 0, author: '王五', content: '学习了，感谢分享 👍', offsetMs: -7200000 },
      { idx: 1, author: '小明', content: 'Promise 和 async/await 的对比讲得很清晰！', offsetMs: -1800000 },
      { idx: 1, author: '小红', content: '请问可以出一篇关于错误处理的文章吗？在实际项目中经常遇到异步错误处理的问题。', offsetMs: -5400000 },
      { idx: 2, author: '前端爱好者', content: 'Grid 确实比 Flexbox 更适合二维布局，讲得很透彻。', offsetMs: -900000 },
      { idx: 3, author: '书友', content: '《原子习惯》我也很喜欢！推荐《深度工作》也很不错。', offsetMs: -2700000 }
    ];

    comments.forEach(c => {
      const cmtId = generateId('cmt');
      const cmtTime = new Date(Date.now() + c.offsetMs).toISOString();
      insertComment.run(cmtId, articleIds[c.idx].id, c.author, c.content, cmtTime);
    });
  });

  insertMany();

  res.json({ seeded: true, count: demos.length });
});

// ════════════════════════════════════════════════
//  Health Check
// ════════════════════════════════════════════════
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: dbPath, uptime: process.uptime() });
});

// ════════════════════════════════════════════════
//  Start Server
// ════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log('📝 Kaven\'s Blog server running at http://0.0.0.0:' + PORT);
  console.log('   Database: ' + dbPath + ' (better-sqlite3, WAL mode)');
  if (CREDS_AUTO_GENERATED) {
    console.log('──────────────────────────────────────────────');
    console.log('🔑 Auto-generated credentials (first run):');
    console.log('   账号: ' + ADMIN_USERNAME);
    console.log('   密码: ' + ADMIN_PASSWORD);
    console.log('⚠  请复制保存！设置环境变量可固定：');
    console.log('   ADMIN_USERNAME=xxx ADMIN_PASSWORD=xxx AUTH_SECRET=xxx');
    console.log('──────────────────────────────────────────────');
  }
});
