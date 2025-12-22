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
    
    # API 支持的宽高比 (宽:高)
    # 文档: https://docs.apimart.ai/en/api-reference/images/gpt-4o/generation
    SUPPORTED_RATIOS = {
        "1:1": 1.0,
        "2:3": 2/3,
        "3:2": 3/2,
    }
    
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
            timeout=httpx.Timeout(180.0, connect=60.0),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        logger.info("RealTranslationService 已初始化")
    
    async def _request_with_retry(self, method: str, url: str, **kwargs) -> httpx.Response:
        """
        带重试机制的通用请求方法
        防止因网络波动导致的 RemoteProtocolError 或 Timeout
        """
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 每次请求前短暂延迟，避免过于频繁
                if attempt > 0:
                    await asyncio.sleep(1)
                
                response = await self.client.request(method, url, **kwargs)
                return response
            except (httpx.RequestError, httpx.TimeoutException) as e:
                if attempt == max_retries - 1:
                    logger.error(f"请求失败 (重试{max_retries}次): {method} {url} - {e}")
                    raise e
                logger.warning(f"请求异常，正在重试 ({attempt+1}/{max_retries}): {method} {url} - {e}")
        
        # 理论上不会走到这里
        raise httpx.RequestError("未知请求错误")
    
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
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_encode)
    
    async def _pad_image_to_ratio(self, image_path: Path, target_ratio_str: str) -> Path:
        """
        将图片填充到指定的宽高比（加白边）
        """
        def _process():
            with Image.open(image_path) as img:
                # 转换由 RGBA 为 RGB（如果是 PNG），避免白色背景变黑
                if img.mode == 'RGBA':
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                width, height = img.size
                target_ratio = self.SUPPORTED_RATIOS[target_ratio_str]
                
                # 计算目标尺寸
                # 如果当前比例 > 目标比例（比如 16:9 > 1:1），说明太宽，需要补高
                # 如果当前比例 < 目标比例（比如 3:4 < 1:1），说明太高，需要补宽
                current_ratio = width / height
                
                if current_ratio > target_ratio:
                    # 图片太宽，保持宽度，增加高度
                    new_width = width
                    new_height = int(width / target_ratio)
                else:
                    # 图片太高，保持高度，增加宽度
                    new_height = height
                    new_width = int(height * target_ratio)
                
                # 创建白色背景新图
                new_img = Image.new('RGB', (new_width, new_height), (255, 255, 255))
                
                # 将原图居中粘贴
                x_offset = (new_width - width) // 2
                y_offset = (new_height - height) // 2
                new_img.paste(img, (x_offset, y_offset))
                
                # 保存处理后的图片
                # 使用 padded_ 前缀，保存到同一目录
                output_path = image_path.parent / f"padded_{image_path.name}"
                new_img.save(output_path, quality=95)
                return output_path

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _process)

    async def _stretch_to_3_4(self, image_path: Path) -> Path:
        """
        [NEW] 将图片强制拉伸/压缩到 3:4 比例
        用于 Ozon 主图模式
        """
        def _process():
            with Image.open(image_path) as img:
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                
                width, height = img.size
                
                # 目标：3:4 (0.75)
                # 策略：保持高度，计算新宽度 (变瘦/变胖)
                # 逻辑：New Width = Height * 0.75
                target_height = height
                target_width = int(height * 0.75)
                
                # 强制 resize
                new_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                
                output_path = image_path.parent / f"stretched_3_4_{image_path.name}"
                new_img.save(output_path, quality=95)
                return output_path

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _process)

    async def _get_best_fit_ratio(self, image_path: Path) -> str:
        """
        计算最适合的 API 支持比例 (1:1, 2:3, 3:2)
        选择逻辑：填充面积最小的比例
        """
        def _compute() -> str:
            try:
                with Image.open(image_path) as img:
                    width, height = img.size
            except Exception:
                return "1:1"
            
            aspect = width / height
            
            best_ratio = "1:1"
            min_padding_area = float("inf")
            
            for ratio_str, ratio_val in self.SUPPORTED_RATIOS.items():
                # 计算如果要适应这个比例，需要填充多少面积
                if aspect > ratio_val:
                    # 原图更宽，由于宽度固定，需要增加高度
                    # new_height = width / ratio_val
                    # padding_area = width * (new_height - height)
                    padding_area = width * (width / ratio_val - height)
                else:
                    # 原图更高，由于高度固定，需要增加宽度
                    # new_width = height * ratio_val
                    # padding_area = height * (new_width - width)
                    padding_area = height * (height * ratio_val - width)
                
                if padding_area < min_padding_area:
                    min_padding_area = padding_area
                    best_ratio = ratio_str
            
            logger.info(f"原图 {width}x{height} ({aspect:.2f}) -> 最佳适配 {best_ratio}")
            return best_ratio
        
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _compute)
    
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
        
        # 1. 计算最佳适配比例
        size_ratio = await self._get_best_fit_ratio(image_path)
        
        # 2. 预处理图片：填充白边以完全匹配比例
        # 这一步是关键，确保提交给 API 的图片已经是标准比例，防止 API 自动裁剪
        try:
            processed_image_path = await self._pad_image_to_ratio(image_path, size_ratio)
            logger.info(f"图片已预处理(填充白边): {processed_image_path.name}, 目标比例: {size_ratio}")
            
            # 使用处理后的图片进行 Base64 / URL 生成
            # 注意：如果是 Cloud 模式，我们需要确保 processed_image_path 也是可访问的
            # 目前 Cloud 模式使用的是 input 目录下的文件，所以我们需要把 padded 图片放入正确的临时目录结构中
            # 但 _pad_image_to_ratio 默认保存在同级目录，所以通常没问题
            target_image_path = processed_image_path
            
        except Exception as e:
            logger.error(f"图片预处理失败，将尝试使用原图: {e}")
            target_image_path = image_path
        
        # 根据存储模式决定使用 Base64 还是 URL
        if self.storage_mode == "cloud":
            # 云端模式
            # 注意：padded_xxx 必须也能被 serve_temp_image 路由访问到
            filename = target_image_path.name
            image_url = f"{self.base_url}/api/temp-images/{request_id}/{filename}"
            logger.info(f"使用 URL 模式: {image_url}")
        else:
            # 本地模式
            image_url = await self._image_to_base64_url(target_image_path)
        
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
        # response = await self.client.post(url, json=payload)
        # 改用带重试的请求
        response = await self._request_with_retry("POST", url, json=payload)
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
            
            # response = await self.client.get(url)
            # 改用带重试的请求
            response = await self._request_with_retry("GET", url)
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
    
    async def translate(self, input_path: Path, output_dir: Path, target_mode: str = "original") -> Path:
        """
        翻译图片
        
        Args:
            input_path: 输入图片路径
            output_dir: 输出目录
            target_mode: 输出模式 "original" | "ozon_3_4"
        """
        try:
            # 准备工作图片（默认是原图）
            working_image_path = input_path
            
            # 1. 模式预处理
            if target_mode == "ozon_3_4":
                # Ozon 主图模式：强制拉伸到 3:4
                try:
                    working_image_path = await self._stretch_to_3_4(input_path)
                    logger.info(f"Ozon 3:4 模式：图片已拉伸 -> {working_image_path.name}")
                except Exception as e:
                    logger.error(f"拉伸图片失败: {e}，将使用原图继续")
            
            # 从路径提取 request_id (temp/request_id/input/filename)
            request_id = input_path.parent.parent.name
            
            # 2. 提交任务 (使用 working_image_path)
            task_id = await self._submit_task(working_image_path, request_id)
            
            # 3. 轮询等待完成
            result = await self._poll_task_status(task_id)
            
            # 4. 获取结果图片 URL
            result_field = result.get("result", {})
            images = result_field.get("images", [])
            if not images:
                raise TranslationError("API 未返回图片")
            
            first_image = images[0]
            if isinstance(first_image, str):
                image_url = first_image
            elif isinstance(first_image, dict):
                url_field = first_image.get("url")
                image_url = url_field[0] if isinstance(url_field, list) else url_field
            else:
                raise TranslationError(f"未知的图片格式: {type(first_image)}")
            
            if not image_url:
                raise TranslationError("API 返回的图片 URL 为空")
            
            logger.info(f"准备下载图片: {image_url}")
            
            # 5. 下载/保存结果
            final_path = output_dir / f"translated_{input_path.name}"
            
            if "http" in image_url:
                # 增加重试机制，防止服务端断开连接 (RemoteProtocolError)
                max_retries = 5
                for attempt in range(max_retries):
                    try:
                        async with self.client.stream("GET", image_url) as response:
                            if response.status_code != 200:
                                raise TranslationError(f"下载结果失败: {response.status_code}")
                            with open(final_path, "wb") as f:
                                async for chunk in response.aiter_bytes():
                                    f.write(chunk)
                        break  # 如果下载成功，退出循环
                    except (httpx.RequestError, httpx.TimeoutException) as e:
                        if attempt == max_retries - 1:
                            # 最后一次重试也失败，抛出异常
                            raise TranslationError(f"下载图片失败 (重试{max_retries}次): {str(e)}")
                        logger.warning(f"下载中断，正在重试 ({attempt+1}/{max_retries}): {e}")
                        await asyncio.sleep(1) # 稍等一秒重试
            else:
                import base64
                header, encoded = image_url.split(",", 1)
                data = base64.b64decode(encoded)
                with open(final_path, "wb") as f:
                    f.write(data)
                    
            # 6. [NEW] 自动裁剪：恢复原始比例 (或强制拉伸后的比例)
            try:
                # 使用 working_image_path 作为"原图"参考
                # 如果是 original 模式，working = input，恢复原图比例
                # 如果是 ozon_3_4 模式，working = stretched(3:4)，恢复到 3:4 并切掉白边
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, self._restore_ratio, working_image_path, final_path)
                logger.info(f"已恢复比例({target_mode}): {final_path}")
            except Exception as e:
                logger.error(f"恢复原始比例失败: {e}，保留原结果")
                
            return final_path
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 错误: {e.response.status_code} - {e.response.text}")
            raise TranslationError(f"API 请求失败: {e.response.status_code}")
        except Exception as e:
            logger.error(f"翻译失败 {input_path.name}: {e}")
            raise TranslationError(str(e))
    
    def _restore_ratio(self, original_path: Path, translated_path: Path) -> None:
        """
        根据原图比例，裁剪掉翻译图的白边 (Padding)
        """
        from PIL import Image
        
        with Image.open(original_path) as orig_img:
            orig_w, orig_h = orig_img.size
            orig_ratio = orig_w / orig_h
            
        with Image.open(translated_path) as trans_img:
            trans_w, trans_h = trans_img.size
            trans_ratio = trans_w / trans_h
            
            # 如果比例几乎一致（误差 < 1%），不需要裁剪
            if abs(orig_ratio - trans_ratio) < 0.01:
                return

            # 计算此图在 Padding 时的逻辑（是 Pad 宽 还是 Pad 高？）
            if orig_ratio > trans_ratio:
                # 原图更宽 -> 翻译图是加上下白边得到的 -> 我们要切掉上下
                valid_h = int(trans_w / orig_ratio)
                diff = trans_h - valid_h
                top = diff // 2
                bottom = top + valid_h
                box = (0, top, trans_w, bottom)
            else:
                # 原图更瘦 -> 翻译图是加左右白边得到的 -> 我们要切掉左右
                valid_w = int(trans_h * orig_ratio)
                diff = trans_w - valid_w
                left = diff // 2
                right = left + valid_w
                box = (left, 0, right, trans_h)
            
            # 执行裁剪
            cropped_img = trans_img.crop(box)
            cropped_img.save(translated_path, quality=95)

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
