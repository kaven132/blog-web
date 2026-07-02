# Kaven 的个人博客 v2.0

基于 **Docker + better-sqlite3 + Nginx** 的容器化个人博客系统。

## v2.0 升级亮点

| 对比维度 | v1.0 (blog/) | v2.0 (blog2/) |
|----------|-------------|---------------|
| 数据库 | sql.js (纯JS，内存加载) | **better-sqlite3** (原生C，WAL模式) |
| 静态资源 | Express 直接服务 | **Nginx** 高性能服务 + Gzip + 缓存 |
| 部署方式 | 手动 Node 进程 | **Docker Compose** 一键编排 |
| 进程守护 | 需额外 PM2 | Docker `restart: unless-stopped` |
| 性能 | 中等 | **高** (原生DB + Nginx静态) |
| 可移植性 | 依赖 Node 环境 | **容器化**，任意Linux服务器即跑 |

## 架构

```
请求 → Nginx (:80)
        ├── /css, /js, /image  → Nginx 直接返回 (缓存7-30天)
        ├── /uploads/          → Nginx 读取共享卷
        ├── /api/*             → 反向代理到 Node (:3000)
        └── /                  → index.html
```

## 快速部署

### 前置要求

- Docker ≥ 24.0
- Docker Compose ≥ 2.0

### 1. 配置环境变量

```bash
# 复制模板
cp .env.example .env

# 编辑 .env 设置管理员密码和密钥
# ADMIN_PASSWORD=你的密码
# AUTH_SECRET=随机64字符密钥
```

### 2. 启动服务

```bash
# 构建并后台启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 查看首次启动自动生成的密码（如果未在 .env 设置）
docker compose logs app | grep "密码"
```

### 3. 访问

浏览器打开 `http://你的服务器IP`。

## 本地开发（无 Docker）

```bash
npm install
NO_STATIC=false node server.js
# 访问 http://localhost:3000
```

> `NO_STATIC=false` 让 Node 直接提供静态文件，无需 Nginx。

## 目录结构

```
blog2/
├── server.js              # Express API 服务 (better-sqlite3)
├── index.html             # 前端页面
├── css/style.css          # 样式
├── js/app.js              # 前端逻辑
├── image/pen.png          # 图标
├── uploads/               # 上传图片目录 (挂载到卷)
├── data.db                # SQLite 数据库 (自动生成)
│
├── Dockerfile             # Node.js 容器构建
├── nginx.conf             # Nginx 配置
├── docker-compose.yml     # 多容器编排
├── .env.example           # 环境变量模板
├── .dockerignore          # Docker 构建忽略
├── .gitignore
└── package.json
```

## 常用命令

```bash
# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码后重新构建
docker compose up -d --build

# 查看日志
docker compose logs -f app     # 只看 Node
docker compose logs -f nginx   # 只看 Nginx

# 备份数据库
docker compose exec app cat /app/data.db > backup.db

# 进入容器调试
docker compose exec app sh
```

## HTTPS 配置

配合 Nginx Proxy Manager 或 Caddy 可轻松加 SSL：

```bash
# 方案A: 使用 docker-compose 加入 Caddy
# 方案B: 宿主机安装 certbot + Nginx
# 方案C: 使用 Cloudflare Tunnel 免证书
```

## 技术栈

- **运行时**: Node.js 22 Alpine
- **后端**: Express 4.x
- **数据库**: better-sqlite3 (WAL 模式，原生性能)
- **Web 服务器**: Nginx 1.27 Alpine
- **认证**: scrypt 密码哈希 + HMAC-SHA256 Token
- **容器**: Docker + Docker Compose
