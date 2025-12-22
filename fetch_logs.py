
import paramiko

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

def fetch_logs():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        cmd = "docker logs --tail 50 image-translator-backend"
        print(f"Executing: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        print("\n=== Backend Logs ===")
        print(stdout.read().decode())
        print("====================")
        
        err = stderr.read().decode()
        if err:
            print(f"Stderr: {err}")

    except Exception as e:
        print(f"Failed to fetch logs: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    fetch_logs()
