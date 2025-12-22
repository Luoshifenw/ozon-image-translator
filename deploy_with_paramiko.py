
import os
import tarfile
import paramiko
import time


# 配置
SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"
LOCAL_TAR = "/tmp/ozon-translator.tar.gz"
REMOTE_TAR = "/tmp/ozon-translator.tar.gz"

def create_tarball():
    print("Creating tarball...")
    with tarfile.open(LOCAL_TAR, "w:gz") as tar:
        tar.add(".", arcname=".")
    print(f"Tarball created at {LOCAL_TAR}")

def deploy():
    # 创建 SSH 客户端
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        # 上传文件
        print("Uploading file...")
        with  paramiko.SFTPClient.from_transport(ssh.get_transport()) as sftp:
             sftp.put(LOCAL_TAR, REMOTE_TAR)
        print("Upload complete.")
        
        # 执行部署脚本
        commands = [
            # 解压
            "mkdir -p /root/ozon-translator",
            "cd /root/ozon-translator",
            f"tar -xzf {REMOTE_TAR}",
            
            # 配置环境变量
            "cd backend",
            """cat > .env << 'EOF'
APIMART_API_KEY=sk-SRi3QiySzzl6eznTqsNZRoW6RS2LUv8ItXqgsVX8xl76eDfG
APIMART_API_ENDPOINT=https://api.apimart.ai
TRANSLATION_PROMPT=将图片中的文字替换为俄语
TRANSLATION_CONCURRENCY=20
SERVICE_MODE=real
POLL_INTERVAL=3
POLL_MAX_ATTEMPTS=100
STORAGE_MODE=cloud
BASE_URL=http://47.243.77.183
EOF""",
            
            # 检查 Docker
            "if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | bash; systemctl start docker; systemctl enable docker; fi",
            "if ! command -v docker-compose &> /dev/null; then curl -L \"https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)\" -o /usr/local/bin/docker-compose; chmod +x /usr/local/bin/docker-compose; fi",
            
            # 启动服务
            "cd /root/ozon-translator",
            "docker rm -f image-translator-backend || true",
            "docker-compose down 2>/dev/null || true",
            "docker-compose build",
            "docker-compose up -d",
            "sleep 5",
            "docker-compose ps"
        ]
        
        for cmd in commands:
            print(f"Executing: {cmd[:50]}...")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            # 实时打印输出
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
    create_tarball()
    deploy()
