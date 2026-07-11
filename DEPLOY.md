# Kaven's Blog — 云服务器部署指南

本指南适用于 **腾讯云 / 阿里云** 轻量应用服务器或云服务器，从零部署 Astro SSR 博客系统。

---

## 目录

1. [服务器配置](#1-服务器配置)
2. [环境初始化](#2-环境初始化)
3. [上传代码](#3-上传代码)
4. [配置与启动](#4-配置与启动)
5. [HTTPS 配置](#5-https-配置)
6. [日常运维](#6-日常运维)
7. [故障排查](#7-故障排查)

---

## 1. 服务器配置

### 规格建议

| 项目 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 系统 | Ubuntu 22.04 | Ubuntu 22.04 |

### 防火墙规则

| 端口 | 用途 |
|------|------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS（有域名时） |

---

## 2. 环境初始化

```bash
# SSH 登录
ssh root@你的服务器IP

# 安装 Docker
curl -fsSL https://get.docker.com | bash
systemctl enable docker --now

# 验证
docker --version
docker compose version

# 安装 Git
apt update && apt install -y git curl
```

---

## 3. 上传代码

### Git 克隆（推荐）

```bash
mkdir -p /opt/blog && cd /opt/blog
git clone https://github.com/你的用户名/仓库名.git .
```

### 本地打包上传

```bash
# 本地打包
tar --exclude='node_modules' --exclude='.git' \
    --exclude='data.db*' --exclude='dist' \
    --exclude='uploads/*' --exclude='backups/*' \
    -czf blog.tar.gz .

# 上传
scp blog.tar.gz root@你的服务器IP:/opt/blog/

# 服务器解压
ssh root@你的服务器IP "cd /opt/blog && tar -xzf blog.tar.gz && rm blog.tar.gz"
```

---

## 4. 配置与启动

### 一键部署

```bash
cd /opt/blog
chmod +x deploy.sh
./deploy.sh
```

### 手动配置

```bash
cd /opt/blog
cp .env.example .env
nano .env   # 修改 ADMIN_PASSWORD
```

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的强密码
AUTH_SECRET=
```

```bash
docker compose up -d --build
```

### 验证

```bash
curl http://localhost/api/health
# → {"status":"ok","db":"/app/data.db","uptime":...}

curl -I http://localhost
# → HTTP/1.1 200 OK
```

浏览器打开 `http://你的服务器IP` 即可访问。

---

## 5. HTTPS 配置

### 前提

- 域名 DNS 已解析到服务器 IP
- 添加 A 记录: `@` → 服务器 IP

### 修改 Caddyfile

将第一行的 `your-domain.com` 替换为你的域名。

### 启动 Caddy

```bash
# 停掉 Nginx，启动 Caddy
docker compose stop nginx
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d

# 查看证书状态
docker compose logs caddy
```

> Caddy 自动申请 Let's Encrypt 证书并在到期前 30 天自动续签。

---

## 6. 日常运维

```bash
# 更新代码
cd /opt/blog
git pull
docker compose up -d --build

# 查看状态
docker compose ps

# 查看日志
docker compose logs --tail=50
docker compose logs -f app

# 重启
docker compose restart

# 停止
docker compose down
```

### 数据库备份

```bash
# 自动: backup 容器每天备份到 ./backups/，保留 30 份
ls -lt backups/

# 手动备份
docker compose exec app cat /app/data.db > backups/manual_$(date +%Y%m%d).db
```

### 恢复数据库

```bash
docker compose stop app
docker run --rm -v blog_blog-data:/data -v $(pwd)/backups:/backups alpine \
  cp /backups/data_20260701.db /data/data.db
docker compose up -d
```

---

## 7. 故障排查

### 容器无法启动

```bash
docker compose logs app
# 常见原因: 端口占用、.env 未配置、磁盘空间不足
```

### 页面无法访问

```bash
docker compose ps           # 检查容器状态
curl http://localhost/api/health  # 检查 API
# 检查云控制台安全组是否开放 80 端口
```

### 忘记密码

```bash
nano /opt/blog/.env   # 修改 ADMIN_PASSWORD
docker compose restart app
```

### 数据库损坏

```bash
docker compose exec app node -e "
  const db = require('better-sqlite3')('/app/data.db');
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
"
# 如无法恢复，从备份还原
```
