"""
配置管理模块
从环境变量加载配置
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)


class Settings:
    """应用配置"""
    
    # APIMart API 配置
    APIMART_API_KEY: str = os.getenv("APIMART_API_KEY", "")
    APIMART_API_ENDPOINT: str = os.getenv("APIMART_API_ENDPOINT", "https://api.apimart.ai")
    
    # 翻译配置
    TRANSLATION_PROMPT: str = os.getenv(
        "TRANSLATION_PROMPT",
        "将图片中的文字替换为俄语"
    )
    TRANSLATION_CONCURRENCY: int = int(os.getenv("TRANSLATION_CONCURRENCY", "5"))
    
    # 服务模式
    SERVICE_MODE: str = os.getenv("SERVICE_MODE", "real")  # mock 或 real
    
    # 存储模式配置
    STORAGE_MODE: str = os.getenv("STORAGE_MODE", "local")  # local 或 cloud
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")  # 服务器公网地址
    
    # 任务轮询配置
    POLL_INTERVAL: float = float(os.getenv("POLL_INTERVAL", "3"))  # 轮询间隔（秒）
    POLL_MAX_ATTEMPTS: int = int(os.getenv("POLL_MAX_ATTEMPTS", "100"))  # 最大轮询次数


settings = Settings()

