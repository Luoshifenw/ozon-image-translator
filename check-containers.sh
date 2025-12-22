#!/bin/bash
# 检查服务器容器状态脚本

echo "===== 检查容器运行状态 ====="
cd /root/ozon-translator
docker-compose ps

echo ""
echo "===== 检查前端容器创建时间 ====="
docker inspect ozon-translator-frontend | grep -A 1 "Created"

echo ""
echo "===== 检查前端镜像构建时间 ====="
docker images | grep ozon-translator-frontend

echo ""
echo "===== 检查最近的容器日志 ====="
docker-compose logs --tail=10 frontend





