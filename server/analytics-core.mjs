/**
 * MyDate 使用统计 & 管理后台 API（用户不可见）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json')

const PAGE_LABELS = {
  task_board: '任务看板',
  calendar: '日历视图',
  ai_scheduler: 'AI 规划',
  settings: '设置',
}

function ensureAnalyticsFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(ANALYTICS_FILE)) {
    fs.writeFileSync(
      ANALYTICS_FILE,
      JSON.stringify({ users: {}, daily: {} }, null, 2),
    )
  }
}

function loadAnalytics() {
  ensureAnalyticsFile()
  try {
    const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'))
    if (!data.users) data.users = {}
    if (!data.daily) data.daily = {}
    return data
  } catch {
    return { users: {}, daily: {} }
  }
}

function saveAnalytics(data) {
  ensureAnalyticsFile()
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2))
}

function loadUsersDb() {
  if (!fs.existsSync(USERS_FILE)) return { users: {}, sessions: {} }
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
  } catch {
    return { users: {}, sessions: {} }
  }
}

function resolveUserFromToken(authorization) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null

  const db = loadUsersDb()
  const session = db.sessions?.[token]
  if (!session || session.expiresAt <= Date.now()) return null

  const user = db.users?.[session.email]
  if (!user?.profileComplete) return null

  return {
    id: user.id,
    email: user.email,
    username: user.username,
  }
}

function getAdminUsernames() {
  return (process.env.ADMIN_USERNAMES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function isAdmin(user) {
  if (!user) return false
  return getAdminUsernames().includes(user.username)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function ensureUserRecord(analytics, user) {
  if (!analytics.users[user.id]) {
    analytics.users[user.id] = {
      userId: user.id,
      email: user.email,
      username: user.username,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      loginCount: 0,
      totalActiveSeconds: 0,
      pageViews: {
        task_board: 0,
        calendar: 0,
        ai_scheduler: 0,
        settings: 0,
      },
      features: {
        ai_schedule: 0,
        task_create: 0,
      },
    }
  }
  return analytics.users[user.id]
}

function touchDaily(analytics, userId, seconds = 0) {
  const day = todayKey()
  if (!analytics.daily[day]) {
    analytics.daily[day] = {
      date: day,
      activeUserIds: [],
      totalActiveSeconds: 0,
      logins: 0,
    }
  }
  const daily = analytics.daily[day]
  if (!daily.activeUserIds.includes(userId)) {
    daily.activeUserIds.push(userId)
  }
  daily.totalActiveSeconds += seconds
}

/** 登录/注册成功时由 auth-core 调用 */
export function recordLoginEvent(user) {
  const analytics = loadAnalytics()
  const record = ensureUserRecord(analytics, user)
  record.loginCount += 1
  record.lastSeen = new Date().toISOString()
  touchDaily(analytics, user.id)
  const day = todayKey()
  analytics.daily[day].logins += 1
  saveAnalytics(analytics)
}

function handleTrackEvent(body, authorization) {
  const user = resolveUserFromToken(authorization)
  if (!user) {
    return { status: 401, data: { ok: false, message: '未登录' } }
  }

  const type = String(body?.type ?? '')
  const analytics = loadAnalytics()
  const record = ensureUserRecord(analytics, user)
  const now = new Date().toISOString()
  record.lastSeen = now
  record.email = user.email
  record.username = user.username

  if (type === 'heartbeat') {
    const seconds = Math.min(Math.max(Number(body?.seconds ?? 30), 1), 120)
    record.totalActiveSeconds += seconds
    touchDaily(analytics, user.id, seconds)
  } else if (type === 'page_view') {
    const page = String(body?.page ?? '')
    if (record.pageViews[page] !== undefined) {
      record.pageViews[page] += 1
    }
    touchDaily(analytics, user.id)
  } else if (type === 'feature') {
    const name = String(body?.name ?? '')
    if (record.features[name] !== undefined) {
      record.features[name] += 1
    }
    touchDaily(analytics, user.id)
  } else {
    return { status: 400, data: { ok: false, message: '未知事件类型' } }
  }

  saveAnalytics(analytics)
  return { status: 200, data: { ok: true } }
}

function buildDashboardData() {
  const analytics = loadAnalytics()
  const usersDb = loadUsersDb()
  const registeredCount = Object.values(usersDb.users ?? {}).filter(
    (u) => u.profileComplete,
  ).length

  const userRecords = Object.values(analytics.users)
  const today = todayKey()
  const todayStats = analytics.daily[today]
  const activeToday = todayStats?.activeUserIds?.length ?? 0

  const totalActiveSeconds = userRecords.reduce(
    (sum, u) => sum + (u.totalActiveSeconds ?? 0),
    0,
  )

  const pageTotals = {
    task_board: 0,
    calendar: 0,
    ai_scheduler: 0,
    settings: 0,
  }
  for (const u of userRecords) {
    for (const key of Object.keys(pageTotals)) {
      pageTotals[key] += u.pageViews?.[key] ?? 0
    }
  }

  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const day = analytics.daily[key]
    last7Days.push({
      date: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      activeUsers: day?.activeUserIds?.length ?? 0,
      totalMinutes: Math.round((day?.totalActiveSeconds ?? 0) / 60),
      logins: day?.logins ?? 0,
    })
  }

  const userTable = userRecords
    .map((u) => {
      const topPage = Object.entries(u.pageViews ?? {}).sort((a, b) => b[1] - a[1])[0]
      return {
        userId: u.userId,
        username: u.username,
        email: u.email,
        loginCount: u.loginCount ?? 0,
        totalMinutes: Math.round((u.totalActiveSeconds ?? 0) / 60),
        lastSeen: u.lastSeen,
        topPage: topPage ? PAGE_LABELS[topPage[0]] ?? topPage[0] : '—',
        pageViews: u.pageViews ?? {},
        features: u.features ?? {},
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes)

  return {
    summary: {
      registeredCount,
      trackedUsers: userRecords.length,
      activeToday,
      totalHours: Math.round(totalActiveSeconds / 3600 * 10) / 10,
    },
    pageTotals: Object.entries(pageTotals).map(([key, count]) => ({
      key,
      label: PAGE_LABELS[key] ?? key,
      count,
    })),
    last7Days,
    users: userTable,
  }
}

function handleAdminCheck(authorization) {
  const user = resolveUserFromToken(authorization)
  if (!user) {
    return { status: 401, data: { ok: false, isAdmin: false, message: '未登录' } }
  }
  return {
    status: 200,
    data: { ok: true, isAdmin: isAdmin(user), username: user.username },
  }
}

function handleAdminDashboard(authorization) {
  const user = resolveUserFromToken(authorization)
  if (!user) {
    return { status: 401, data: { ok: false, message: '未登录' } }
  }
  if (!isAdmin(user)) {
    return { status: 403, data: { ok: false, message: '无权访问管理后台' } }
  }
  return { status: 200, data: { ok: true, dashboard: buildDashboardData() } }
}

export async function dispatchAnalyticsRequest({ method, url, body, authorization }) {
  if (method === 'OPTIONS') {
    return { status: 204, data: null, options: true }
  }

  if (url === '/api/analytics/event' && method === 'POST') {
    return handleTrackEvent(body ?? {}, authorization)
  }
  if (url === '/api/admin/check' && method === 'GET') {
    return handleAdminCheck(authorization)
  }
  if (url === '/api/admin/dashboard' && method === 'GET') {
    return handleAdminDashboard(authorization)
  }

  return null
}

export function logAnalyticsStartup() {
  const admins = getAdminUsernames()
  if (admins.length > 0) {
    console.log(`[MyDate Admin] 管理员账号: ${admins.join(', ')}`)
  } else {
    console.warn('[MyDate Admin] 未配置 ADMIN_USERNAMES，管理后台无人可访问')
  }
}
