import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
// @ts-expect-error api-dispatch 为运行时 .mjs 模块
import { dispatchApiRequest } from '../server/api-dispatch.mjs'
// @ts-expect-error auth-core 为运行时 .mjs 模块
import { initAuthEnv, logAuthStartup } from '../server/auth-core.mjs'
// @ts-expect-error analytics-core 为运行时 .mjs 模块
import { logAnalyticsStartup } from '../server/analytics-core.mjs'

function readReqBody(req: import('http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
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

/** 开发环境内置 API（认证 + 统计 + 管理后台） */
export function authDevPlugin(): Plugin {
  let logged = false

  return {
    name: 'mydate-auth-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/api/')) return next()

        if (!logged) {
          const env = loadEnv(server.config.mode, server.config.root, '')
          initAuthEnv(env)
          logAuthStartup()
          logAnalyticsStartup()
          console.log('[MyDate API] 认证与统计 API 已内置于 Vite')
          logged = true
        }

        try {
          const result = await dispatchApiRequest({
            method: req.method ?? 'GET',
            url,
            body: req.method === 'POST' ? await readReqBody(req) : undefined,
            authorization: req.headers.authorization,
          })

          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

          if (result.options) {
            res.statusCode = 204
            res.end()
            return
          }

          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result.data))
        } catch (err) {
          console.error('[API]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, message: '服务器错误' }))
        }
      })
    },
  }
}
