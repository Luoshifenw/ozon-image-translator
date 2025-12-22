
import paramiko

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

def check_server():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        # Check current dir and list files
        print("Checking /root content:")
        stdin, stdout, stderr = ssh.exec_command("ls -la /root")
        print(stdout.read().decode())
        
        # Check if ozon-translator exists
        print("Checking /root/ozon-translator content:")
        stdin, stdout, stderr = ssh.exec_command("ls -la /root/ozon-translator")
        print(stdout.read().decode())
        print(stderr.read().decode())

    finally:
        ssh.close()

if __name__ == "__main__":
    check_server()
