
import paramiko

SERVER_IP = "47.243.77.183"
SERVER_USER = "root"
SERVER_PASSWORD = "Whz1900111107!"

MISSING_ENV = """
# Security
JWT_SECRET=dev_secret_key_change_in_prod_12345
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# Invite Codes
INVITE_CODES=NMGNB,NMGQCDZSW
INVITE_BONUS=100
TRIAL_BONUS=5

# ZPay Configuration
ZPAY_GATEWAY=https://zpayz.cn/submit.php
ZPAY_PID=2025121822155819
ZPAY_KEY=SVVD7eIggI8JwP9I6C3xKPwACRqYxmlu
ZPAY_NOTIFY_URL=https://easy-reach.top/api/payments/notify
ZPAY_RETURN_URL=https://easy-reach.top/dashboard
ZPAY_TYPE=alipay
"""

def fix_env():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {SERVER_IP}...")
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD)
        
        print("Appending missing env vars...")
        # Check if ZPAY_PID exists to avoid double appending
        stdin, stdout, stderr = ssh.exec_command("grep -q 'ZPAY_PID' /root/ozon-translator/backend/.env")
        if stdout.channel.recv_exit_status() == 0:
            print("ZPAY_PID already exists, skipping append.")
        else:
            # Append safely
            cmd = f"echo '{MISSING_ENV}' >> /root/ozon-translator/backend/.env"
            ssh.exec_command(cmd)
            print(" appended.")
            
        print("Restarting backend container...")
        ssh.exec_command("docker restart image-translator-backend")
        print("Backend restarted.")

    except Exception as e:
        print(f"Failed to fix: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    fix_env()
