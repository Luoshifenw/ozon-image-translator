import asyncio
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

# Manual .env loader
def load_env():
    env_vars = {}
    try:
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    except Exception:
        pass
    return env_vars

env = load_env()
API_KEY = env.get("APIMART_API_KEY")
API_ENDPOINT = env.get("APIMART_API_ENDPOINT", "https://api.apimart.ai")
TASK_ID = "task_01KD0RNBFHJ56QQ21G4KQ2X9WT"

def make_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    req = urllib.request.Request(url, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
        
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        print(f"Request failed: {e}")
        return 0, None

async def poll_task():
    poll_url = f"{API_ENDPOINT}/v1/tasks/{TASK_ID}"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    print(f"Polling task {TASK_ID}...")
    for i in range(30):
        time.sleep(2)
        status, data = make_request(poll_url, "GET", None, headers)
        
        status_str = data.get("data", {}).get("status")
        print(f"Poll {i+1}: {status_str}")
        
        if status_str == "completed":
            print("Success!")
            result = data.get("data", {}).get("result", {})
            images = result.get("images", [])
            if images:
                img_url = images[0].get("url")[0]
                print(f"Image URL: {img_url}")
                
                # Check dimensions
                import requests
                from PIL import Image
                from io import BytesIO
                
                print("Checking dimensions...")
                resp = requests.get(img_url)
                img = Image.open(BytesIO(resp.content))
                print(f"Result Size: {img.size}")
                print(f"Result Ratio: {img.width/img.height:.2f}")
            break
        if status_str == "failed":
            print("Failed!")
            print(data)
            break

if __name__ == "__main__":
    asyncio.run(poll_task())
