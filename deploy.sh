#!/bin/bash
# ============================================
# Kaven's Blog — 一键部署脚本
# Astro SSR + Nginx + Docker Compose
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  Kaven's Blog — 一键部署"
echo "========================================"

# ── 1. 检查 Docker 环境 ────────────────────
echo ""
echo "[1/4] 检查 Docker 环境..."

if ! command -v docker &> /dev/null; then
    echo "❌ 未安装 Docker，请先安装 Docker"
    echo "   curl -fsSL https://get.docker.com | bash"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ 需要 Docker Compose v2+，请升级"
    exit 1
fi

echo "✅ Docker $(docker --version | awk '{print $3}' | sed 's/,//')"
echo "✅ Docker Compose $(docker compose version --short)"

# ── 2. 初始化 .env ─────────────────────────
echo ""
echo "[2/4] 检查配置文件..."

if [ ! -f .env ]; then
    echo "📝 未找到 .env 文件，从 .env.example 创建..."

    # 生成随机 AUTH_SECRET
    RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

    cp .env.example .env

    # 替换默认值
    sed -i "s/ADMIN_USERNAME=admin/ADMIN_USERNAME=${ADMIN_USERNAME:-admin}/" .env
    sed -i "s/AUTH_SECRET=/AUTH_SECRET=${RANDOM_SECRET}/" .env

    echo "⚠  请编辑 .env 设置管理员密码（ADMIN_PASSWORD）"
    echo "   当前 AUTH_SECRET 已自动生成"
    echo ""
    read -r -p "按回车继续（已编辑好 .env）..." _unused
fi

# 检查 ADMIN_PASSWORD 是否设置
if grep -q "ADMIN_PASSWORD=$" .env 2>/dev/null; then
    echo "⚠  ADMIN_PASSWORD 未设置！"
    echo "   请编辑 .env 设置密码后重新运行"
    exit 1
fi

echo "✅ 配置文件就绪"

# ── 3. 构建镜像 ────────────────────────────
echo ""
echo "[3/4] 构建 Docker 镜像..."
docker compose build --pull

echo "✅ 镜像构建完成"

# ── 4. 启动服务 ────────────────────────────
echo ""
echo "[4/4] 启动服务..."
docker compose up -d

# ── 等待启动完成 ───────────────────────────
echo ""
echo "⏳ 等待服务就绪..."
sleep 3

# 健康检查
if docker compose ps | grep -q "healthy"; then
    echo "✅ 服务已就绪"
else
    echo "⏳ 服务启动中，再等待几秒..."
    sleep 5
fi

# ── 完成 ────────────────────────────────────
echo ""
echo "========================================"
echo "  🎉 部署完成！"
echo "========================================"
echo ""

# 获取服务器 IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || echo "你的服务器IP")

echo "  访问地址: http://${SERVER_IP}"
echo "  服务状态: docker compose ps"
echo "  查看日志: docker compose logs -f"
echo ""
echo "  常用命令:"
echo "    重启:     docker compose restart"
echo "    停止:     docker compose down"
echo "    更新:     git pull && docker compose up -d --build"
echo "    备份数据库: docker compose exec app cat /app/data.db > backups/data_\$(date +%Y%m%d).db"
echo ""
echo "  备份目录: ./backups/ (每日自动备份，保留30份)"
echo ""
echo "========================================"
