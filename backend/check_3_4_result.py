import urllib.request
from PIL import Image
from io import BytesIO

url = "https://upload.apimart.ai/f/image/9998233668751653-f96f38f0-8771-4e85-8164-3925e3299f8e-image_task_01KD0RQVNA25ACMGW36TB5KJ8A_0.png"

try:
    print(f"Downloading {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read()
        
    img = Image.open(BytesIO(content))
    print(f"Result Image Size: {img.size}")
    print(f"Result Ratio: {img.width/img.height:.2f}")
    
    if img.width == 1024 and img.height == 1024:
        print("RESULT: Fallback to 1:1 Square")
    else:
        print("RESULT: Custom Ratio Preserved")

except Exception as e:
    print(f"Error: {e}")
