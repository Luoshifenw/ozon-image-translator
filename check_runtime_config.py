
import paramiko

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

def check_runtime():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        # Check runtime env inside container
        cmd = "docker exec image-translator-backend python3 -c \"from config import settings; print(f'Runtime_ZPAY_NOTIFY_URL={settings.ZPAY_NOTIFY_URL}')\""
        print(f"Executing: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        print("\n=== RUNTIME OUTPUT ===")
        print(stdout.read().decode())
        print(stderr.read().decode())
        
    except Exception as e:
        print(f"Failed to check runtime: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_runtime()
