# Kaven's Blog — 云服务器部署指南

本指南适用于 **腾讯云 / 阿里云** 轻量应用服务器或云服务器（ECS/CVM），从零开始逐步完成部署。

---

## 目录

1. [服务器选购与配置](#1-服务器选购与配置)
2. [环境初始化](#2-环境初始化)
3. [上传项目代码](#3-上传项目代码)
4. [配置与启动](#4-配置与启动)
5. [配置 HTTPS（域名 + SSL）](#5-配置-https域名--ssl)
6. [日常运维](#6-日常运维)
7. [故障排查](#7-故障排查)
8. [附：完整命令速查表](#附完整命令速查表)

---

## 1. 服务器选购与配置

### 1.1 规格建议

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 系统盘 | 40 GB | 60 GB |
| 带宽 | 1 Mbps | 3 Mbps |
| 系统 | Ubuntu 22.04 / CentOS 7.9 | Ubuntu 22.04 |

> **个人博客完全够用**：腾讯云 Lighthouse / 阿里云 SWAS 轻量服务器，2核2G 一年约 50-100 元。

### 1.2 安全组 / 防火墙规则

在云控制台开放以下端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH 远程登录 |
| 80 | TCP | HTTP（必须） |
| 443 | TCP | HTTPS（有域名时开放） |

> **注意**：不要开放 3000 端口！Node 服务只在 Docker 内部网络监听，不对外暴露。

### 1.3 SSH 登录服务器

```bash
# 本地终端执行（替换为你的服务器 IP）
ssh root@你的服务器IP
```

---

## 2. 环境初始化

以下命令在服务器上执行。

### 2.1 安装 Docker

```bash
# === Ubuntu / Debian ===
curl -fsSL https://get.docker.com | bash

# === CentOS / RHEL ===
# curl -fsSL https://get.docker.com | bash

# 启动 Docker 并设置开机自启
systemctl enable docker --now

# 验证安装
docker --version
```

### 2.2 安装 Docker Compose（通常已内置）

```bash
# Docker 24+ 已内置 compose 插件，验证：
docker compose version

# 如果提示 command not found，手动安装：
# apt install -y docker-compose-plugin   # Ubuntu
# yum install -y docker-compose-plugin   # CentOS
```

### 2.3 安装 Git（通常已预装）

```bash
# Ubuntu
apt update && apt install -y git curl

# CentOS
# yum install -y git curl
```

### 2.4 创建项目目录

```bash
mkdir -p /opt/blog && cd /opt/blog
```

---

## 3. 上传项目代码

三种方式任选其一。

### 方式 A：Git 克隆（推荐）

如果代码已推送到 GitHub / Gitee：

```bash
cd /opt/blog
git clone https://github.com/你的用户名/仓库名.git .

# 或者从 Gitee（国内更快）
# git clone https://gitee.com/你的用户名/仓库名.git .
```

**国内服务器访问 GitHub 慢的解决方案：**

```bash
# 方案1: 使用 Gitee 镜像仓库
# 方案2: 配置 GitHub 代理
git config --global url."https://ghproxy.com/https://github.com".insteadOf "https://github.com"
# 方案3: 在本地打包后上传（见方式B）
```

### 方式 B：本地打包上传（无 Git 仓库时）

在**本地**终端执行：

```bash
# 本地项目目录下（排除 node_modules 等大文件）
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='data.db*' \
    --exclude='uploads/*' \
    --exclude='backups/*' \
    -czf blog.tar.gz .

# 上传到服务器（替换为你的 IP）
scp blog.tar.gz root@你的服务器IP:/opt/blog/

# 在服务器上解压
ssh root@你的服务器IP "cd /opt/blog && tar -xzf blog.tar.gz && rm blog.tar.gz"
```

### 方式 C：通过堡垒机 / 跳板机

如有堡垒机，先登录堡垒机再跳转，流程与方式 A 相同。

---

## 4. 配置与启动

### 4.1 运行一键部署脚本

```bash
cd /opt/blog
chmod +x deploy.sh
./deploy.sh
```

脚本会交互式引导你：

```
========================================
  Kaven's Blog — 一键部署
========================================

[1/4] 检查 Docker 环境...
✅ Docker 26.x
✅ Docker Compose v2.x

[2/4] 检查配置文件...
📝 未找到 .env 文件，从 .env.example 创建...
⚠  请编辑 .env 设置管理员密码（ADMIN_PASSWORD）

按回车继续（已编辑好 .env）...

[3/4] 构建 Docker 镜像...
✅ 镜像构建完成

[4/4] 启动服务...
✅ 部署完成！

  访问地址: http://123.456.789.0
```

### 4.2 手动配置（如果不用 deploy.sh）

```bash
cd /opt/blog

# 1. 创建 .env
cp .env.example .env

# 2. 编辑配置
nano .env
```

修改以下三项：

```ini
# 管理员账号
ADMIN_USERNAME=admin

# 管理员密码（必改！）
ADMIN_PASSWORD=你的强密码

# 密钥（留空自动生成，或手动填 64 位 hex）
AUTH_SECRET=
```

```bash
# 3. 构建并启动
docker compose up -d --build
```

### 4.3 检查服务状态

```bash
# 查看容器状态（所有容器应显示 Up / healthy）
docker compose ps

# 输出示例:
# NAME           STATUS
# blog-app       Up 2 minutes (healthy)
# blog-nginx     Up 2 minutes
# blog-backup    Up 2 minutes
```

如有容器未正常启动：

```bash
# 查看所有日志
docker compose logs

# 只看 app 日志
docker compose logs app

# 实时跟踪
docker compose logs -f
```

### 4.4 验证部署

```bash
# 1. 健康检查 API
curl http://localhost/api/health

# 应该返回: {"status":"ok","db":"/app/data.db","uptime":...}

# 2. 访问首页
curl -I http://localhost

# 应该返回: HTTP/1.1 200 OK
```

浏览器打开 `http://你的服务器IP`，应该能看到博客首页。

---

## 5. 配置 HTTPS（域名 + SSL）

### 5.1 前置条件

- 拥有一个域名（可在腾讯云/阿里云购买，几块钱一年）
- 域名 DNS 已解析到服务器 IP

### 5.2 DNS 解析设置

在域名控制台添加 A 记录：

| 主机记录 | 记录类型 | 记录值 | TTL |
|----------|---------|--------|-----|
| @ | A | 你的服务器IP | 600 |
| www | A | 你的服务器IP | 600 |

验证解析生效：

```bash
# 等待几分钟后测试（本机执行）
ping 你的域名
# 应该返回服务器 IP
```

### 5.3 修改 Caddyfile

```bash
cd /opt/blog
nano Caddyfile
```

将第一行的 `your-domain.com` 替换为你的域名：

```
你的域名.com {
    handle /api/* {
        reverse_proxy app:3000
    }
    ...
}
```

### 5.4 启动 Caddy（带 HTTPS）

```bash
# 先停掉 nginx（Caddy 会接管 80/443）
docker compose stop nginx

# 启动 Caddy
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d

# 查看证书申请状态
docker compose logs caddy

# 输出中应看到:
# "serving initial certificate" → 申请中
# "certificate obtained successfully" → 申请成功
```

> **HTTPS 证书会自动续签**，无需手动操作。Caddy 在证书到期前 30 天自动更新。

### 5.5 永久切换到 Caddy（可选）

如果不需要保留 Nginx：

```bash
# 创建 .env 覆盖文件
echo "COMPOSE_FILE=docker-compose.yml:docker-compose.caddy.yml" > .env

# 停止 nginx 容器
docker compose stop nginx
docker compose rm -f nginx

# 启动
docker compose up -d
```

---

## 6. 日常运维

### 6.1 更新代码

```bash
cd /opt/blog

# 拉取最新代码
git pull

# 重新构建并重启（只更新有变化的服务）
docker compose up -d --build

# 查看状态
docker compose ps
```

### 6.2 查看日志

```bash
# 所有服务
docker compose logs --tail=50

# 只看 App
docker compose logs -f app

# 只看 Nginx/Caddy
docker compose logs -f nginx
docker compose logs -f caddy

# 最近 100 行
docker compose logs --tail=100 app
```

### 6.3 重启服务

```bash
# 全部重启
docker compose restart

# 只重启 App
docker compose restart app
```

### 6.4 停止服务

```bash
# 停止但保留容器和数据
docker compose down

# 停止并删除容器（不删除数据卷）
docker compose down
```

### 6.5 数据库备份

自动备份：`backup` 容器每天自动将数据库文件复制到 `./backups/` 目录，保留最近 30 份。

手动备份：

```bash
# 方式1: 从容器导出
docker compose exec app cat /app/data.db > backups/manual_$(date +%Y%m%d_%H%M%S).db

# 方式2: 从数据卷导出
docker run --rm -v blog_blog-data:/data -v $(pwd)/backups:/backups alpine \
  cp /data/data.db /backups/data_$(date +%Y%m%d_%H%M%S).db
```

### 6.6 恢复数据库

```bash
# 1. 停止 app 容器（数据库在使用中）
docker compose stop app

# 2. 复制备份文件到数据卷
docker run --rm -v blog_blog-data:/data -v $(pwd)/backups:/backups alpine \
  cp /backups/data_20260701_030000.db /data/data.db

# 3. 重启
docker compose up -d
```

### 6.7 升级依赖（Docker 镜像）

```bash
# 拉取最新基础镜像并重新构建
docker compose build --pull --no-cache
docker compose up -d
```

### 6.8 查看磁盘占用

```bash
# Docker 整体占用
docker system df

# 清理未使用的镜像和缓存
docker system prune -a

# 备份文件大小
du -sh /opt/blog/backups/
```

---

## 7. 故障排查

### 7.1 容器无法启动

```bash
# 查看详细错误
docker compose logs app

# 常见原因:
# - 端口被占用: lsof -i :80
# - .env 配置有误: cat /opt/blog/.env
# - 磁盘空间不足: df -h
```

### 7.2 页面无法访问

```bash
# 1. 检查容器是否运行
docker compose ps

# 2. 检查 Nginx/Caddy 是否监听
curl -I http://localhost

# 3. 检查 API 是否正常
curl http://localhost/api/health

# 4. 检查云防火墙/安全组是否开放 80 端口
#   → 登录云控制台 → 安全组 → 入方向规则
```

### 7.3 HTTPS 证书申请失败

```bash
# 查看 Caddy 日志
docker compose logs caddy

# 常见原因及解决:
# 1. DNS 未解析 → 确认域名 A 记录指向服务器 IP
# 2. 80 端口未开放 → 在云控制台安全组中放行
# 3. 服务器无公网 IP → 需要弹性公网 IP
# 4. Let's Encrypt 频率限制 → 等 1 小时再试
```

### 7.4 数据库文件损坏

```bash
# better-sqlite3 使用 WAL 模式，很少损坏
# 如有问题，尝试恢复:

# 1. 检查 WAL 文件
docker compose exec app ls -la /app/
# 应看到 data.db 和 data.db-wal, data.db-shm

# 2. 手动 checkpoint（合并 WAL 到主文件）
docker compose exec app node -e "
  const db = require('better-sqlite3')('/app/data.db');
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
"

# 3. 如无法恢复，从备份还原（见 6.6）
```

### 7.5 忘记管理员密码

```bash
# 1. 查看当前密码（如果 auto-generated）
docker compose logs app | grep "密码"

# 2. 重置密码：修改 .env 中的 ADMIN_PASSWORD
nano /opt/blog/.env
# 修改 ADMIN_PASSWORD=新密码

# 3. 重启 app
docker compose restart app
```

---

## 附：完整命令速查表

```bash
# ===== 部署 =====
cd /opt/blog                            # 进入项目目录
./deploy.sh                             # 一键部署
docker compose up -d --build            # 构建并启动
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d  # 启动 + HTTPS

# ===== 状态 =====
docker compose ps                       # 查看服务状态
docker compose logs --tail=50           # 最近日志
docker compose logs -f app              # 实时跟踪 App 日志

# ===== 重启/停止 =====
docker compose restart                  # 重启全部
docker compose restart app              # 只重启 App
docker compose down                     # 停止服务

# ===== 更新 =====
git pull                                # 拉取代码
docker compose up -d --build            # 重新构建并部署

# ===== 备份 =====
ls -lt backups/                         # 查看备份列表
docker compose exec app cat /app/data.db > backups/manual.db  # 手动备份

# ===== 清理 =====
docker system prune -a                  # 清理未使用的镜像
docker compose logs --tail=0            # 清空日志显示
```

---

> **部署完成后，建议做的第一件事**：访问博客 → 登录管理后台 → 修改管理员密码 → 发布第一篇文章。
>
> 如有问题，从第 7 节故障排查开始，或查看 `docker compose logs`。
