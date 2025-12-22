import asyncio
import os
from pathlib import Path
from services.translation import RealTranslationService

# Manual env load
env_path = Path(".env")
if env_path.exists():
    with open(env_path, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ[key] = val

api_key = os.getenv("APIMART_API_KEY")
api_endpoint = os.getenv("APIMART_API_ENDPOINT")
prompt = os.getenv("TRANSLATION_PROMPT", "Translate Chinese to English")

async def test_ozon_mode():
    if not api_key:
        print("Error: APIMART_API_KEY not found")
        return

    service = RealTranslationService(
        api_key=api_key,
        api_endpoint=api_endpoint,
        prompt=prompt,
        storage_mode="local"
    )
    
    # Use the user's tall image (487x1024)
    input_path = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_1766368336313.jpg")
    output_dir = Path("temp_test_ozon").resolve()
    output_dir.mkdir(exist_ok=True)
    
    print(f"Input: {input_path}")
    
    try:
        # Call with target_mode="ozon_3_4"
        print("Starting translation with mode='ozon_3_4'...")
        result_path = await service.translate(input_path, output_dir, target_mode="ozon_3_4")
        
        print(f"Result saved to: {result_path}")
        
        # Check dimensions
        from PIL import Image
        with Image.open(result_path) as img:
            w, h = img.size
            ratio = w / h
            print(f"Result Size: {w}x{h}")
            print(f"Result Ratio: {ratio:.2f}")
            
            # Expected 3:4 = 0.75
            if 0.74 < ratio < 0.76:
                print("SUCCESS: Ratio is ~3:4")
            else:
                print(f"FAILURE: Ratio {ratio:.2f} is not 3:4")
        
        # Also check if 'stretched_3_4_...' file exists in parent dir
        stretched_file = input_path.parent / f"stretched_3_4_{input_path.name}"
        if stretched_file.exists():
             print(f"Verified intermediate file exists: {stretched_file.name}")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await service.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_ozon_mode())
