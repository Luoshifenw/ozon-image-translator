
import paramiko

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

def check_frontend_logs():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        cmd = "cd /root/ozon-translator && docker-compose logs --tail=500 frontend"
        print(f"Executing: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        print("\n=== FRONTEND LOGS START ===")
        print(stdout.read().decode())
        print("=== FRONTEND LOGS END ===\n")
        
        err = stderr.read().decode()
        if err:
            print(f"Stderr: {err}")

    except Exception as e:
        print(f"Failed to check logs: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_frontend_logs()
