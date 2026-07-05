export interface LiveWeather {
  condition: string
  temp: number
  locationLabel: string
}

const QWEATHER_HOST_STORAGE_KEY = 'qweather_api_host'

/** 和风免费开发版 API 根地址（生产环境直连） */
export const QWEATHER_FREE_API_ORIGIN = 'https://devapi.qweather.com'

const COMMERCIAL_QWEATHER_HOST = 'api.qweather.com'
const FREE_QWEATHER_HOST = 'devapi.qweather.com'

/**
 * 统一和风 API 源站：商业版域名 → devapi；http → https；路径与 query 由调用方拼接不变。
 */
export function normalizeQWeatherOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '')
  if (!trimmed) return QWEATHER_FREE_API_ORIGIN

  if (trimmed.startsWith('/')) {
    return import.meta.env.DEV ? trimmed : QWEATHER_FREE_API_ORIGIN
  }

  let origin = trimmed
  if (/^http:\/\//i.test(origin)) {
    origin = `https://${origin.slice(7)}`
  } else if (!/^https:\/\//i.test(origin)) {
    origin = `https://${origin.replace(/^\/+/, '')}`
  }

  origin = origin.replace(
    new RegExp(`^https://${COMMERCIAL_QWEATHER_HOST}`, 'i'),
    `https://${FREE_QWEATHER_HOST}`,
  )

  return origin
}

export function getWeatherEmoji(text: string): string {
  if (text.includes('雨')) return '🌧️'
  if (text.includes('晴')) return '☀️'
  if (text.includes('阴')) return '☁️'
  if (text.includes('多云')) return '🌤️'
  if (text.includes('雷')) return '⛈️'
  if (text.includes('雪')) return '❄️'
  if (text.includes('雾') || text.includes('霾')) return '🌫️'
  return '🍃'
}

function getQWeatherKey(): string | null {
  const key = import.meta.env.VITE_QWEATHER_KEY
  if (!key || key === 'YOUR_QWEATHER_FREE_KEY_HERE') return null
  return key
}

/** 读取控制台中的专用 API Host（不含 https://） */
export function getSavedQWeatherHost(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(QWEATHER_HOST_STORAGE_KEY)?.trim() ?? ''
}

export function saveQWeatherHost(host: string): void {
  const normalized = host
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(new RegExp(`^${COMMERCIAL_QWEATHER_HOST}`, 'i'), FREE_QWEATHER_HOST)
  if (normalized) {
    localStorage.setItem(QWEATHER_HOST_STORAGE_KEY, normalized)
  } else {
    localStorage.removeItem(QWEATHER_HOST_STORAGE_KEY)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('qweather-host-updated'))
  }
}

function normalizeApiHost(host: string): string {
  const bare = host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!bare) return ''
  return normalizeQWeatherOrigin(bare)
}

/**
 * 请求基地址优先级：
 * 1. localStorage 中的专用 Host（页面保存后立即生效）
 * 2. VITE_QWEATHER_PROXY_TARGET（控制台 API Host，开发/生产构建均可用）
 * 3. VITE_QWEATHER_API_BASE（开发可用 /api/qweather 走代理）
 * 4. 开发环境默认 /api/qweather；旧账号回退 devapi
 */
export function getQWeatherApiBase(): string {
  const storedHost = getSavedQWeatherHost()
  if (storedHost) return normalizeApiHost(storedHost)

  const proxyTarget = import.meta.env.VITE_QWEATHER_PROXY_TARGET as string | undefined
  if (proxyTarget?.trim()) {
    return normalizeQWeatherOrigin(proxyTarget)
  }

  const custom = import.meta.env.VITE_QWEATHER_API_BASE as string | undefined
  if (custom?.trim()) {
    return normalizeQWeatherOrigin(custom)
  }

  if (import.meta.env.DEV) return '/api/qweather'
  return QWEATHER_FREE_API_ORIGIN
}

export function getQWeatherSetupHint(): string {
  const envHint = import.meta.env.DEV
    ? '写入 .env.local：VITE_QWEATHER_PROXY_TARGET=https://你的Host.qweatherapi.com 后重启 npm run dev'
    : '或在构建前写入 .env.production.local 的 VITE_QWEATHER_PROXY_TARGET 后重新 npm run build'
  return (
    '新版和风免费账号需在控制台「设置」复制 API Host（如 xxx.qweatherapi.com），' +
    `填入下方并点保存（立即生效），${envHint}`
  )
}

function mapQWeatherError(code: string | number | undefined, httpStatus?: number): string {
  if (httpStatus === 403) {
    return `HTTP 403：${getQWeatherSetupHint()}`
  }
  const c = String(code ?? '')
  const messages: Record<string, string> = {
    '401': 'API Key 无效或类型不匹配（请使用 Web API 凭据 + X-QW-Api-Key）',
    '402': '和风天气调用次数或额度已用尽',
    '403': `无访问权限。${getQWeatherSetupHint()}`,
    '404': '该地区暂无天气数据',
    '429': '请求过于频繁，请稍后再试',
  }
  return messages[c] ?? `和风天气错误码 ${c || '未知'}`
}

interface QWeatherResponse {
  httpStatus: number
  data: Record<string, unknown>
}

const WEATHER_CACHE_TTL_MS = 1_000
const weatherCache = new Map<string, { at: number; value: LiveWeather }>()

export function clearStaleWeatherCache(maxAgeMs = WEATHER_CACHE_TTL_MS * 2): void {
  const now = Date.now()
  for (const [key, entry] of weatherCache.entries()) {
    if (now - entry.at > maxAgeMs) weatherCache.delete(key)
  }
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

async function qweatherFetch(
  path: string,
  key: string,
  options?: { signal?: AbortSignal },
): Promise<QWeatherResponse> {
  const base = getQWeatherApiBase()
  const url = `${base}${path}`

  const res = await fetch(url, {
    signal: options?.signal,
    headers: {
      Accept: 'application/json',
      'X-QW-Api-Key': key,
    },
  })

  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    /* 非 JSON 响应 */
  }

  return { httpStatus: res.status, data }
}

async function lookupCityId(
  latitude: number,
  longitude: number,
  key: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { httpStatus, data } = await qweatherFetch(
    `/geo/v2/city/lookup?location=${longitude},${latitude}&number=1`,
    key,
    { signal },
  )
  if (httpStatus !== 200 || String(data.code) !== '200') return null

  const list = data.location as Array<{ id?: string }> | undefined
  return list?.[0]?.id ?? null
}

/** 和风天气：按 WGS84 经纬度查询实时天气 */
export async function fetchLiveWeather(
  latitude: number,
  longitude: number,
  locationLabel: string,
  options?: { signal?: AbortSignal },
): Promise<LiveWeather> {
  const key = getQWeatherKey()
  if (!key) {
    return {
      condition: '晴间多云 🌤️ (未配置 VITE_QWEATHER_KEY)',
      temp: 22,
      locationLabel,
    }
  }

  const ck = cacheKey(latitude, longitude)
  const cached = weatherCache.get(ck)
  if (cached && Date.now() - cached.at < WEATHER_CACHE_TTL_MS) {
    return { ...cached.value, locationLabel }
  }

  const coordPath = `/v7/weather/now?location=${longitude},${latitude}`
  let { httpStatus, data } = await qweatherFetch(coordPath, key, options)

  let code = String(data.code ?? '')
  if (httpStatus !== 200 || code !== '200' || !data.now) {
    const cityId = await lookupCityId(latitude, longitude, key, options?.signal)
    if (cityId) {
      const retry = await qweatherFetch(`/v7/weather/now?location=${cityId}`, key, options)
      httpStatus = retry.httpStatus
      data = retry.data
      code = String(data.code ?? '')
    }
  }

  if (httpStatus !== 200) {
    throw new Error(mapQWeatherError(data.code as string | number | undefined, httpStatus))
  }
  if (code !== '200' || !data.now) {
    throw new Error(mapQWeatherError(data.code as string | number | undefined))
  }

  const now = data.now as { text?: string; temp?: string }
  const result: LiveWeather = {
    condition: `${now.text} ${getWeatherEmoji(now.text ?? '')}`,
    temp: parseInt(now.temp ?? '0', 10) || 0,
    locationLabel,
  }
  weatherCache.set(ck, { at: Date.now(), value: result })
  return result
}
