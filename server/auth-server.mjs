/**
 * 生产环境认证 HTTP 服务
 * 用法：npm run start:auth
 */
import http from 'node:http'
import { dispatchApiRequest } from './api-dispatch.mjs'
import { loadAuthEnvFiles, logAuthStartup } from './auth-core.mjs'
import { logAnalyticsStartup } from './analytics-core.mjs'

const PORT = Number(process.env.PORT ?? process.env.AUTH_PORT ?? 8790)
const HOST = process.env.AUTH_HOST ?? '0.0.0.0'
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim() || '*'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? ''
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.end()
    return
  }

  try {
    const body = method === 'POST' ? await readBody(req) : undefined
    const result = await dispatchApiRequest({
      method,
      url,
      body,
      authorization: req.headers.authorization,
    })

    if (result.options) {
      res.statusCode = 204
      res.end()
      return
    }

    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
    sendJson(res, result.status, result.data)
  } catch (err) {
    console.error('[AUTH]', err)
    sendJson(res, 500, { ok: false, message: '服务器错误' })
  }
})

loadAuthEnvFiles()
logAuthStartup()
logAnalyticsStartup()

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[MyDate Auth] 端口 ${PORT} 已被占用。请关闭占用进程，或设置 AUTH_PORT 使用其他端口。`,
    )
    console.error('Windows 可执行: netstat -ano | findstr :8790  然后 taskkill /PID <pid> /F')
    process.exit(1)
  }
  throw err
})

server.listen(PORT, HOST, () => {
  console.log(`[MyDate Auth] http://${HOST}:${PORT}`)
})
