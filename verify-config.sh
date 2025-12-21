#!/bin/bash
# 验证 Nginx 和 Uvicorn 配置的脚本

echo "===== 检查 Nginx 超时配置 ====="
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf | grep -E "timeout|keepalive"

echo ""
echo "===== 检查后端容器启动命令 ====="
docker-compose exec backend ps aux | grep uvicorn

echo ""
echo "===== 检查容器构建时间 ====="
docker images | grep -E "ozon-translator|IMAGE"

echo ""
echo "===== 检查 Docker Compose 网络配置 ====="
docker network inspect image-translator-network | grep -A 5 "com.docker.network"


