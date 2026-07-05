/** 生产环境 API 根地址；Netlify 部署时填 Railway/Render 给的域名 */
export function getApiOrigin(): string {
  const origin = import.meta.env.VITE_API_ORIGIN as string | undefined
  return origin?.replace(/\/$/, '') ?? ''
}

export function apiUrl(path: string): string {
  const origin = getApiOrigin()
  return origin ? `${origin}${path}` : path
}
