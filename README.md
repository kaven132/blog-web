# Kaven 的个人博客 v2.0

基于 **Docker + better-sqlite3 + Nginx** 的容器化个人博客系统。

## v2.0 升级亮点

| 对比维度 | v1.0 (blog/) | v2.0 (blog2/) |
|----------|-------------|---------------|
| 数据库 | sql.js (纯JS，内存加载) | **better-sqlite3** (原生C，WAL模式) |
| 静态资源 | Express 直接服务 | **Nginx** 高性能服务 + Gzip + 缓存 |
| 部署方式 | 手动 Node 进程 | **Docker Compose** 一键编排 |
| 进程守护 | 需额外 PM2 | Docker `restart: unless-stopped` |
| 数据库备份 | 无 | **每日自动备份** (保留30份) |
| 镜像构建 | 单阶段 | **多阶段构建** (更小镜像) |
| 优雅关闭 | 无 | SIGTERM 安全关闭 DB |
| HTTPS | 需手动配置 | **可选 Caddy 自动 SSL** |
| 可移植性 | 依赖 Node 环境 | **容器化**，任意Linux服务器即跑 |

## 架构

```
请求 → Nginx (:80) 或 Caddy (:443)
        ├── /css, /js, /image  → 直接返回 (缓存7-30天)
        ├── /uploads/          → Nginx 读取共享卷
        ├── /api/*             → 反向代理到 Node (:3000)
        └── /                  → index.html (SPA fallback)
```

## 快速部署

### 前置要求

- Docker ≥ 24.0
- Docker Compose ≥ 2.0

### 一键部署（推荐）

```bash
# 1. 克隆代码
git clone <your-repo-url> blog && cd blog

# 2. 运行部署脚本
chmod +x deploy.sh && ./deploy.sh
```

### 手动部署

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 设置密码和密钥

# 2. 启动服务
docker compose up -d --build

# 3. 查看初始密码（如果未在 .env 中设置）
docker compose logs app | grep "密码"
```

### 启用 HTTPS（自动 SSL 证书）

```bash
# 1. 编辑 Caddyfile，将 your-domain.com 改为你的域名
# 2. 确保域名 DNS 解析到服务器 IP
# 3. 启动
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

## 本地开发（无 Docker）

```bash
npm install
NO_STATIC=false node server.js
# 访问 http://localhost:3000
```

> `NO_STATIC=false` 让 Node 直接提供静态文件，无需 Nginx。

## 目录结构

```
├── server.js                # Express API 服务 (better-sqlite3)
├── index.html               # 前端页面
├── css/style.css            # 样式
├── js/app.js                # 前端逻辑
├── image/                   # 图标等静态资源
├── uploads/                 # 上传图片目录 (挂载到卷)
├── backups/                 # 数据库每日自动备份
├── data.db                  # SQLite 数据库 (自动生成，不提交)
│
├── Dockerfile               # 多阶段构建 (编译 → 运行)
├── nginx.conf               # Nginx 配置
├── Caddyfile                # Caddy HTTPS 配置（可选）
├── docker-compose.yml       # 多容器编排
├── docker-compose.caddy.yml # Caddy HTTPS 附加配置
├── deploy.sh                # 一键部署脚本
├── .env.example             # 环境变量模板
├── .dockerignore
├── .gitignore
└── package.json
```

## 常用命令

```bash
# 启动 / 更新
docker compose up -d --build

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f app     # 只看 Node
docker compose logs -f nginx   # 只看 Nginx

# 手动备份数据库
docker compose exec app cat /app/data.db > backups/data_$(date +%Y%m%d_%H%M%S).db

# 进入容器调试
docker compose exec app sh

# 初始化演示数据
curl -X POST http://localhost:3000/api/demo/init
```

## HTTPS 配置

| 方案 | 说明 | 适用场景 |
|------|------|---------|
| Caddy（推荐） | 自动 Let's Encrypt，零配置 | 有域名 |
| Nginx + certbot | 手动配置证书 | 需要精细控制 |
| Cloudflare Tunnel | 免证书，Cloudflare 代理 | 不想暴露 IP |

## 技术栈

- **运行时**: Node.js 22 Alpine
- **后端**: Express 4.x
- **数据库**: better-sqlite3 (WAL 模式，原生性能)
- **Web 服务器**: Nginx 1.27 Alpine / Caddy 2 (HTTPS)
- **认证**: scrypt 密码哈希 + HMAC-SHA256 Token
- **容器**: Docker + Docker Compose (多阶段构建)
