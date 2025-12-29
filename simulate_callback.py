import sys
import os
sys.path.append(os.path.abspath("backend"))

from routers.payments import _build_sign
from config import settings

# Connect to DB
conn = sqlite3.connect('backend/data/app.db')
cursor = conn.cursor()

# Get latest pending order
cursor.execute("SELECT out_trade_no, amount, package_id FROM 'order' WHERE status='pending' ORDER BY id DESC LIMIT 1")
row = cursor.fetchone()

if row:
    out_trade_no, amount, package_id = row
    print(f"Found pending order: {out_trade_no} for {amount}")
    
    # Construct Mock Callback Payload
    params = {
        "pid": "2025121822155819",
        "trade_no": "mock_zpay_trade_no_123",
        "out_trade_no": out_trade_no,
        "type": "alipay",
        "name": f"入门版 100积分", # Matches what we sent
        "money": f"{amount:.2f}",
        "trade_status": "TRADE_SUCCESS"
    }
    
    # Calculate Signature using the SAME function as the backend
    # This ensures our manual test is valid
    sign = _build_sign(params)
    params["sign"] = sign
    params["sign_type"] = "MD5"
    
    print("\nGenerated Callback Params:")
    for k, v in params.items():
        print(f"{k}: {v}")

    import requests
    try:
        resp = requests.post("http://localhost:8000/api/payments/notify", data=params)
        print(f"\nCallback Response: {resp.text}")
        print(f"Status Code: {resp.status_code}")
    except Exception as e:
        print(f"Error sending callback: {e}")

else:
    print("No pending orders found.")

conn.close()
