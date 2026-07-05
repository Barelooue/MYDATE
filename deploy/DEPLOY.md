# MyDate 域名上线部署指南

## 为什么本地能用、上线后不行？

本地 `npm run dev` 时，Vite **内置了** `/api/auth` 等后端接口。

上线后如果只上传了 `dist/` 静态文件（HTML/JS），**没有 Node 后端**，浏览器请求  
`https://你的域名/api/auth/send-code` 会返回空或 404，页面就会提示：

> 认证服务未响应，请刷新页面后重试

**解决办法：服务器上同时运行「静态前端 + Node 认证服务」，并用 Nginx 把 `/api/` 转过去。**

---

## 部署步骤（Linux 服务器示例）

### 1. 上传代码并安装依赖

```bash
cd /var/www/my-date
npm install
```

### 2. 配置生产环境变量

在项目根目录创建 `.env.production.local`（不要提交 Git）：

```env
# 163 发验证码
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=你的邮箱@163.com
SMTP_PASS=你的授权码
SMTP_FROM=MyDate <你的邮箱@163.com>

# 管理后台
ADMIN_USERNAMES=你的用户名

# 和风天气（构建时需要）
VITE_QWEATHER_KEY=你的Key
VITE_QWEATHER_PROXY_TARGET=https://你的Host.qweatherapi.com
```

### 3. 构建前端

```bash
npm run build
```

产物在 `dist/` 目录。

### 4. 启动后端 API（必须常驻运行）

```bash
# 方式 A：直接运行
NODE_ENV=production npm run start:auth

# 方式 B：用 PM2 守护（推荐）
pm2 start deploy/pm2.ecosystem.example.cjs
pm2 save
```

确认本机可访问：

```bash
curl -X POST http://127.0.0.1:8790/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

应返回 JSON（不是空）。

### 5. 配置 Nginx

参考 `deploy/nginx.example.conf`，核心配置：

```nginx
root /var/www/my-date/dist;

location /api/ {
    proxy_pass http://127.0.0.1:8790;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

重载 Nginx：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 6. 验证

- 打开 `https://你的域名/signup`
- 点「获取验证码」应显示「验证码已发送至您的邮箱」
- 终端/PM2 日志应有 `[MyDate Auth] 验证码已发送至 ...`

---

## 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 认证服务未响应 | 未启动 `start:auth` 或 Nginx 未代理 `/api/` | 启动后端 + 检查 Nginx |
| 验证码发不出 | 服务器未配 SMTP | 检查 `.env.production.local` |
| 刷新子页面 404 | 未配置 SPA `try_files` | 加上 `try_files ... /index.html` |
| 管理后台进不去 | `ADMIN_USERNAMES` 未配或用户名不对 | 配置后重启 API 服务 |

---

## 架构示意

```
用户浏览器
    ↓ HTTPS
Nginx (你的域名)
    ├─ /          → dist/ 静态文件（React 前端）
    └─ /api/*     → 127.0.0.1:8790 Node 服务（认证+邮件+统计）
```

本地开发时 Vite 代替 Nginx 做这件事；**上线后必须由 Nginx + Node 接手。**
