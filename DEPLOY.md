# 🚀 部署文档

## 服务器信息
- **服务器 IP**: 47.243.77.183
- **配置**: 2核2G，40GB ESSD
- **系统**: Linux (待确认)
- **访问地址**: http://47.243.77.183

---

## 📋 一键部署（推荐）

### 前提条件
- Mac/Linux 本地环境
- 已有服务器 root 密码
- APIMart API Key

### 部署步骤

#### 1. 赋予脚本执行权限
```bash
cd /Users/dearjean/Desktop/CursorProject/ImageTranslator_v0.0.2
chmod +x deploy.sh
```

#### 2. 运行部署脚本
```bash
./deploy.sh
```

#### 3. 按提示操作
- 输入服务器密码（如果需要）
- 输入 APIMart API Key
- 等待部署完成

#### 4. 访问测试
```
前端: http://47.243.77.183
API: http://47.243.77.183/api
```

---

## 🛠️ 手动部署

如果自动脚本失败，可以手动执行：

### 步骤 1：连接服务器
```bash
ssh root@47.243.77.183
```

### 步骤 2：安装 Docker
```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 步骤 3：克隆代码
```bash
# 安装 Git（如果没有）
yum install -y git  # CentOS/RHEL
# 或
apt-get install -y git  # Ubuntu/Debian

# 克隆代码
cd /root
git clone https://github.com/Luoshifenw/ozon-image-translator.git ozon-translator
cd ozon-translator
```

### 步骤 4：配置环境变量
```bash
cd backend
cat > .env << 'EOF'
# APIMart API 配置
APIMART_API_KEY=你的API_KEY
APIMART_API_ENDPOINT=https://api.apimart.ai

# 翻译提示词
TRANSLATION_PROMPT=将图片中的文字替换为俄语

# 并发数量
TRANSLATION_CONCURRENCY=5

# 服务模式
SERVICE_MODE=real

# 轮询配置
POLL_INTERVAL=3
POLL_MAX_ATTEMPTS=100

# 存储模式（云端使用 URL）
STORAGE_MODE=cloud
BASE_URL=http://47.243.77.183
EOF
```

### 步骤 5：配置防火墙
```bash
# CentOS/RHEL (firewalld)
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --reload

# Ubuntu/Debian (ufw)
ufw allow 80/tcp

# 或直接在阿里云控制台配置安全组
```

### 步骤 6：构建和启动
```bash
cd /root/ozon-translator

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

---

## 🔧 常用运维命令

### 查看服务状态
```bash
cd /root/ozon-translator
docker-compose ps
```

### 查看日志
```bash
# 查看所有日志
docker-compose logs -f

# 只看后端日志
docker-compose logs -f backend

# 只看前端日志
docker-compose logs -f frontend

# 查看最近 100 行
docker-compose logs --tail=100
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 只重启后端
docker-compose restart backend

# 只重启前端
docker-compose restart frontend
```

### 停止服务
```bash
docker-compose down
```

### 更新代码
```bash
cd /root/ozon-translator

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose down
docker-compose build
docker-compose up -d
```

### 清理临时文件
```bash
cd /root/ozon-translator
rm -rf temp/*
```

### 查看资源占用
```bash
# 查看容器资源占用
docker stats

# 查看磁盘空间
df -h

# 查看内存使用
free -h
```

---

## 🌐 域名与 HTTPS 配置 (easy-reach.top)

### 步骤 1：申请 SSL 证书（Let's Encrypt）
在服务器（宿主机）上执行以下命令申请免费证书：

```bash
# 1. 停止当前服务（如果有占用 80 端口）
cd /root/ozon-translator
docker-compose down

# 2. 安装 Certbot
yum install -y certbot  # CentOS
# 或 apt-get install -y certbot  # Ubuntu

# 3. 申请证书
# 注意：这需要 80 端口未被占用
certbot certonly --standalone -d easy-reach.top -d www.easy-reach.top --email dearjean@example.com --agree-tos --no-eff-email

# 成功后，证书会保存在 /etc/letsencrypt/live/easy-reach.top/ 目录下
```

### 步骤 2：更新环境变量
我们需要告诉后端现在的域名是 `https://easy-reach.top`，以便生成正确的图片链接。

```bash
cd /root/ozon-translator/backend
vim .env
```

修改以下配置：
```ini
# Storage Mode
STORAGE_MODE=cloud
BASE_URL=https://easy-reach.top
```

### 步骤 3：启动服务
```bash
cd /root/ozon-translator

# 重新构建并启动（确保加载新的 docker-compose.yml 配置）
docker-compose build frontend
docker-compose up -d

# 检查日志，确保 Nginx 启动成功（没有报错说找不到证书）
docker-compose logs -f frontend
```

### 证书自动续期
Let's Encrypt 证书有效期为 90 天，建议添加定时任务自动续期：

```bash
crontab -e
# 添加以下内容（每月 1 号凌晨 3 点尝试续期，并重启前端容器加载新证书）
0 3 1 * * certbot renew --quiet && docker restart image-translator-frontend
```

---

## ⚠️ 故障排查

### 问题 1：无法访问服务
**检查清单：**
1. 服务是否启动：`docker-compose ps`
2. 防火墙是否开放：`firewall-cmd --list-ports` 或检查阿里云安全组
3. 端口是否被占用：`netstat -tlnp | grep 80`

### 问题 2：翻译失败
**检查清单：**
1. API Key 是否正确：`cat backend/.env`
2. 存储模式是否为 cloud：`STORAGE_MODE=cloud`
3. BASE_URL 是否正确
4. 查看后端日志：`docker-compose logs backend`

### 问题 3：服务崩溃
**检查清单：**
1. 查看日志：`docker-compose logs`
2. 检查内存：`free -h`
3. 检查磁盘：`df -h`
4. 重启服务：`docker-compose restart`

### 问题 4：临时文件占满磁盘
```bash
# 清理临时文件
cd /root/ozon-translator
rm -rf temp/*

# 清理 Docker 缓存
docker system prune -a
```

---

## 📊 监控和维护

### 定期任务

#### 1. 清理临时文件（每天）
```bash
# 添加到 crontab
crontab -e

# 添加这一行（每天凌晨 2 点清理）
0 2 * * * rm -rf /root/ozon-translator/temp/* 2>/dev/null
```

#### 2. 备份日志（每周）
```bash
# 每周日凌晨备份日志
0 0 * * 0 docker-compose logs > /root/logs/translator-$(date +\%Y\%m\%d).log
```

#### 3. 监控磁盘空间
```bash
# 每小时检查一次
0 * * * * df -h | grep -E '^/dev/' | awk '{if($5+0 > 80) print "磁盘使用超过 80%: "$0}' | mail -s "磁盘告警" your@email.com
```

---

## 🔒 安全建议

1. **修改 SSH 端口**（可选）
2. **配置 fail2ban** 防止暴力破解
3. **定期更新系统**: `yum update` 或 `apt-get update`
4. **API Key 不要泄露**
5. **考虑配置 HTTPS**（如果有域名）

---

## 📞 支持

遇到问题：
1. 查看日志：`docker-compose logs -f`
2. 检查 GitHub Issues
3. 参考本文档故障排查部分







