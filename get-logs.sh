#!/bin/bash

##############################################
# 获取服务器日志脚本
##############################################

SERVER_IP="47.243.77.183"
SERVER_USER="root"
SERVER_PASSWORD="Whz1900111107!"

# 默认获取最近 50 行，可以通过参数修改
LINES=${1:-50}

echo "===== 正在获取服务器日志（最近 ${LINES} 行）====="
echo ""

# 使用 expect 自动输入密码
expect << EOF
set timeout 30
spawn ssh ${SERVER_USER}@${SERVER_IP} "cd /root/ozon-translator && docker-compose logs --tail=${LINES} backend"
expect {
    "password:" {
        send "${SERVER_PASSWORD}\r"
        exp_continue
    }
    eof
}
EOF

echo ""
echo "===== 日志获取完成 ====="

