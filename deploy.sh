#!/bin/bash

##############################################
# 阿里云服务器一键部署脚本
# 用途: 自动部署图片翻译工具到云服务器
##############################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
SERVER_IP="47.243.77.183"
SERVER_USER="root"
SERVER_PORT="22"
APP_DIR="/root/ozon-translator"
GITHUB_REPO="https://github.com/Luoshifenw/ozon-image-translator.git"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   图片翻译工具 - 一键部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查本地是否有SSH密钥
if [ -f ~/.ssh/id_rsa ]; then
    echo -e "${GREEN}✓ 检测到 SSH 密钥，将尝试使用密钥连接${NC}"
    SSH_CMD="ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP}"
    SCP_CMD="scp -P ${SERVER_PORT}"
else
    echo -e "${YELLOW}⚠ 未检测到 SSH 密钥，将使用密码连接${NC}"
    SSH_CMD="ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP}"
    SCP_CMD="scp -P ${SERVER_PORT}"
fi

echo ""
echo -e "${YELLOW}目标服务器: ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}${NC}"
echo ""

# 测试连接
echo -e "${YELLOW}[1/7] 测试服务器连接...${NC}"
if $SSH_CMD "echo '连接成功'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 服务器连接成功${NC}"
else
    echo -e "${RED}✗ 服务器连接失败，请检查：${NC}"
    echo -e "${RED}  1. 服务器 IP 是否正确${NC}"
    echo -e "${RED}  2. SSH 密码是否正确${NC}"
    echo -e "${RED}  3. 服务器是否开放 SSH 端口${NC}"
    exit 1
fi

# 检查并安装 Docker
echo ""
echo -e "${YELLOW}[2/7] 检查 Docker 环境...${NC}"
$SSH_CMD bash << 'ENDSSH'
    if ! command -v docker &> /dev/null; then
        echo "Docker 未安装，正在安装..."
        curl -fsSL https://get.docker.com | bash
        systemctl start docker
        systemctl enable docker
        echo "✓ Docker 安装完成"
    else
        echo "✓ Docker 已安装: $(docker --version)"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "Docker Compose 未安装，正在安装..."
        curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        echo "✓ Docker Compose 安装完成"
    else
        echo "✓ Docker Compose 已安装: $(docker-compose --version)"
    fi
ENDSSH

# 克隆代码
echo ""
echo -e "${YELLOW}[3/7] 部署代码到服务器...${NC}"
$SSH_CMD bash << ENDSSH
    # 删除旧目录（如果存在）
    if [ -d "${APP_DIR}" ]; then
        echo "删除旧版本..."
        rm -rf ${APP_DIR}
    fi
    
    # 克隆代码
    echo "克隆代码仓库..."
    git clone ${GITHUB_REPO} ${APP_DIR}
    
    cd ${APP_DIR}
    echo "✓ 代码部署完成"
    echo "当前版本: \$(git log -1 --oneline)"
ENDSSH

# 配置环境变量
echo ""
echo -e "${YELLOW}[4/7] 配置环境变量...${NC}"
echo -e "${YELLOW}请输入 APIMart API Key:${NC}"
read -r API_KEY

$SSH_CMD bash << ENDSSH
    cd ${APP_DIR}/backend
    
    # 创建生产环境 .env 文件
    cat > .env << 'EOF'
# APIMart API 配置
APIMART_API_KEY=${API_KEY}
APIMART_API_ENDPOINT=https://api.apimart.ai

# 翻译提示词
TRANSLATION_PROMPT=将图片中的文字替换为俄语

# 并发数量
TRANSLATION_CONCURRENCY=5

# 服务模式
SERVICE_MODE=real

# 轮询配置
POLL_INTERVAL=3
POLL_MAX_ATTEMPTS=100

# 存储模式（云端使用 URL）
STORAGE_MODE=cloud
BASE_URL=http://${SERVER_IP}
EOF
    
    echo "✓ 环境变量配置完成"
ENDSSH

# 配置防火墙
echo ""
echo -e "${YELLOW}[5/7] 配置防火墙...${NC}"
$SSH_CMD bash << 'ENDSSH'
    # 开放 80 端口（HTTP）
    if command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --reload
        echo "✓ 防火墙已配置（firewalld）"
    elif command -v ufw &> /dev/null; then
        ufw allow 80/tcp
        echo "✓ 防火墙已配置（ufw）"
    else
        echo "⚠ 未检测到防火墙，跳过配置"
    fi
ENDSSH

# 构建和启动服务
echo ""
echo -e "${YELLOW}[6/7] 构建并启动服务...${NC}"
$SSH_CMD bash << ENDSSH
    cd ${APP_DIR}
    
    # 停止旧服务（如果存在）
    docker-compose down 2>/dev/null || true
    
    # 构建镜像
    echo "正在构建 Docker 镜像..."
    docker-compose build
    
    # 启动服务
    echo "正在启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    sleep 5
    
    # 检查服务状态
    echo ""
    echo "服务状态:"
    docker-compose ps
ENDSSH

# 测试访问
echo ""
echo -e "${YELLOW}[7/7] 测试服务访问...${NC}"
sleep 3

if curl -s http://${SERVER_IP} > /dev/null; then
    echo -e "${GREEN}✓ 服务部署成功！${NC}"
else
    echo -e "${YELLOW}⚠ 服务可能还在启动中，请稍后访问${NC}"
fi

# 完成
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}前端访问地址: ${NC}http://${SERVER_IP}"
echo -e "${GREEN}后端 API: ${NC}http://${SERVER_IP}/api"
echo ""
echo -e "${YELLOW}常用命令:${NC}"
echo -e "  查看日志: ${SSH_CMD} 'cd ${APP_DIR} && docker-compose logs -f'"
echo -e "  重启服务: ${SSH_CMD} 'cd ${APP_DIR} && docker-compose restart'"
echo -e "  停止服务: ${SSH_CMD} 'cd ${APP_DIR} && docker-compose down'"
echo ""







