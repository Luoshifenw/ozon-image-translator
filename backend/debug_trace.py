from fastapi.testclient import TestClient
from main import app
import os

# Ensure we are in backend dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

client = TestClient(app)

def test_trace():
    print("Testing /api/translate-bulk-async...")
    
    # Mock file upload
    files = [
        ('files', ('test.jpg', b'fake content', 'image/jpeg'))
    ]
    
    # Mock data
    data = {
        'target_mode': 'ozon_3_4'
    }
    
    try:
        response = client.post("/api/translate-bulk-async", files=files, data=data)
        print(f"Status Code: {response.status_code}")
        if response.status_code != 200:
            print("Response:", response.text)
    except Exception as e:
        print("Exception caught by TestClient or during import:")
        # TestClient should let exceptions propagate if raise_server_exceptions=True (default) 
        # but sometimes handled by exception handlers.
        # However, import errors would happen at 'from main import app'
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_trace()
