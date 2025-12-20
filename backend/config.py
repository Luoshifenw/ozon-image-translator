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
    SERVICE_MODE: str = os.getenv("SERVICE_MODE", "mock")  # mock 或 real
    
    # 任务轮询配置
    POLL_INTERVAL: float = 3.0  # 轮询间隔（秒）
    POLL_MAX_ATTEMPTS: int = 100  # 最大轮询次数（3秒*100=5分钟超时）


settings = Settings()

