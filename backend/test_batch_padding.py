import asyncio
import shutil
from pathlib import Path
from services.translation import RealTranslationService

# Load environment variables manually
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

async def run_batch_test():
    env = load_env()
    api_key = env.get("APIMART_API_KEY")
    if not api_key:
        print("Error: API Key not found")
        return

    service = RealTranslationService(
        api_key=api_key,
        api_endpoint=env.get("APIMART_API_ENDPOINT", "https://api.apimart.ai"),
        prompt="Translate",
        storage_mode="local"
    )

    test_images = [
        Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_0_1766363946865.jpg"),
        Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_1_1766363946865.jpg")
    ]

    for i, input_path in enumerate(test_images):
        print(f"\n--- Processing Image {i}: {input_path.name} ---")
        
        # Setup temp paths
        req_id = f"batch_test_{i}"
        test_root = Path(f"temp/{req_id}/input")
        test_root.mkdir(parents=True, exist_ok=True)
        test_input = test_root / input_path.name
        shutil.copy2(input_path, test_input)
        
        test_output = Path(f"temp/{req_id}/output")
        test_output.mkdir(parents=True, exist_ok=True)
        
        try:
            result_path = await service.translate(test_input, test_output)
            print(f"Success! Saved to: {result_path}")
            
            # Check dimensions
            from PIL import Image
            with Image.open(result_path) as img:
                print(f"Result Size: {img.size}")
                print(f"Result Ratio: {img.width/img.height:.2f}")
                
            # Copy to artifacts for review
            artifact_name = f"user_batch_result_{i}.jpg"
            artifact_path = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0") / artifact_name
            shutil.copy2(result_path, artifact_path)
            print(f"Copied to artifact: {artifact_name}")
            
        except Exception as e:
            print(f"Failed processing {input_path.name}")
            print(f"Error type: {type(e)}")
            print(f"Error repr: {repr(e)}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(run_batch_test())
