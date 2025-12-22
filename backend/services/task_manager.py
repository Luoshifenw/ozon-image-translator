"""
任务状态管理
用于存储和查询异步翻译任务的状态
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel
import asyncio
from loguru import logger

# 任务状态目录
TASK_STATUS_DIR = Path("temp/task_status")


class TaskStatus(BaseModel):
    """任务状态模型"""
    task_id: str
    status: str  # pending, processing, completed, failed
    total: int
    processed: int
    success: int
    failed: int
    images: List[Dict] = []
    error: Optional[str] = None


def ensure_task_status_dir():
    """确保任务状态目录存在"""
    TASK_STATUS_DIR.mkdir(parents=True, exist_ok=True)


def get_task_status_file(task_id: str) -> Path:
    """获取任务状态文件路径"""
    return TASK_STATUS_DIR / f"{task_id}.json"


async def save_task_status(status: TaskStatus):
    """保存任务状态"""
    ensure_task_status_dir()
    status_file = get_task_status_file(status.task_id)
    
    async with asyncio.Lock():
        with open(status_file, 'w', encoding='utf-8') as f:
            json.dump(status.dict(), f, ensure_ascii=False, indent=2)
    
    logger.info(f"[{status.task_id}] 状态已保存: {status.status} ({status.processed}/{status.total})")


async def load_task_status(task_id: str) -> Optional[TaskStatus]:
    """加载任务状态"""
    status_file = get_task_status_file(task_id)
    
    if not status_file.exists():
        return None
    
    try:
        with open(status_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return TaskStatus(**data)
    except Exception as e:
        logger.error(f"加载任务状态失败 {task_id}: {e}")
        return None


async def delete_task_status(task_id: str):
    """删除任务状态文件"""
    status_file = get_task_status_file(task_id)
    
    if status_file.exists():
        status_file.unlink()
        logger.info(f"[{task_id}] 状态文件已删除")





