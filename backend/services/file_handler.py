"""
文件处理服务
负责临时目录管理、文件保存、ZIP打包和清理
"""

import uuid
import shutil
import zipfile
import logging
from pathlib import Path
from typing import List
import aiofiles
from fastapi import UploadFile

# 配置日志
logger = logging.getLogger(__name__)

# 临时文件根目录
TEMP_ROOT = Path("./temp")


def get_temp_dir(request_id: str) -> tuple[Path, Path]:
    """
    为请求创建临时输入和输出目录
    
    Args:
        request_id: 唯一请求标识符
        
    Returns:
        (input_dir, output_dir) 元组
    """
    base_dir = TEMP_ROOT / request_id
    input_dir = base_dir / "input"
    output_dir = base_dir / "output"
    
    # 创建目录
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"已创建临时目录: {base_dir}")
    return input_dir, output_dir


def generate_request_id() -> str:
    """生成唯一请求ID"""
    return str(uuid.uuid4())[:8]


async def save_upload_file(file: UploadFile, dest_dir: Path) -> Path:
    """
    异步保存上传的文件到指定目录
    
    Args:
        file: 上传的文件对象
        dest_dir: 目标目录
        
    Returns:
        保存后的文件路径
    """
    # 确保文件名安全，并添加 UUID 前缀防止同名文件冲突
    original_filename = file.filename or "unnamed"
    # 移除路径中可能的恶意字符
    safe_filename = Path(original_filename).name
    
    # 分离文件名和扩展名
    stem = Path(safe_filename).stem
    suffix = Path(safe_filename).suffix
    
    # 添加 UUID 前缀确保唯一性
    unique_filename = f"{uuid.uuid4().hex[:8]}_{stem}{suffix}"
    dest_path = dest_dir / unique_filename
    
    # 异步写入文件
    async with aiofiles.open(dest_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    logger.info(f"已保存文件: {dest_path}")
    return dest_path


async def save_all_upload_files(files: List[UploadFile], dest_dir: Path) -> List[Path]:
    """
    批量保存所有上传文件
    
    Args:
        files: 上传文件列表
        dest_dir: 目标目录
        
    Returns:
        保存后的文件路径列表
    """
    saved_paths = []
    for file in files:
        try:
            path = await save_upload_file(file, dest_dir)
            saved_paths.append(path)
        except Exception as e:
            logger.error(f"保存文件失败 {file.filename}: {e}")
            # 继续处理其他文件，不中断整个流程
            continue
    return saved_paths


def create_zip_from_directory(source_dir: Path, zip_path: Path) -> Path:
    """
    将目录中的所有文件打包成ZIP
    
    Args:
        source_dir: 源目录
        zip_path: ZIP文件输出路径
        
    Returns:
        ZIP文件路径
    """
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in source_dir.iterdir():
            if file_path.is_file():
                # 只保留文件名，不包含路径
                zipf.write(file_path, file_path.name)
                logger.info(f"已添加到ZIP: {file_path.name}")
    
    logger.info(f"ZIP文件已创建: {zip_path}")
    return zip_path


def cleanup_temp_dir(request_id: str) -> None:
    """
    清理指定请求的临时目录
    
    Args:
        request_id: 请求ID
    """
    temp_dir = TEMP_ROOT / request_id
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
        logger.info(f"已清理临时目录: {temp_dir}")


def ensure_temp_root_exists() -> None:
    """确保临时根目录存在"""
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)

