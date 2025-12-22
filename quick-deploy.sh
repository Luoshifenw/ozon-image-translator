#!/bin/bash

##############################################
# 快速部署脚本 - 使用 sshpass 自动输入密码
##############################################

set -e

SERVER_IP="47.243.77.183"
SERVER_USER="root"
SERVER_PASSWORD="Whz1900111107!"
API_KEY="sk-SRi3QiySzzl6eznTqsNZRoW6RS2LUv8ItXqgsVX8xl76eDfG"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   快速部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否安装 sshpass
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}正在安装 sshpass...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install hudochenkov/sshpass/sshpass || {
            echo "请先安装 Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        }
    else
        # Linux
        sudo apt-get install -y sshpass || sudo yum install -y sshpass
    fi
fi

echo -e "${YELLOW}[1/6] 打包代码...${NC}"
cd "$(dirname "$0")"
tar --exclude='node_modules' --exclude='temp' --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' -czf /tmp/ozon-translator.tar.gz .
echo -e "${GREEN}✓ 代码已打包${NC}"

echo -e "${YELLOW}[2/6] 上传到服务器...${NC}"
sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/ozon-translator.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
echo -e "${GREEN}✓ 代码已上传${NC}"

echo -e "${YELLOW}[3/6] 在服务器上部署...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} bash << 'ENDSSH'
    set -e
    
    # 解压代码
    echo "正在解压代码..."
    mkdir -p /root/ozon-translator
    cd /root/ozon-translator
    tar -xzf /tmp/ozon-translator.tar.gz
    
    # 配置环境变量
    echo "正在配置环境变量..."
    cd backend
    cat > .env << 'EOF'
APIMART_API_KEY=sk-SRi3QiySzzl6eznTqsNZRoW6RS2LUv8ItXqgsVX8xl76eDfG
APIMART_API_ENDPOINT=https://api.apimart.ai
TRANSLATION_PROMPT=将图片中的文字替换为俄语
TRANSLATION_CONCURRENCY=5
SERVICE_MODE=real
POLL_INTERVAL=3
POLL_MAX_ATTEMPTS=100
STORAGE_MODE=cloud
BASE_URL=http://47.243.77.183
EOF
    
    echo "✓ 环境变量配置完成"
ENDSSH
echo -e "${GREEN}✓ 部署完成${NC}"

echo -e "${YELLOW}[4/6] 检查 Docker...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} bash << 'ENDSSH'
    if ! command -v docker &> /dev/null; then
        echo "正在安装 Docker..."
        curl -fsSL https://get.docker.com | bash
        systemctl start docker
        systemctl enable docker
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "正在安装 Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    echo "Docker: $(docker --version)"
    echo "Docker Compose: $(docker-compose --version)"
ENDSSH
echo -e "${GREEN}✓ Docker 环境就绪${NC}"

echo -e "${YELLOW}[5/6] 构建并启动服务...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} bash << 'ENDSSH'
    cd /root/ozon-translator
    
    # 停止旧服务
    docker-compose down 2>/dev/null || true
    
    # 构建镜像
    echo "正在构建 Docker 镜像..."
    docker-compose build
    
    # 启动服务
    echo "正在启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    sleep 5
    
    # 显示状态
    echo ""
    echo "服务状态:"
    docker-compose ps
ENDSSH
echo -e "${GREEN}✓ 服务已启动${NC}"

echo -e "${YELLOW}[6/6] 测试访问...${NC}"
sleep 3
if curl -s http://${SERVER_IP} > /dev/null; then
    echo -e "${GREEN}✓ 服务访问正常${NC}"
else
    echo -e "${YELLOW}⚠ 服务可能还在启动中${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}访问地址: ${NC}http://${SERVER_IP}"
echo ""





