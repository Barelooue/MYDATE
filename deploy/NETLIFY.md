# Netlify 部署指南

Netlify **只能托管静态网页**（`dist/`），**不能**运行本项目的 Node 认证服务（发验证码、登录、管理后台）。

所以需要 **两个部分**：

| 部分 | 托管位置 | 作用 |
|------|----------|------|
| 前端 | **Netlify** | 网页界面 |
| 后端 API | **Railway**（免费额度） | 验证码、登录、用户数据、统计 |

---

## 第一步：把 API 部署到 Railway

### 1. 注册并新建项目

1. 打开 [railway.app](https://railway.app)，用 GitHub 登录  
2. **New Project** → **Deploy from GitHub repo** → 选择你的 MyDate 仓库  
3. Railway 会自动检测项目

### 2. 配置启动命令

在 Railway 项目 **Settings → Deploy**：

- **Start Command**：`node server/auth-server.mjs`

（项目根目录已有 `railway.json` 也会自动识别。）

### 3. 配置环境变量

在 Railway **Variables** 中添加：

```
NODE_ENV=production
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=你的邮箱@163.com
SMTP_PASS=你的163授权码
SMTP_FROM=MyDate <你的邮箱@163.com>
ADMIN_USERNAMES=你的用户名
CORS_ORIGIN=https://你的netlify域名.netlify.app
```

`CORS_ORIGIN` 填你 Netlify 站点的完整地址（上线后也可填自定义域名）。

### 4. 获取 API 公网地址

Railway **Settings → Networking → Generate Domain**

会得到类似：

```
https://mydate-production.up.railway.app
```

记下这个地址，后面要用。

---

## 第二步：配置 Netlify 前端

### 1. 连接 Git 仓库

Netlify 控制台 → **Add new site** → **Import an existing project** → 选同一仓库。

### 2. 构建设置（一般会自动读 `netlify.toml`）

| 项 | 值 |
|----|-----|
| Build command | `npm run build` |
| Publish directory | `dist` |

### 3. 环境变量（重要）

Netlify **Site configuration → Environment variables** 添加：

```
VITE_API_ORIGIN=https://你的-railway域名.up.railway.app
VITE_QWEATHER_KEY=你的和风Key
VITE_QWEATHER_PROXY_TARGET=https://你的Host.qweatherapi.com
```

**注意：** `VITE_` 开头的变量在 **构建时** 写入前端，改完后要 **重新 Deploy**。

### 4. 部署

保存后 **Trigger deploy**。完成后打开你的 Netlify 域名测试注册发验证码。

---

## 架构图

```
用户浏览器
    ↓
Netlify（静态网页 your-app.netlify.app）
    ↓  API 请求发往 VITE_API_ORIGIN
Railway（Node API xxx.up.railway.app）
    ├─ /api/auth/*      登录注册发信
    ├─ /api/analytics/* 使用统计
    └─ /api/admin/*     管理后台
```

---

## 自定义域名

1. **Netlify**：Domain settings 绑定你的域名  
2. **Railway**：继续用 `*.up.railway.app`，或绑 `api.你的域名.com`  
3. 更新 Netlify：`VITE_API_ORIGIN`；更新 Railway：`CORS_ORIGIN`  
4. **重新构建** Netlify

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 认证服务未响应 | 检查 `VITE_API_ORIGIN` 是否填对、是否重新 Deploy |
| 跨域错误 (CORS) | Railway 设置 `CORS_ORIGIN` 为你的 Netlify/自定义域名 |
| 验证码发不出 | 检查 Railway 的 SMTP 环境变量 |
| 用户数据重启丢失 | Railway 免费实例可能清空文件；长期运营建议换数据库 |
