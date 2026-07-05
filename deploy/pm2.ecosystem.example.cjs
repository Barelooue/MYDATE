/**
 * PM2 进程管理示例（Linux 服务器）
 * 用法：pm2 start deploy/pm2.ecosystem.example.cjs
 *       pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'mydate-api',
      script: 'server/auth-server.mjs',
      cwd: '/var/www/my-date',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        AUTH_PORT: 8790,
        AUTH_HOST: '127.0.0.1',
      },
      // 环境变量也可写在项目根目录 .env.production.local
    },
  ],
}
