"""
翻译 API 路由
处理批量图片翻译请求
"""

import asyncio
import logging
import random
import json
import time
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Form, Depends
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
from services.task_manager import (
    TaskStatus,
    save_task_status,
    load_task_status,
    delete_task_status,
    ensure_task_status_dir
)
from sqlmodel import Session

from models.db_models import User
from routers.auth import get_current_user
from services.db import get_session

# #region agent log
# Debug logging helper
def log_debug(location, message, data=None, hypothesis_id=None):
    """Write debug log to NDJSON file"""
    try:
        with open('/Users/dearjean/Desktop/CursorProject/ImageTranslator_v0.0.2/.cursor/debug.log', 'a') as f:
            log_entry = {
                'timestamp': int(time.time() * 1000),
                'location': location,
                'message': message,
                'data': data or {},
                'sessionId': 'debug-session',
                'hypothesisId': hypothesis_id
            }
            f.write(json.dumps(log_entry) + '\n')
    except:
        pass
# #endregion


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

# 并发控制：最多同时处理 20 个翻译任务
MAX_CONCURRENT_TASKS = 20
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)


async def process_single_image(
    input_path: Path,
    output_dir: Path,
    service: TranslationService,
    delay: float = 0.0,
    target_mode: str = "original"
) -> Path | None:
    """
    处理单张图片（受信号量控制 + 错峰延迟）
    
    Args:
        input_path: 输入图片路径
        output_dir: 输出目录
        service: 翻译服务实例
        delay: 启动延迟（秒），用于错峰发送
        target_mode: 输出模式
        
    Returns:
        成功返回输出路径，失败返回 None
    """
    # 错峰延迟：避免瞬时并发造成网络拥堵
    if delay > 0:
        logger.info(f"[错峰] {input_path.name} 将在 {delay:.1f}秒后开始处理")
        await asyncio.sleep(delay)
    
    async with semaphore:
        try:
            result = await service.translate(input_path, output_dir, target_mode=target_mode)
            return result
        except Exception as e:
            logger.error(f"翻译失败 {input_path.name}: {e}", exc_info=True)
            # 返回 Exception 以便上层获取错误信息
            return e


@router.post("/translate-bulk", response_model=TranslationResponse)
async def translate_bulk(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="要翻译的图片文件列表"),
    target_mode: str = Form("original", description="输出模式：original 或 ozon_3_4"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    批量翻译图片接口
    
    接收多张图片，并发调用翻译服务，返回翻译结果信息。
    
    - **files**: 图片文件列表 (支持 jpg, png, webp 等格式)
    
    返回: 翻译结果列表 (包含文件路径，用于后续下载)
    """
    # #region agent log
    start_time = time.time()
    log_debug('translate.py:140', 'Request received', {'file_count': len(files), 'start_time': start_time}, 'H4')
    # #endregion
    
    # 1. 生成唯一请求 ID 和临时目录
    request_id = generate_request_id()
    input_dir, output_dir = get_temp_dir(request_id)
    
    # #region agent log
    log_debug('translate.py:148', 'Request ID generated', {'request_id': request_id, 'elapsed': time.time() - start_time}, 'H4')
    # #endregion
    
    logger.info(f"[{request_id}] 开始处理批量翻译请求，共 {len(files)} 个文件")
    
    # 检查并扣除积分
    if user.credits < len(files):
        raise HTTPException(status_code=403, detail="积分不足 (Insufficient credits)")
    user.credits -= len(files)
    session.add(user)
    session.commit()

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
                delay=i * random.uniform(1.0, 2.0),  # 每个任务延迟递增
                target_mode=target_mode
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
        
        # #region agent log
        end_time = time.time()
        total_elapsed = end_time - start_time
        log_debug('translate.py:218', 'Translation completed', {
            'request_id': request_id,
            'total_elapsed': total_elapsed,
            'success_count': success_count,
            'fail_count': fail_count,
            'about_to_return': True
        }, 'H4')
        # #endregion
        
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


@router.get("/temp-images/{request_id}/{filename}")
async def serve_temp_image(request_id: str, filename: str):
    """
    提供临时上传图片的公网访问（供 APIMart 在云端模式下下载）
    
    - **request_id**: 请求ID
    - **filename**: 文件名
    
    返回: 原始上传的图片文件
    
    注意：此端点仅在云端部署时使用，本地开发使用 Base64
    """
    # 构建输入文件路径
    file_path = TEMP_ROOT / request_id / "input" / filename
    
    # 安全检查：确保路径在 TEMP_ROOT 内
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(TEMP_ROOT.resolve())):
            logger.warning(f"非法文件访问尝试: {request_id}/{filename}")
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="非法文件路径")
    except Exception as e:
        from fastapi import HTTPException
        logger.error(f"文件路径解析错误: {e}")
        raise HTTPException(status_code=400, detail="文件路径错误")
    
    # 检查文件是否存在
    if not file_path.exists() or not file_path.is_file():
        logger.warning(f"文件不存在: {request_id}/{filename}")
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 返回文件（自动检测 MIME 类型）
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="image/*"
    )


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
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="非法文件路径")
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="文件路径错误")
    
    # 检查文件是否存在
    if not full_path.exists() or not full_path.is_file():
        logger.warning(f"文件不存在: {file_path}")
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 返回文件
    return FileResponse(
        path=full_path,
        filename=full_path.name,
        media_type="image/jpeg"
    )


# ============================================
# 异步翻译接口（新增）
# ============================================

class AsyncTranslationSubmitResponse(BaseModel):
    """异步翻译提交响应"""
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str  # pending, processing, completed, failed
    total: int
    processed: int
    success: int
    failed: int
    images: List[TranslatedImage] = []
    error: Optional[str] = None


async def background_translate_task(
    task_id: str,
    saved_files: List[Path],
    output_dir: Path,
    target_mode: str = "original"
):
    """
    后台翻译任务
    
    Args:
        task_id: 任务ID
        saved_files: 已保存的文件列表
        output_dir: 输出目录
        target_mode: 输出模式
    """
    from config import settings
    
    try:
        # 初始化任务状态
        task_status = TaskStatus(
            task_id=task_id,
            status="processing",
            total=len(saved_files),
            processed=0,
            success=0,
            failed=0,
            images=[]
        )
        await save_task_status(task_status)
        
        logger.info(f"[{task_id}] 后台翻译任务开始")
        
        # 获取翻译服务
        translation_service = get_translation_service()
        
        # 为每个任务分配递增的延迟
        tasks = [
            process_single_image(
                file_path,
                output_dir,
                translation_service,
                delay=i * random.uniform(1.0, 2.0),
                target_mode=target_mode
            )
            for i, file_path in enumerate(saved_files)
        ]
        
        # 执行翻译
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 构建结果
        translated_images = []
        success_count = 0
        fail_count = 0
        
        for result, original_file in zip(results, saved_files):
            if isinstance(result, Exception) or result is None:
                fail_count += 1
                error_msg = str(result) if isinstance(result, Exception) else "未知错误"
                translated_images.append({
                    "original_name": original_file.name,
                    "translated_name": "",
                    "file_path": "",
                    "status": "failed",
                    "error": error_msg
                })
            else:
                success_count += 1
                relative_path = f"{task_id}/output/{result.name}"
                translated_images.append({
                    "original_name": original_file.name,
                    "translated_name": result.name,
                    "file_path": relative_path,
                    "status": "success"
                })
        
        # 更新任务状态为完成
        task_status.status = "completed"
        task_status.processed = len(saved_files)
        task_status.success = success_count
        task_status.failed = fail_count
        task_status.images = translated_images
        await save_task_status(task_status)
        
        logger.info(f"[{task_id}] 后台翻译任务完成: 成功 {success_count}, 失败 {fail_count}")
        
        # 30分钟后清理
        await asyncio.sleep(1800)
        cleanup_temp_dir(task_id)
        await delete_task_status(task_id)
        
    except Exception as e:
        logger.error(f"[{task_id}] 后台翻译任务失败: {e}", exc_info=True)
        # 更新任务状态为失败
        task_status = TaskStatus(
            task_id=task_id,
            status="failed",
            total=len(saved_files),
            processed=0,
            success=0,
            failed=len(saved_files),
            images=[],
            error=str(e)
        )
        await save_task_status(task_status)


@router.post("/translate-bulk-async", response_model=AsyncTranslationSubmitResponse)
async def translate_bulk_async(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="要翻译的图片文件列表"),
    target_mode: str = Form("original", description="输出模式"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    批量翻译图片接口（异步版本）
    
    立即返回任务ID，翻译在后台进行
    前端通过轮询 /api/task-status/{task_id} 获取进度
    
    - **files**: 图片文件列表 (支持 jpg, png, webp 等格式)
    
    返回: 任务ID和状态
    """
    # 确保任务状态目录存在
    ensure_task_status_dir()
    
    # 生成任务ID
    task_id = generate_request_id()
    input_dir, output_dir = get_temp_dir(task_id)
    
    logger.info(f"[{task_id}] 接收异步翻译请求，共 {len(files)} 个文件")

    # 检查并扣除积分
    if user.credits < len(files):
        raise HTTPException(status_code=403, detail="积分不足 (Insufficient credits)")
    user.credits -= len(files)
    session.add(user)
    session.commit()
    
    try:
        # 保存上传的文件
        saved_files = await save_all_upload_files(files, input_dir)
        
        if not saved_files:
            logger.error(f"[{task_id}] 没有成功保存任何文件")
            cleanup_temp_dir(task_id)
            raise HTTPException(status_code=400, detail="没有有效的文件可处理")
        
        logger.info(f"[{task_id}] 已保存 {len(saved_files)} 个文件")
        
        # 初始化任务状态为 pending
        initial_status = TaskStatus(
            task_id=task_id,
            status="pending",
            total=len(saved_files),
            processed=0,
            success=0,
            failed=0,
            images=[]
        )
        await save_task_status(initial_status)
        
        # 将翻译任务添加到后台
        background_tasks.add_task(background_translate_task, task_id, saved_files, output_dir, target_mode)
        
        logger.info(f"[{task_id}] 翻译任务已提交到后台队列")
        
        return AsyncTranslationSubmitResponse(
            task_id=task_id,
            status="pending",
            message=f"翻译任务已提交，共 {len(saved_files)} 个文件"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{task_id}] 提交翻译任务失败: {e}", exc_info=True)
        cleanup_temp_dir(task_id)
        raise HTTPException(status_code=500, detail=f"提交任务失败: {str(e)}")


@router.get("/task-status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    查询任务状态
    
    - **task_id**: 任务ID
    
    返回: 任务状态和进度
    """
    status = await load_task_status(task_id)
    
    if not status:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 转换为响应模型
    images = [TranslatedImage(**img) for img in status.images]
    
    return TaskStatusResponse(
        task_id=status.task_id,
        status=status.status,
        total=status.total,
        processed=status.processed,
        success=status.success,
        failed=status.failed,
        images=images,
        error=status.error
    )
