/**
 * 生产环境 DeepSeek 代理（与 vite-plugins/deepseekProxy 行为一致）
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-xxx node server/deepseek-proxy.mjs
 *   默认监听 http://127.0.0.1:8787，Nginx 将 /api/ai/ 反代到此服务
 */
import http from 'node:http'

const PORT = Number(process.env.AI_PROXY_PORT ?? 8787)
const HOST = process.env.AI_PROXY_HOST ?? '127.0.0.1'
const API_KEY = process.env.DEEPSEEK_API_KEY?.trim() ?? ''

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? ''
  if (!url.startsWith('/api/ai/') || req.method !== 'POST') {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: { message: 'Not Found' } }))
    return
  }

  if (!API_KEY) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: {
          message:
            '服务端未配置 DEEPSEEK_API_KEY。请在运行代理前设置环境变量 DEEPSEEK_API_KEY。',
        },
      }),
    )
    return
  }

  try {
    const body = await readBody(req)
    const path = url.replace(/^\/api\/ai/, '/v1')
    const upstream = await fetch(`https://api.deepseek.com${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': String(req.headers['content-type'] ?? 'application/json'),
        Authorization: `Bearer ${API_KEY}`,
      },
      body,
    })

    res.statusCode = upstream.status
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: { message: err instanceof Error ? err.message : 'AI 代理请求失败' },
      }),
    )
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[deepseek-proxy] listening on http://${HOST}:${PORT}`)
  if (!API_KEY) {
    console.warn('[deepseek-proxy] 警告：未设置 DEEPSEEK_API_KEY，请求将返回 503')
  }
})
