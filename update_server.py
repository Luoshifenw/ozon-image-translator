
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
        
        # 使用链式命令确保在正确目录执行
        deploy_cmd = (
            "cd /root/ozon-translator && "
            "git config --global --add safe.directory '*' && "
            "git fetch origin main && "
            "git reset --hard origin/main && "
            "git clean -fd && "
            
            # 更新配置
            "sed -i 's/TRANSLATION_CONCURRENCY=5/TRANSLATION_CONCURRENCY=20/g' backend/.env && "
            
            # 清理旧容器
            "docker rm -f image-translator-backend || true && "
            "docker rm -f image-translator-frontend || true && "
            
            # 重启服务
            "docker-compose down && "
            "docker-compose build --no-cache backend && "
            "docker-compose build --no-cache frontend && "
            "docker-compose up -d"
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
