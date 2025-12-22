
import json
import uuid
import time
from typing import Optional, Dict, Any
from pathlib import Path

DATA_FILE = Path("data/access_control.json")

class AccessManager:
    def __init__(self):
        self._ensure_data_file()

    def _ensure_data_file(self):
        if not DATA_FILE.exists():
            DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            initial_data = {
                "codes": {
                    "NMGNB": {"total_slots": 25, "used_slots": 0, "quota_per_user": 100},
                    "NMGQCDZSW": {"total_slots": 9999, "used_slots": 0, "quota_per_user": 999999}
                },
                "sessions": {}
            }
            self._save_data(initial_data)

    def _load_data(self) -> Dict[str, Any]:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_data(self, data: Dict[str, Any]):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def verify_code(self, code: str) -> Optional[Dict[str, Any]]:
        """
        验证邀请码，成功则返回 token 和额度信息
        """
        data = self._load_data()
        codes_config = data.get("codes", {})

        if code not in codes_config:
            return None  # 无效码

        config = codes_config[code]
        if config["used_slots"] >= config["total_slots"]:
            return None  # 名额已满

        # 生成新 Session
        token = str(uuid.uuid4())
        
        # 更新 slots
        config["used_slots"] += 1
        
        # 创建 session 记录
        data["sessions"][token] = {
            "created_at": time.time(),
            "usage_count": 0,
            "max_usage": config["quota_per_user"],
            "source_code": code
        }

        self._save_data(data)
        
        return {
            "token": token,
            "remaining_quota": config["quota_per_user"]
        }

    def get_quota(self, token: str) -> Optional[Dict[str, Any]]:
        """
        获取指定 token 的额度信息
        """
        data = self._load_data()
        session = data["sessions"].get(token)
        
        if not session:
            return None

        return {
            "usage": session["usage_count"],
            "limit": session["max_usage"],
            "remaining": session["max_usage"] - session["usage_count"]
        }

    def consume_quota(self, token: str, amount: int = 1) -> bool:
        """
        扣除额度，成功返回 True，不足返回 False
        """
        data = self._load_data()
        session = data["sessions"].get(token)

        if not session:
            return False

        if session["usage_count"] + amount > session["max_usage"]:
            return False

        session["usage_count"] += amount
        self._save_data(data)
        return True

access_manager = AccessManager()
