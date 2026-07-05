import { dispatchAuthRequest } from './auth-core.mjs'
import { dispatchAnalyticsRequest } from './analytics-core.mjs'

export async function dispatchApiRequest(input) {
  const analyticsResult = await dispatchAnalyticsRequest(input)
  if (analyticsResult !== null) return analyticsResult

  if (input.url === '/api/health' && input.method === 'GET') {
    return { status: 200, data: { ok: true, service: 'mydate-api' } }
  }

  return dispatchAuthRequest(input)
}
