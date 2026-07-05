import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { authDevPlugin } from './vite-plugins/authDevPlugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * 新版免费订阅必须使用控制台里的专用 API Host（xxx.qweatherapi.com）。
   * 在 .env.local 设置 VITE_QWEATHER_PROXY_TARGET=https://你的Host.qweatherapi.com
   * 未配置时回退 devapi（旧账号）；新 Key 通常会 HTTP 403。
   */
  const rawQweatherTarget =
    env.VITE_QWEATHER_PROXY_TARGET?.trim() || 'https://devapi.qweather.com'
  const qweatherTarget = rawQweatherTarget
    .replace(/^http:\/\//i, 'https://')
    .replace(/^https:\/\/api\.qweather\.com/i, 'https://devapi.qweather.com')


  if (mode === 'development' && !env.VITE_QWEATHER_PROXY_TARGET?.trim()) {
    console.warn(
      '[和风天气] 未配置 VITE_QWEATHER_PROXY_TARGET，新账号请在 .env.local 填入控制台 API Host',
    )
  }

  return {
    plugins: [react(), tailwindcss(), authDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          widget: path.resolve(__dirname, 'widget.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api/qweather': {
          target: qweatherTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/qweather/, ''),
        },
        '/api/auth': {
          target: 'http://127.0.0.1:8790',
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8790',
          changeOrigin: true,
        },
        '/api/qweather': {
          target: qweatherTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/qweather/, ''),
        },
      },
    },
  }
})
