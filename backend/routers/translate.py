"""
翻译 API 路由
处理批量图片翻译请求
"""

import asyncio
import logging
import random
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from services.file_handler import (
    generate_request_id,
    get_temp_dir,
    save_all_upload_files,
    create_zip_from_directory,
    cleanup_temp_dir,
    TEMP_ROOT,
)
from services.translation import get_translation_service, TranslationService


# 配置日志
logger = logging.getLogger(__name__)


async def delayed_cleanup(request_id: str, delay_seconds: int = 1800):
    """
    延迟清理临时目录
    
    Args:
        request_id: 请求ID
        delay_seconds: 延迟时间（秒），默认30分钟
    """
    await asyncio.sleep(delay_seconds)
    cleanup_temp_dir(request_id)
    logger.info(f"[{request_id}] 已执行延迟清理")


# 响应模型
class TranslatedImage(BaseModel):
    """翻译后的图片信息"""
    original_name: str
    translated_name: str
    file_path: str
    status: str  # success or failed
    error: str = None


class TranslationResponse(BaseModel):
    """批量翻译响应"""
    request_id: str
    total: int
    success: int
    failed: int
    images: List[TranslatedImage]

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api", tags=["翻译"])

# 并发控制：最多同时处理 5 个翻译任务
MAX_CONCURRENT_TASKS = 5
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)


async def process_single_image(
    input_path: Path,
    output_dir: Path,
    service: TranslationService,
    delay: float = 0.0
) -> Path | None:
    """
    处理单张图片（受信号量控制 + 错峰延迟）
    
    Args:
        input_path: 输入图片路径
        output_dir: 输出目录
        service: 翻译服务实例
        delay: 启动延迟（秒），用于错峰发送
        
    Returns:
        成功返回输出路径，失败返回 None
    """
    # 错峰延迟：避免瞬时并发造成网络拥堵
    if delay > 0:
        logger.info(f"[错峰] {input_path.name} 将在 {delay:.1f}秒后开始处理")
        await asyncio.sleep(delay)
    
    async with semaphore:
        try:
            result = await service.translate(input_path, output_dir)
            return result
        except Exception as e:
            logger.error(f"翻译失败 {input_path.name}: {e}", exc_info=True)
            # 返回 None 表示失败，但不中断其他任务
            return None


@router.post("/translate-bulk", response_model=TranslationResponse)
async def translate_bulk(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="要翻译的图片文件列表")
):
    """
    批量翻译图片接口
    
    接收多张图片，并发调用翻译服务，返回翻译结果信息。
    
    - **files**: 图片文件列表 (支持 jpg, png, webp 等格式)
    
    返回: 翻译结果列表 (包含文件路径，用于后续下载)
    """
    # 1. 生成唯一请求 ID 和临时目录
    request_id = generate_request_id()
    input_dir, output_dir = get_temp_dir(request_id)
    
    logger.info(f"[{request_id}] 开始处理批量翻译请求，共 {len(files)} 个文件")
    
    try:
        # 2. 保存上传的文件到临时输入目录
        saved_files = await save_all_upload_files(files, input_dir)
        
        if not saved_files:
            logger.error(f"[{request_id}] 没有成功保存任何文件")
            cleanup_temp_dir(request_id)
            return {"error": "没有有效的文件可处理"}
        
        logger.info(f"[{request_id}] 已保存 {len(saved_files)} 个文件")
        
        # 3. 获取翻译服务并创建并发任务（错峰发送）
        translation_service = get_translation_service()
        
        # 为每个任务分配递增的延迟（1-2秒随机间隔），避免瞬时并发
        tasks = [
            process_single_image(
                file_path, 
                output_dir, 
                translation_service,
                delay=i * random.uniform(1.0, 2.0)  # 每个任务延迟递增
            )
            for i, file_path in enumerate(saved_files)
        ]
        
        logger.info(f"[{request_id}] 已创建 {len(tasks)} 个翻译任务（错峰模式）")
        
        # 4. 并发执行所有翻译任务，记录每个任务的结果
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 5. 构建响应数据
        translated_images = []
        success_count = 0
        fail_count = 0
        
        for i, (result, original_file) in enumerate(zip(results, saved_files)):
            if isinstance(result, Exception) or result is None:
                # 翻译失败
                fail_count += 1
                error_msg = str(result) if isinstance(result, Exception) else "未知错误"
                translated_images.append(TranslatedImage(
                    original_name=original_file.name,
                    translated_name="",
                    file_path="",
                    status="failed",
                    error=error_msg
                ))
            else:
                # 翻译成功
                success_count += 1
                # 生成可访问的文件路径 (相对于 TEMP_ROOT)
                relative_path = f"{request_id}/output/{result.name}"
                translated_images.append(TranslatedImage(
                    original_name=original_file.name,
                    translated_name=result.name,
                    file_path=relative_path,
                    status="success"
                ))
        
        logger.info(f"[{request_id}] 翻译完成: 成功 {success_count}, 失败 {fail_count}")
        
        # 6. 注册后台清理任务（30分钟后清理，给用户时间下载）
        background_tasks.add_task(delayed_cleanup, request_id, 1800)
        
        # 7. 返回翻译结果
        return TranslationResponse(
            request_id=request_id,
            total=len(files),
            success=success_count,
            failed=fail_count,
            images=translated_images
        )
        
    except Exception as e:
        logger.error(f"[{request_id}] 处理过程发生错误: {e}")
        # 确保清理临时文件
        cleanup_temp_dir(request_id)
        raise


@router.get("/download/{file_path:path}")
async def download_file(file_path: str):
    """
    下载单个翻译后的图片
    
    - **file_path**: 文件路径 (格式: request_id/output/filename)
    
    返回: 图片文件
    """
    # 构建完整路径
    full_path = TEMP_ROOT / file_path
    
    # 安全检查：确保路径在 TEMP_ROOT 内
    try:
        full_path = full_path.resolve()
        if not str(full_path).startswith(str(TEMP_ROOT.resolve())):
            logger.warning(f"非法文件访问尝试: {file_path}")
            return {"error": "非法文件路径"}
    except Exception:
        return {"error": "文件路径错误"}
    
    # 检查文件是否存在
    if not full_path.exists() or not full_path.is_file():
        logger.warning(f"文件不存在: {file_path}")
        return {"error": "文件不存在"}
    
    # 返回文件
    return FileResponse(
        path=full_path,
        filename=full_path.name,
        media_type="image/jpeg"
    )

