"""
图片翻译服务 - FastAPI 主入口
为 Ozon 跨境电商卖家提供批量图片翻译功能
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import translate, auth, payments, admin
from services.file_handler import ensure_temp_root_exists
from services.db import init_db

# 配置日志格式
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("🚀 图片翻译服务启动中...")
    ensure_temp_root_exists()
    init_db()
    logger.info("✅ 临时目录已就绪")
    
    yield
    
    # 关闭时执行
    logger.info("👋 图片翻译服务正在关闭...")


# 创建 FastAPI 应用
app = FastAPI(
    title="图片翻译服务",
    description="为 Ozon 跨境电商卖家提供批量图片翻译功能",
    version="0.0.2",
    lifespan=lifespan
)

# 配置 CORS - 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 开发服务器
        "http://localhost:3000",  # 备用端口
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(translate.router)
app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "service": "图片翻译服务",
        "version": "0.0.2",
        "status": "运行中"
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # 开发模式启用热重载
    )
