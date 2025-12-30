
import paramiko

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

def check_env():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        print("Checking backend directory content:")
        stdin, stdout, stderr = ssh.exec_command("ls -la /root/ozon-translator/backend")
        print(stdout.read().decode())
        
        print("\nChecking backend/.env content:")
        stdin, stdout, stderr = ssh.exec_command("cat /root/ozon-translator/backend/.env")
        content = stdout.read().decode()
        print(content)
        
    except Exception as e:
        print(f"Failed to check env: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_env()
