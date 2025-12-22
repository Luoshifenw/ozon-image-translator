import asyncio
import os
import time
from pathlib import Path
from services.translation import RealTranslationService, TranslationService

# Load environment variables manually to avoid dependency issues
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

async def run_test():
    env = load_env()
    api_key = env.get("APIMART_API_KEY")
    if not api_key:
        print("Error: API Key not found in .env")
        return

    print(f"Initializing Service with Key: {api_key[:5]}...")
    
    service = RealTranslationService(
        api_key=api_key,
        api_endpoint=env.get("APIMART_API_ENDPOINT", "https://api.apimart.ai"),
        prompt=env.get("TRANSLATION_PROMPT", "Translate"),
        storage_mode="local"
    )
    
    # Use the first uploaded image
    input_path = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_1766368336313.jpg")
    output_dir = Path(".").resolve()
    
    print(f"Processing image: {input_path}")
    
    try:
        # Mocking the request_id path structure expectation in translate()
        # The service expects input_path.parent.parent.name to be request_id
        # We'll handle this by temporarily mocking the structure or just calling internal methods if needed
        # But translate() calls _submit_task which does the padding.
        # Let's try calling translate() directly. It assumes constraints on path structure.
        # Actually, translate() uses request_id mainly for logging and temp dirs.
        # But wait, lines 333-334: request_id = input_path.parent.parent.name
        # This will fail if path is not deep enough.
        # Let's construct a fake specific path structure.
        
        test_root = Path("temp/test_req_123/input")
        test_root.mkdir(parents=True, exist_ok=True)
        test_input = test_root / input_path.name
        import shutil
        shutil.copy2(input_path, test_input)
        
        test_output = Path("temp/test_req_123/output")
        test_output.mkdir(parents=True, exist_ok=True)
        
        print("Starting translation...")
        result_path = await service.translate(test_input, test_output)
        
        print(f"Translation successful!")
        print(f"Result saved to: {result_path}")
        
        from PIL import Image
        with Image.open(result_path) as img:
            print(f"Result Image Size: {img.size}")
            print(f"Result Aspect Ratio: {img.width / img.height:.2f}")
            if img.width == img.height:
                print("SUCCESS: Image is 1:1 Square (Padded)")
            else:
                print("WARNING: Image is not square")
                
    except Exception as e:
        print(f"Test failed: {e}")
    finally:
        await service.close()

if __name__ == "__main__":
    # Python 3.8 compat
    loop = asyncio.get_event_loop()
    loop.run_until_complete(run_test())
