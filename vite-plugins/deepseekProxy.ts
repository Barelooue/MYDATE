import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function attachDeepseekProxy(server: ViteDevServer | PreviewServer, apiKey: string) {
  server.middlewares.use(async (req, res: ServerResponse, next) => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/ai/') || req.method !== 'POST') {
      next()
      return
    }

    if (!apiKey) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          error: {
            message:
              '服务端未配置 DEEPSEEK_API_KEY。请在项目根目录 .env.local 添加开发者统一的 DeepSeek 密钥。',
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
          Authorization: `Bearer ${apiKey}`,
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
}

/** 开发/预览时由 Vite 服务端持有 Key，前端只请求 /api/ai/* */
export function deepseekProxyPlugin(apiKey: string): Plugin {
  return {
    name: 'deepseek-proxy',
    configureServer(server) {
      attachDeepseekProxy(server, apiKey)
    },
    configurePreviewServer(server) {
      attachDeepseekProxy(server, apiKey)
    },
  }
}
