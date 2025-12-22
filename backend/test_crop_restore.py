import asyncio
import shutil
from pathlib import Path
from services.translation import RealTranslationService

# Mock service to access _restore_ratio
service = RealTranslationService("mock", "mock", "mock")

async def test_restore():
    # Case 1: Wide Image (Padded Height)
    # Original: 1024x869 (~1.18)
    # Padded Result: 1024x1024 (1:1)
    orig_1 = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_1_1766327366408.png")
    padded_1_src = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/padding_test_result.jpg") 
    
    # Copy padded so we don't modify the artifact
    padded_1 = Path("temp_restore_test_1.jpg")
    shutil.copy2(padded_1_src, padded_1)
    
    print(f"Testing Case 1 (Height Padding Reversal)...")
    service._restore_ratio(orig_1, padded_1)
    
    from PIL import Image
    with Image.open(padded_1) as img:
        print(f"Restored Size: {img.size}")
        expected_w = 1024
        # Expected H = 1024 / (1024/869) = 869? 
        # API result is 1024, Orig is 1024. 
        # Actually trans_w (1024) / orig_ratio (1.178) = 869
        print(f"Ratio: {img.width/img.height:.3f} (Original: {1024/869:.3f})")

    # Case 2: Tall Image (Padded Width)
    # Original: 457x1024 (0.446)
    # Padded Result: 1024x1536 (2:3 = 0.666)
    orig_2 = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/uploaded_image_1766363668997.jpg")
    padded_2_src = Path("/Users/dearjean/.gemini/antigravity/brain/2988e298-af7d-4f5d-b6a9-3664663945e0/user_test_result_2_3.jpg")
    
    padded_2 = Path("temp_restore_test_2.jpg")
    shutil.copy2(padded_2_src, padded_2)
    
    print(f"\nTesting Case 2 (Width Padding Reversal)...")
    service._restore_ratio(orig_2, padded_2)
    
    with Image.open(padded_2) as img:
        print(f"Restored Size: {img.size}")
        # Trans H = 1536.
        # Valid W = 1536 * (457/1024) = 685.5 -> 685
        print(f"Ratio: {img.width/img.height:.3f} (Original: {457/1024:.3f})")

if __name__ == "__main__":
    asyncio.run(test_restore())
