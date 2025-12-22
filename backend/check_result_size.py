import requests
from PIL import Image
from io import BytesIO

url = "https://upload.apimart.ai/f/image/9998233671202237-a5071609-0ba0-4dad-8c31-70ccf4aa9460-image_task_01KD0PD2H66WYMXYTY73TCWJ03_0.png"

try:
    print(f"Downloading {url}...")
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    print(f"Result Image Size: {img.size}")
    
    # Original: 1024x869 (Ratio: 1.178)
    original_w, original_h = 1024, 869
    original_ratio = original_w / original_h
    
    current_ratio = img.width / img.height
    print(f"Result Ratio: {current_ratio:.3f}")
    print(f"Original Ratio: {original_ratio:.3f}")
    
    if abs(current_ratio - original_ratio) < 0.05:
        print("SUCCESS: Aspect ratio preserved!")
    else:
        print("FAILURE: Aspect ratio mismatch!")

except Exception as e:
    print(f"Error: {e}")
