
import paramiko
import time

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

def update_server():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        # 开启 KeepAlive 防止长时间无数据导致的连接断开
        transport = ssh.get_transport()
        if transport:
            transport.set_keepalive(30)
        
        # 使用链式命令确保在正确目录执行
        deploy_cmd = (
            "cd /root/ozon-translator && "
            "git config --global --add safe.directory '*' && "
            "git fetch origin main && "
            "git reset --hard origin/main && "
            "git clean -fd -e data && "
            
            # 停止服务以释放 80 端口（给 Certbot 用）
            "docker-compose down && "
            
            # 安装 Certbot (尝试 yum 或 apt)
            "(yum install -y certbot || apt-get install -y certbot) && "
            
            # 申请/更新证书 (非交互模式)
            "certbot certonly --standalone "
            "-d easy-reach.top -d www.easy-reach.top "
            "--register-unsafely-without-email "
            "--agree-tos "
            "--keep-until-expiring "
            "--non-interactive && "
            
            # 更新配置
            "sed -i 's/TRANSLATION_CONCURRENCY=5/TRANSLATION_CONCURRENCY=20/g' backend/.env && "
            "sed -i 's|BASE_URL=.*|BASE_URL=https://easy-reach.top|g' backend/.env || echo 'BASE_URL=https://easy-reach.top' >> backend/.env && "
            "sed -i 's|STORAGE_MODE=.*|STORAGE_MODE=cloud|g' backend/.env || echo 'STORAGE_MODE=cloud' >> backend/.env && "
            "sed -i 's|ZPAY_PID=.*|ZPAY_PID=2025121822155819|g' backend/.env || echo 'ZPAY_PID=2025121822155819' >> backend/.env && "
            "sed -i 's|ZPAY_KEY=.*|ZPAY_KEY=SVVD7eIggI8JwP9I6C3xKPwACRqYxmlu|g' backend/.env || echo 'ZPAY_KEY=SVVD7eIggI8JwP9I6C3xKPwACRqYxmlu' >> backend/.env && "
            "sed -i 's|ZPAY_NOTIFY_URL=.*|ZPAY_NOTIFY_URL=https://easy-reach.top/api/payments/notify|g' backend/.env || echo 'ZPAY_NOTIFY_URL=https://easy-reach.top/api/payments/notify' >> backend/.env && "
            "sed -i 's|ZPAY_RETURN_URL=.*|ZPAY_RETURN_URL=https://easy-reach.top/dashboard|g' backend/.env || echo 'ZPAY_RETURN_URL=https://easy-reach.top/dashboard' >> backend/.env && "
            
            # 清理旧容器 (down 会移除容器和网络)
            "docker-compose down && "
            
            # 重建并启动服务
            "docker-compose up -d --build"
        )
        
        print(f"Executing deployment sequence...")
        stdin, stdout, stderr = ssh.exec_command(deploy_cmd)
        
        # 实时读取输出
        while True:
            line = stdout.readline()
            if not line:
                break
            print(line.strip())
        
        err = stderr.read().decode()
        if err:
            print(f"Stderr: {err}")
            
        # 检查状态
        print("\nChecking service status...")
        stdin, stdout, stderr = ssh.exec_command("cd /root/ozon-translator && docker-compose ps && docker-compose logs --tail=20 backend")
        print(stdout.read().decode())

    except Exception as e:
        print(f"Deployment failed: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    update_server()
