"""
翻译服务模块
提供图片翻译服务的抽象接口和具体实现
"""

import asyncio
import random
import shutil
import base64
import logging
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Tuple
import httpx
from PIL import Image

# 配置日志
logger = logging.getLogger(__name__)


class TranslationService(ABC):
    """翻译服务抽象基类"""
    
    @abstractmethod
    async def translate(self, input_path: Path, output_dir: Path) -> Path:
        """
        翻译单张图片
        
        Args:
            input_path: 输入图片路径
            output_dir: 输出目录
            
        Returns:
            翻译后的图片路径
            
        Raises:
            TranslationError: 翻译失败时抛出
        """
        pass


class TranslationError(Exception):
    """翻译服务异常"""
    pass


class MockTranslationService(TranslationService):
    """
    Mock 翻译服务
    模拟真实翻译API的行为，用于开发和测试
    """
    
    def __init__(self, min_delay: float = 1.0, max_delay: float = 2.0):
        """
        初始化 Mock 服务
        
        Args:
            min_delay: 最小模拟延迟(秒)
            max_delay: 最大模拟延迟(秒)
        """
        self.min_delay = min_delay
        self.max_delay = max_delay
        logger.info("MockTranslationService 已初始化")
    
    async def translate(self, input_path: Path, output_dir: Path) -> Path:
        """
        模拟翻译图片
        
        实现逻辑:
        1. 随机延迟 1-2 秒模拟 API 调用
        2. 将原图复制到输出目录，添加 translated_ 前缀
        """
        # 模拟 API 调用延迟
        delay = random.uniform(self.min_delay, self.max_delay)
        logger.info(f"开始处理 {input_path.name}，模拟延迟 {delay:.2f}s")
        await asyncio.sleep(delay)
        
        # 生成输出文件名: translated_原文件名
        output_filename = f"translated_{input_path.name}"
        output_path = output_dir / output_filename
        
        # 复制文件（模拟翻译结果）
        shutil.copy2(input_path, output_path)
        
        logger.info(f"处理完成: {input_path.name} -> {output_filename}")
        return output_path


class RealTranslationService(TranslationService):
    """
    真实翻译服务
    对接 APIMart GPT-4o-image API
    文档: https://docs.apimart.ai/en/api-reference/images/gpt-4o/generation
    """
    
    # 常用宽高比列表（宽, 高）
    COMMON_RATIOS: Tuple[Tuple[int, int], ...] = (
        (1, 1),
        (4, 3),
        (3, 4),
        (16, 9),
        (9, 16),
        (3, 2),
        (2, 3),
        (5, 4),
        (4, 5),
    )
    
    def __init__(self, api_key: str, api_endpoint: str, prompt: str,
                 poll_interval: float = 2.0, poll_max_attempts: int = 60,
                 storage_mode: str = "local", base_url: str = "http://localhost:8000"):
        """
        初始化真实翻译服务
        
        Args:
            api_key: APIMart API 密钥
            api_endpoint: API 端点地址
            prompt: 翻译提示词
            poll_interval: 轮询间隔（秒）
            poll_max_attempts: 最大轮询次数
            storage_mode: 存储模式 (local: Base64, cloud: URL)
            base_url: 服务器公网地址（cloud 模式使用）
        """
        self.api_key = api_key
        self.api_endpoint = api_endpoint
        self.prompt = prompt
        self.poll_interval = poll_interval
        self.poll_max_attempts = poll_max_attempts
        self.storage_mode = storage_mode
        self.base_url = base_url
        
        # 创建 HTTP 客户端
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        logger.info("RealTranslationService 已初始化")
    
    async def _image_to_base64_url(self, image_path: Path) -> str:
        """
        将图片转换为 base64 数据 URL（异步版本）
        使用异步 I/O 和线程池避免阻塞事件循环
        """
        # 使用 asyncio.to_thread 在线程池中执行同步读取和编码
        def _sync_encode():
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            # 检测图片类型
            suffix = image_path.suffix.lower()
            mime_types = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp"
            }
            mime_type = mime_types.get(suffix, "image/jpeg")
            
            # 转换为 base64
            base64_data = base64.b64encode(image_data).decode("utf-8")
            
            # 记录数据大小
            original_size = len(image_data) / (1024 * 1024)  # MB
            encoded_size = len(base64_data) / (1024 * 1024)  # MB
            logger.info(f"图片编码: {image_path.name}, 原始: {original_size:.2f}MB, Base64: {encoded_size:.2f}MB")
            
            return f"data:{mime_type};base64,{base64_data}"
        
        # 在线程池中执行，避免阻塞主事件循环
        return await asyncio.to_thread(_sync_encode)
    
    async def _get_nearest_size(self, image_path: Path) -> str:
        """
        计算与原图最接近的常用宽高比，返回形如 "4:3" 的字符串
        """
        def _compute() -> str:
            try:
                with Image.open(image_path) as img:
                    width, height = img.size
            except Exception as e:
                logger.warning(f"读取图片尺寸失败，使用默认 1:1: {e}")
                return "1:1"
            
            if width <= 0 or height <= 0:
                logger.warning("图片尺寸异常，使用默认 1:1")
                return "1:1"
            
            aspect = width / height
            best_ratio = "1:1"
            best_diff = float("inf")
            best_pair = (1, 1)
            
            for w, h in self.COMMON_RATIOS:
                diff = abs(aspect - (w / h))
                if diff < best_diff:
                    best_diff = diff
                    best_ratio = f"{w}:{h}"
                    best_pair = (w, h)
            
            logger.info(
                f"原图尺寸 {width}x{height}, 实际比例 {aspect:.4f}, "
                f"匹配比例 {best_ratio} (参考 {best_pair[0]}:{best_pair[1]})"
            )
            return best_ratio
        
        return await asyncio.to_thread(_compute)
    
    async def _submit_task(self, image_path: Path, request_id: str) -> str:
        """
        提交翻译任务
        
        Args:
            image_path: 输入图片路径
            request_id: 请求ID（用于构建 URL）
        
        Returns:
            task_id
        """
        start_time = time.time()
        
        # 根据存储模式决定使用 Base64 还是 URL
        if self.storage_mode == "cloud":
            # 云端模式：构建公网可访问的 URL
            filename = image_path.name
            image_url = f"{self.base_url}/api/temp-images/{request_id}/{filename}"
            logger.info(f"使用 URL 模式: {image_url}")
            prepare_time = time.time() - start_time
            logger.info(f"URL 准备耗时: {prepare_time:.3f}秒")
        else:
            # 本地模式：使用 Base64 编码
            image_url = await self._image_to_base64_url(image_path)
            encode_time = time.time() - start_time
            logger.info(f"Base64 编码耗时: {encode_time:.2f}秒")
        
        # 计算与原图最接近的常用比例，避免强制 1:1 造成拉伸
        size_ratio = await self._get_nearest_size(image_path)
        
        # 构建请求
        payload = {
            "model": "gpt-4o-image",
            "prompt": self.prompt,
            "size": size_ratio,
            "n": 1,
            "image_urls": [image_url]
        }
        
        # 发送请求
        url = f"{self.api_endpoint}/v1/images/generations"
        logger.info(f"提交翻译任务: {image_path.name} (模式: {self.storage_mode})")
        logger.info(f"Prompt: {self.prompt}")
        
        submit_start = time.time()
        response = await self.client.post(url, json=payload)
        submit_time = time.time() - submit_start
        response.raise_for_status()
        
        logger.info(f"API 响应耗时: {submit_time:.2f}秒")
        
        result = response.json()
        logger.info(f"提交响应: {result}")
        
        if result.get("code") != 200:
            raise TranslationError(f"API 返回错误: {result}")
        
        task_id = result["data"][0]["task_id"]
        logger.info(f"任务已提交: {image_path.name} -> task_id={task_id}")
        return task_id
    
    async def _poll_task_status(self, task_id: str) -> dict:
        """
        轮询任务状态直到完成
        
        Returns:
            完成的任务结果
        """
        # 根据 API 文档，正确的 URL 是 /v1/tasks/{task_id}
        url = f"{self.api_endpoint}/v1/tasks/{task_id}"
        
        for attempt in range(self.poll_max_attempts):
            await asyncio.sleep(self.poll_interval)
            
            response = await self.client.get(url)
            response.raise_for_status()
            
            result = response.json()
            
            # API 响应结构: {"code": 200, "data": {"status": "...", "progress": ..., ...}}
            if result.get("code") != 200:
                raise TranslationError(f"API 返回错误代码: {result}")
            
            data = result.get("data", {})
            status = data.get("status", "")
            progress = data.get("progress", 0)
            
            logger.info(f"任务 {task_id} 状态: {status}, 进度: {progress}% (第 {attempt + 1} 次查询)")
            
            if status == "completed":
                logger.info(f"任务完成: {task_id}")
                return data  # 返回 data 而不是整个 result
            elif status == "failed":
                error_info = data.get("error", {})
                error_msg = error_info.get("message", "未知错误")
                raise TranslationError(f"任务失败: {error_msg}")
            # 其他状态继续轮询 (pending, processing)
        
        raise TranslationError(f"任务超时: {task_id}")
    
    async def _download_image(self, image_url: str, output_path: Path) -> Path:
        """下载图片到指定路径"""
        response = await self.client.get(image_url)
        response.raise_for_status()
        
        with open(output_path, "wb") as f:
            f.write(response.content)
        
        logger.info(f"图片已下载: {output_path}")
        return output_path
    
    async def translate(self, input_path: Path, output_dir: Path) -> Path:
        """
        翻译图片
        
        流程:
        1. 将图片转换为 base64/URL 并提交任务
        2. 轮询等待任务完成
        3. 下载翻译后的图片
        """
        try:
            # 从路径提取 request_id (temp/request_id/input/filename)
            request_id = input_path.parent.parent.name
            
            # 1. 提交任务
            task_id = await self._submit_task(input_path, request_id)
            
            # 2. 轮询等待完成
            result = await self._poll_task_status(task_id)
            
            # 3. 获取结果图片 URL
            # 根据 API 文档，图片在 data.result.images 中
            result_field = result.get("result", {})
            images = result_field.get("images", [])
            if not images:
                raise TranslationError("API 未返回图片")
            
            # images 可能是字符串列表或对象列表
            first_image = images[0]
            if isinstance(first_image, str):
                image_url = first_image
            elif isinstance(first_image, dict):
                url_field = first_image.get("url")
                # url 字段可能是字符串或列表
                if isinstance(url_field, list):
                    image_url = url_field[0] if url_field else None
                else:
                    image_url = url_field
            else:
                raise TranslationError(f"未知的图片格式: {type(first_image)}")
            
            if not image_url:
                raise TranslationError("API 返回的图片 URL 为空")
            
            logger.info(f"准备下载图片: {image_url}")
            
            # 4. 下载图片
            output_filename = f"translated_{input_path.name}"
            output_path = output_dir / output_filename
            await self._download_image(image_url, output_path)
            
            return output_path
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 错误: {e.response.status_code} - {e.response.text}")
            raise TranslationError(f"API 请求失败: {e.response.status_code}")
        except Exception as e:
            logger.error(f"翻译失败 {input_path.name}: {e}")
            raise TranslationError(str(e))
    
    async def close(self):
        """关闭 HTTP 客户端"""
        await self.client.aclose()


def get_translation_service() -> TranslationService:
    """
    获取翻译服务实例
    根据配置切换 Mock 或 Real 服务
    """
    from config import settings
    
    if settings.SERVICE_MODE == "real":
        if not settings.APIMART_API_KEY:
            logger.warning("未配置 API Key，回退到 Mock 服务")
            return MockTranslationService()
        
        return RealTranslationService(
            api_key=settings.APIMART_API_KEY,
            api_endpoint=settings.APIMART_API_ENDPOINT,
            prompt=settings.TRANSLATION_PROMPT,
            poll_interval=settings.POLL_INTERVAL,
            poll_max_attempts=settings.POLL_MAX_ATTEMPTS,
            storage_mode=settings.STORAGE_MODE,
            base_url=settings.BASE_URL
        )
    
    return MockTranslationService()
