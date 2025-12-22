import asyncio
from pathlib import Path

# Mock the TranslationService to test only the logic
class MockService:
    SUPPORTED_RATIOS = {
        "1:1": 1.0,
        "2:3": 2/3,
        "3:2": 3/2,
    }
    
    def _get_best_fit_ratio_sync(self, width, height):
        aspect = width / height
        best_ratio = "1:1"
        min_padding_area = float("inf")
        
        for ratio_str, ratio_val in self.SUPPORTED_RATIOS.items():
            if aspect > ratio_val:
                # Image is wider than target
                # Fix width, increase height
                # target_height = width / ratio_val
                # padding = width * (target_height - height)
                padding_area = width * (width / ratio_val - height)
            else:
                # Image is taller than target
                # Fix height, increase width
                # target_width = height * ratio_val
                # padding = height * (target_width - width)
                padding_area = height * (height * ratio_val - width)
            
            if padding_area < min_padding_area:
                min_padding_area = padding_area
                best_ratio = ratio_str
                
        return best_ratio

service = MockService()

test_cases = [
    (1024, 1024, "1:1 Square"),
    (800, 1000, "3:4 Tall (Standard Photo)"),
    (1000, 800, "4:3 Wide (Standard Photo)"),
    (1080, 1920, "9:16 Tall (Mobile)"),
    (1920, 1080, "16:9 Wide (Desktop)"),
    (1000, 2000, "1:2 Tall"),
    (2000, 1000, "2:1 Wide"),
]

print(f"{'Dimensions':<15} | {'Description':<25} | {'Aspect':<6} | {'Selected Ratio'}")
print("-" * 65)

for w, h, desc in test_cases:
    aspect = w / h
    choice = service._get_best_fit_ratio_sync(w, h)
    print(f"{w}x{h:<9} | {desc:<25} | {aspect:.2f}   | {choice}")
