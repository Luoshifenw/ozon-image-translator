#!/bin/bash

##############################################
# 获取服务器日志脚本
##############################################

SERVER_IP="47.243.77.183"
SERVER_USER="root"
SERVER_PASSWORD="Whz1900111107!"

# 使用 expect 自动输入密码
expect << EOF
set timeout 30
spawn ssh ${SERVER_USER}@${SERVER_IP} "cd /root/ozon-translator && docker-compose logs --tail=200 backend"
expect {
    "password:" {
        send "${SERVER_PASSWORD}\r"
        exp_continue
    }
    eof
}
EOF

