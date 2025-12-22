# Gunicorn 配置文件
# 用于设置长时间运行的请求超时

import multiprocessing

# 服务器绑定
bind = "0.0.0.0:8000"

# Worker 类型（使用 Uvicorn worker）
worker_class = "uvicorn.workers.UvicornWorker"

# Worker 数量（生产环境建议使用多个，但这里先用 1 个便于调试）
workers = 1

# 请求超时时间（5 分钟 = 300 秒）
timeout = 300

# 优雅关闭超时时间
graceful_timeout = 300

# Keep-alive 超时时间
keepalive = 300

# 日志级别
loglevel = "info"

# 访问日志格式
accesslog = "-"
errorlog = "-"





