import asyncio
import os
import base64
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

# User image path
IMAGE_PATH = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_0_1766327366408.jpg")

def make_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    req = urllib.request.Request(url, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    
    if data:
        json_data = json.dumps(data).encode('utf-8')
        req.data = json_data
        req.add_header('Content-Type', 'application/json')
        
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        print(f"Request failed: {e}")
        return 0, None

async def test_api():
    if not API_KEY:
        print("ERROR: APIMART_API_KEY not found in .env")
        return

    if not IMAGE_PATH.exists():
        print(f"ERROR: Image not found at {IMAGE_PATH}")
        return

    print(f"Testing with API Key: {API_KEY[:5]}***")
    print(f"Image: {IMAGE_PATH}")

    # Encode image
    with open(IMAGE_PATH, "rb") as f:
        base64_data = base64.b64encode(f.read()).decode("utf-8")
        image_url = f"data:image/jpeg;base64,{base64_data}"

    # Enhanced prompt
    original_prompt = env.get("TRANSLATION_PROMPT", "Please translate all text in this image from Chinese to Russian.")
    enhanced_prompt = f"{original_prompt} IMPORTANT: Maintain the original aspect ratio (1.18:1). Do not crop the image. Keep the entire composition visible."
    
    # Payload WITHOUT 'size'
    payload = {
        "model": "gpt-4o-image",
        "prompt": enhanced_prompt,
        # "size": "1:1",  <-- REMOVED
        "n": 1,
        "image_urls": [image_url]
    }

    url = f"{API_ENDPOINT}/v1/images/generations"
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    print("Sending request without 'size' parameter...")
    status, data = make_request(url, "POST", payload, headers)
    print(f"Status Code: {status}")
    print(f"Response: {data}")
    
    if status == 200 and data:
        task_id = data.get("data", [{}])[0].get("task_id")
        print(f"Task ID: {task_id}")
        
        # Poll for result
        if task_id:
            print("Polling for result...")
            poll_url = f"{API_ENDPOINT}/v1/tasks/{task_id}"
            for i in range(30):
                time.sleep(2)
                p_status, p_data = make_request(poll_url, "GET", None, headers)
                
                status_str = p_data.get("data", {}).get("status")
                print(f"Poll {i+1}: {status_str}")
                
                if status_str == "completed":
                    print("Success!")
                    print(json.dumps(p_data, indent=2))
                    break
                if status_str == "failed":
                    print("Failed!")
                    print(p_data)
                    break

if __name__ == "__main__":
    asyncio.run(test_api())
