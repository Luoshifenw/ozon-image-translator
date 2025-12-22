import asyncio
from pathlib import Path
from services.translation import get_translation_service, RealTranslationService

# Mock settings for test
class Settings:
    APIMART_API_KEY = "sk-mock"
    APIMART_API_ENDPOINT = "https://mock.api"
    TRANSLATION_PROMPT = "test"
    POLL_INTERVAL = 1
    POLL_MAX_ATTEMPTS = 5
    STORAGE_MODE = "local"
    BASE_URL = ""

service = RealTranslationService(
    api_key="sk-mock",
    api_endpoint="https://mock.api",
    prompt="test"
)

import concurrent.futures

async def test_padding():
    input_path = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_0_1766327366408.jpg")
    if not input_path.exists():
        print("Image not found")
        return

    print(f"Testing padding for: {input_path}")
    
    # Mock to_thread for Python 3.8 compatibility if needed
    if not hasattr(asyncio, 'to_thread'):
        import contextvars
        import functools
        async def to_thread(func, *args, **kwargs):
            loop = asyncio.get_running_loop()
            ctx = contextvars.copy_context()
            func_call = functools.partial(ctx.run, func, *args, **kwargs)
            return await loop.run_in_executor(None, func_call)
        asyncio.to_thread = to_thread

    # Test ratio calculation
    best_ratio = await service._get_best_fit_ratio(input_path)
    print(f"Calculated Best Ratio: {best_ratio}")
    
    # Test padding execution
    padded_path = await service._pad_image_to_ratio(input_path, best_ratio)
    print(f"Padded Image Saved to: {padded_path}")

    # Verify size
    from PIL import Image
    img = Image.open(padded_path)
    print(f"Padded Size: {img.size} (Ratio: {img.width/img.height:.2f})")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_padding())
