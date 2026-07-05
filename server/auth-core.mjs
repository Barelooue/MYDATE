/**
 * MyDate 认证核心逻辑（开发 Vite 插件与生产 HTTP 服务共用）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { recordLoginEvent } from './analytics-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

/** @type {import('nodemailer').Transporter | null} */
let mailer = null

function applyEnvRecord(record) {
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined && value !== '' && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
  mailer = null
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
  mailer = null
}

/** 从 .env.local / .env 加载 SMTP 等配置 */
export function loadAuthEnvFiles() {
  parseEnvFile(path.join(PROJECT_ROOT, '.env'))
  parseEnvFile(path.join(PROJECT_ROOT, '.env.production'))
  parseEnvFile(path.join(PROJECT_ROOT, '.env.local'))
  parseEnvFile(path.join(PROJECT_ROOT, '.env.production.local'))
}

/** Vite 插件注入环境变量 */
export function initAuthEnv(env = {}) {
  applyEnvRecord(env)
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() ?? '',
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER?.trim() ?? '',
    pass: process.env.SMTP_PASS?.trim() ?? '',
    from: process.env.SMTP_FROM?.trim() ?? process.env.SMTP_USER?.trim() ?? '',
  }
}

function isSmtpConfigured() {
  const cfg = getSmtpConfig()
  return !!(cfg.host && cfg.user && cfg.pass)
}

/** 仅在没有配置 SMTP 时，本地开发才回退为页面/终端显示验证码 */
function canUseDevFallback() {
  return (
    !isSmtpConfigured() &&
    (process.env.AUTH_DEV_MODE === 'true' || process.env.NODE_ENV !== 'production')
  )
}

loadAuthEnvFiles()

const CODE_TTL_MS = 10 * 60 * 1000
const SETUP_TTL_MS = 30 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** @type {Map<string, { code: string, expiresAt: number, sentAt: number }>} */
const pendingCodes = new Map()

/** @type {Map<string, { email: string, expiresAt: number }>} */
const setupTokens = new Map()

function getMailer() {
  if (mailer) return mailer
  const cfg = getSmtpConfig()
  if (!cfg.host || !cfg.user || !cfg.pass) return null
  mailer = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  })
  return mailer
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(
      USERS_FILE,
      JSON.stringify({ users: {}, usernames: {}, sessions: {} }, null, 2),
    )
  }
}

function loadDb() {
  ensureDataDir()
  try {
    const db = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
    if (!db.usernames) db.usernames = {}
    return db
  } catch {
    return { users: {}, usernames: {}, sessions: {} }
  }
}

function saveDb(db) {
  ensureDataDir()
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2))
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function normalizeUsername(username) {
  return String(username ?? '').trim()
}

function isValidUsername(username) {
  return /^[\w\u4e00-\u9fa5]{2,20}$/.test(username)
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false
  if (password.length < 8 || password.length > 12) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) return false
  return true
}

function getPasswordValidationMessage(password) {
  if (!password) return '请输入密码'
  if (!isValidPassword(password)) return '密码不合规范，请重新设置密码'
  return null
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function createToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return { salt, hash: hashPassword(password, salt) }
}

function verifyPassword(password, salt, hash) {
  const attempt = hashPassword(password, salt)
  const a = Buffer.from(attempt, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function purgeExpiredSessions(db) {
  const now = Date.now()
  for (const [token, session] of Object.entries(db.sessions)) {
    if (session.expiresAt <= now) delete db.sessions[token]
  }
}

function getUserByEmail(db, email) {
  return db.users[email] ?? null
}

function getUserByUsername(db, username) {
  const email = db.usernames[normalizeUsername(username)]
  return email ? getUserByEmail(db, email) : null
}

function getSessionUser(db, token) {
  purgeExpiredSessions(db)
  const session = db.sessions[token]
  if (!session || session.expiresAt <= Date.now()) return null
  const user = db.users[session.email]
  if (!user || !user.profileComplete) return null
  return { user, session }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
  }
}

function createSession(db, user) {
  const token = createToken()
  db.sessions[token] = {
    userId: user.id,
    email: user.email,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  saveDb(db)
  return token
}

async function sendCodeEmail(email, code) {
  const subject = 'MyDate 注册验证码'
  const text = `您的 MyDate 验证码是：${code}\n\n验证码 10 分钟内有效，请勿泄露给他人。`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#7c3aed;">MyDate</h2>
      <p>欢迎注册 MyDate！</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#111;">${code}</p>
      <p style="color:#666;font-size:13px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
    </div>
  `

  const transport = getMailer()
  if (!transport) {
    if (canUseDevFallback()) {
      console.log(`[AUTH 本地模式] ${email} 验证码: ${code}（未配置 SMTP，未真实发信）`)
      return { dev: true }
    }
    throw new Error('邮件服务未配置，请在 .env.local 中设置 SMTP_HOST / SMTP_USER / SMTP_PASS')
  }

  const cfg = getSmtpConfig()
  await transport.sendMail({ from: cfg.from, to: email, subject, text, html })
  console.log(`[MyDate Auth] 验证码已发送至 ${email}`)
  return { dev: false }
}

export async function handleSendCode(body) {
  const email = normalizeEmail(body.email)

  if (!isValidEmail(email)) {
    return { status: 400, data: { ok: false, message: '请输入有效的邮箱地址' } }
  }

  const db = loadDb()
  const existing = getUserByEmail(db, email)
  if (existing?.profileComplete) {
    return { status: 409, data: { ok: false, message: '该邮箱已注册，请直接登录' } }
  }

  const key = `${email}:register`
  const prev = pendingCodes.get(key)
  if (prev && Date.now() - prev.sentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - prev.sentAt)) / 1000)
    return { status: 429, data: { ok: false, message: `请 ${wait} 秒后再获取验证码` } }
  }

  const code = generateCode()
  pendingCodes.set(key, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    sentAt: Date.now(),
  })

  try {
    const mailResult = await sendCodeEmail(email, code)
    const payload = {
      ok: true,
      message: mailResult.dev
        ? '未配置发信邮箱：验证码仅显示在本地（见下方），不会发到邮箱'
        : '验证码已发送至您的邮箱，请查收（含垃圾箱）',
    }
    if (mailResult.dev) payload.devCode = code
    return { status: 200, data: payload }
  } catch (err) {
    pendingCodes.delete(key)
    return {
      status: 503,
      data: { ok: false, message: err instanceof Error ? err.message : '发送验证码失败' },
    }
  }
}

export async function handleVerifyEmail(body) {
  const email = normalizeEmail(body.email)
  const code = String(body.code ?? '').trim()

  if (!isValidEmail(email)) {
    return { status: 400, data: { ok: false, message: '请输入有效的邮箱地址' } }
  }
  if (!/^\d{6}$/.test(code)) {
    return { status: 400, data: { ok: false, message: '请输入 6 位数字验证码' } }
  }

  const key = `${email}:register`
  const pending = pendingCodes.get(key)
  if (!pending || pending.expiresAt < Date.now()) {
    return { status: 400, data: { ok: false, message: '验证码已过期，请重新获取' } }
  }
  if (pending.code !== code) {
    return { status: 400, data: { ok: false, message: '验证码错误' } }
  }

  pendingCodes.delete(key)

  const db = loadDb()
  if (getUserByEmail(db, email)?.profileComplete) {
    return { status: 409, data: { ok: false, message: '该邮箱已注册，请直接登录' } }
  }

  const setupToken = createToken()
  setupTokens.set(setupToken, { email, expiresAt: Date.now() + SETUP_TTL_MS })

  return {
    status: 200,
    data: {
      ok: true,
      message: '邮箱验证成功，请设置用户名和密码',
      setupToken,
      email,
    },
  }
}

export async function handleCompleteRegister(body) {
  const setupToken = String(body.setupToken ?? '')
  const username = normalizeUsername(body.username)
  const password = String(body.password ?? '')
  const confirmPassword = String(body.confirmPassword ?? '')

  const pending = setupTokens.get(setupToken)
  if (!pending || pending.expiresAt < Date.now()) {
    return { status: 400, data: { ok: false, message: '注册会话已过期，请重新验证邮箱' } }
  }

  if (!isValidUsername(username)) {
    return { status: 400, data: { ok: false, message: '用户名需为 2-20 位字母、数字、下划线或中文' } }
  }
  if (!isValidPassword(password)) {
    return {
      status: 400,
      data: {
        ok: false,
        message: getPasswordValidationMessage(password) ?? '密码不合规范，请重新设置密码',
      },
    }
  }
  if (password !== confirmPassword) {
    return { status: 400, data: { ok: false, message: '两次输入的密码不一致' } }
  }

  const db = loadDb()
  const email = pending.email

  if (db.usernames[username]) {
    return { status: 409, data: { ok: false, message: '用户名已被占用' } }
  }
  if (getUserByEmail(db, email)?.profileComplete) {
    return { status: 409, data: { ok: false, message: '该邮箱已注册，请直接登录' } }
  }

  const { salt, hash } = createPasswordHash(password)
  const user = {
    id: crypto.randomUUID(),
    email,
    username,
    passwordSalt: salt,
    passwordHash: hash,
    profileComplete: true,
    createdAt: new Date().toISOString(),
  }

  db.users[email] = user
  db.usernames[username] = email
  setupTokens.delete(setupToken)

  const token = createSession(db, user)
  recordLoginEvent(publicUser(user))

  return {
    status: 200,
    data: {
      ok: true,
      message: '注册成功',
      token,
      user: publicUser(user),
    },
  }
}

export async function handleLogin(body) {
  const username = normalizeUsername(body.username)
  const password = String(body.password ?? '')

  if (!username) {
    return { status: 400, data: { ok: false, message: '请输入用户名' } }
  }
  if (!password) {
    return { status: 400, data: { ok: false, message: '请输入密码' } }
  }

  const db = loadDb()
  const user = getUserByUsername(db, username)

  if (!user?.profileComplete) {
    return { status: 401, data: { ok: false, message: '用户名或密码错误' } }
  }

  const valid = verifyPassword(password, user.passwordSalt, user.passwordHash)
  if (!valid) {
    return { status: 401, data: { ok: false, message: '用户名或密码错误' } }
  }

  const token = createSession(db, user)
  recordLoginEvent(publicUser(user))

  return {
    status: 200,
    data: {
      ok: true,
      message: '登录成功',
      token,
      user: publicUser(user),
    },
  }
}

export function handleMe(authorization) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) {
    return { status: 401, data: { ok: false, message: '未登录' } }
  }

  const db = loadDb()
  const result = getSessionUser(db, token)
  if (!result) {
    return { status: 401, data: { ok: false, message: '登录已过期，请重新登录' } }
  }

  return {
    status: 200,
    data: { ok: true, user: publicUser(result.user) },
  }
}

export function handleLogout(authorization) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (token) {
    const db = loadDb()
    delete db.sessions[token]
    saveDb(db)
  }
  return { status: 200, data: { ok: true, message: '已退出登录' } }
}

export async function dispatchAuthRequest({ method, url, body, authorization }) {
  if (method === 'OPTIONS') {
    return { status: 204, data: null, options: true }
  }

  if (url === '/api/auth/send-code' && method === 'POST') {
    return await handleSendCode(body ?? {})
  }
  if (url === '/api/auth/verify-email' && method === 'POST') {
    return await handleVerifyEmail(body ?? {})
  }
  if (url === '/api/auth/complete-register' && method === 'POST') {
    return await handleCompleteRegister(body ?? {})
  }
  if (url === '/api/auth/login' && method === 'POST') {
    return await handleLogin(body ?? {})
  }
  if (url === '/api/auth/me' && method === 'GET') {
    return handleMe(authorization)
  }
  if (url === '/api/auth/logout' && method === 'POST') {
    return handleLogout(authorization)
  }

  return { status: 404, data: { ok: false, message: 'Not Found' } }
}

export function logAuthStartup() {
  loadAuthEnvFiles()
  ensureDataDir()
  if (isSmtpConfigured()) {
    const cfg = getSmtpConfig()
    console.log(`[MyDate Auth] 已配置 SMTP（${cfg.host}），验证码将真实发送到用户邮箱`)
  } else if (canUseDevFallback()) {
    console.warn('[MyDate Auth] 未配置 SMTP：本地开发模式，验证码显示在页面/终端，不会发邮件')
    console.warn('[MyDate Auth] 请在 .env.local 配置 SMTP_* 以启用真实发信')
  } else {
    console.error('[MyDate Auth] 未配置 SMTP，生产环境无法发送验证码')
  }
}
