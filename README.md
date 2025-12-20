# 图片批量翻译工具 v0.0.2

为 Ozon 跨境电商卖家打造的批量图片翻译工具。

## 功能特点

- 🖼️ 批量上传图片（拖拽或点击选择）
- ⚡ 并发处理，高效翻译
- 📦 一键下载翻译后的 ZIP 包
- 🐳 Docker 容器化部署

## 技术栈

- **后端**: FastAPI + Python 3.11
- **前端**: React + Vite + TypeScript + Tailwind CSS
- **部署**: Docker + Nginx

## 项目结构

```
ImageTranslator_v0.0.2/
├── backend/                 # 后端代码
│   ├── main.py             # FastAPI 入口
│   ├── routers/            # API 路由
│   │   └── translate.py    # 翻译接口
│   ├── services/           # 业务服务
│   │   ├── translation.py  # 翻译服务
│   │   └── file_handler.py # 文件处理
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── App.tsx        # 主应用
│   │   └── components/    # 组件
│   └── package.json
├── docker-compose.yml      # Docker 编排
├── Dockerfile.backend      # 后端镜像
├── Dockerfile.frontend     # 前端镜像
└── nginx.conf             # Nginx 配置
```

## 本地开发

### 后端

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
python main.py
# 或者
uvicorn main:app --reload --port 8000
```

后端服务运行在: http://localhost:8000

### 前端

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务运行在: http://localhost:5173

## Docker 部署

### 构建并启动

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

服务地址:
- 前端: http://localhost (80 端口)
- 后端 API: http://localhost:8000

## API 接口

### POST /api/translate-bulk

批量翻译图片接口。

**请求**: 
- Content-Type: `multipart/form-data`
- Body: `files` - 图片文件列表

**响应**:
```json
{
  "request_id": "abc123",
  "total": 3,
  "success": 2,
  "failed": 1,
  "images": [
    {
      "original_name": "product1.jpg",
      "translated_name": "translated_product1.jpg",
      "file_path": "abc123/output/translated_product1.jpg",
      "status": "success"
    }
  ]
}
```

### GET /api/download/{file_path}

下载单个翻译后的图片。

**参数**:
- `file_path`: 从翻译接口返回的文件路径

**示例**:

```bash
# 批量翻译
curl -X POST http://localhost:8000/api/translate-bulk \
  -F "files=@image1.jpg" \
  -F "files=@image2.png"

# 下载单个文件
curl http://localhost:8000/api/download/abc123/output/translated_image1.jpg \
  --output translated_image1.jpg
```

## 配置说明

### 环境变量配置

在 `backend/` 目录下创建 `.env` 文件：

```bash
# APIMart API 配置
APIMART_API_KEY=your_api_key_here
APIMART_API_ENDPOINT=https://api.apimart.ai

# 翻译提示词 (可自定义)
TRANSLATION_PROMPT=Please translate all text in this image from Chinese to Russian. Keep the original layout and design, only replace the text.

# 并发数量
TRANSLATION_CONCURRENCY=5

# 服务模式: mock (测试) 或 real (生产)
SERVICE_MODE=real
```

### 服务模式

- `SERVICE_MODE=mock`: 使用模拟服务，不调用真实 API
- `SERVICE_MODE=real`: 使用 APIMart GPT-4o-image API 进行真实翻译

### 翻译提示词

`TRANSLATION_PROMPT` 用于告诉 AI 如何翻译图片。可根据需要自定义：

- 中文→俄语: `Please translate all text in this image from Chinese to Russian...`
- 中文→英语: `Please translate all text in this image from Chinese to English...`

## 开发说明

- 所有 I/O 操作使用 async/await
- 使用 Semaphore 控制并发，防止 API 限流
- 单张图片失败不影响整体流程
- 临时文件会在请求完成后自动清理

## License

MIT

