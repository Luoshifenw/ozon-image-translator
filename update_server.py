
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
        
        commands = [
            "cd /root/ozon-translator",
            "git reset --hard",
            "git pull origin main",
            
            # 手动更新服务器端的 .env 并发配置 (因为 .env 通常不进 git 或已被修改)
            "sed -i 's/TRANSLATION_CONCURRENCY=5/TRANSLATION_CONCURRENCY=20/g' backend/.env",
            
            "docker-compose down",
            "docker-compose build --no-cache backend",
            "docker-compose up -d",
            "sleep 5",
            "docker-compose ps",
            "docker-compose logs --tail=20 backend"
        ]
        
        for cmd in commands:
            print(f"\nExecuting: {cmd}")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            
            # 实时读取输出
            while True:
                line = stdout.readline()
                if not line:
                    break
                print(line.strip())
            
            err = stderr.read().decode()
            if err:
                print(f"Stderr: {err}")

    except Exception as e:
        print(f"Deployment failed: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    update_server()
