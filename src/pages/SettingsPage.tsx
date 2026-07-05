import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  BellOff,
  Clock,
  Shield,
  Copy,
  Check,
  Sparkles,
  Volume2,
  Smartphone,
  FileDown,
  Loader2,
  LogOut,
  User,
  LayoutDashboard,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { logoutOnServer } from '@/services/authService'
import { checkIsAdmin } from '@/services/adminService'
import { alarmManager } from '@/services/alarm'
import {
  requestNotificationPermission,
  isNotificationSupported,
  getNotificationPermission,
} from '@/services/alarmService'
import { cn } from '@/lib/utils'
import {
  DISCIPLINE_CANNOT_DISABLE_TODAY_MSG,
  isDisciplineDisableBlockedToday,
} from '@/lib/disciplineMode'
import {
  AI_PROVIDER_PRESETS,
  getDefaultAiSettingsForProvider,
  isAiConfigured,
  testAiConnection,
} from '@/services/aiProviders'
import { ProviderSelect } from '@/components/settings/ProviderSelect'
import { downloadAiApiGuidePdf } from '@/lib/downloadAiApiGuide'
import {
  getAlarmCapabilityHint,
  isMobileDevice,
  supportsVibration,
} from '@/lib/deviceCapabilities'
import type { AIProviderId } from '@/types'

export function SettingsPage() {
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const authToken = useAuthStore((s) => s.token)
  const clearSession = useAuthStore((s) => s.clearSession)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const updateAISettings = useAppStore((s) => s.updateAISettings)
  const tasks = useAppStore((s) => s.tasks)
  const disciplineModeEnabled = useAppStore((s) => s.disciplineModeEnabled)
  const disciplineModeEnabledOnDate = useAppStore((s) => s.disciplineModeEnabledOnDate)
  const disciplineLocks = useAppStore((s) => s.disciplineLocks)
  const setDisciplineModeEnabled = useAppStore((s) => s.setDisciplineModeEnabled)

  const cannotDisableDisciplineToday = isDisciplineDisableBlockedToday(
    disciplineModeEnabledOnDate,
  )

  const [notifPermission, setNotifPermission] = useState(getNotificationPermission())
  const [pendingCount, setPendingCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [aiTesting, setAiTesting] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  )
  const [loggingOut, setLoggingOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!authToken) {
      setIsAdmin(false)
      return
    }
    void checkIsAdmin(authToken).then(setIsAdmin)
  }, [authToken])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutOnServer(authToken)
      clearSession()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    alarmManager.initialize({
      enabled: settings.alarm.enabled,
      soundEnabled: settings.alarm.soundEnabled,
      vibrationEnabled: settings.alarm.vibrationEnabled,
    })
    alarmManager.start()
    setPendingCount(alarmManager.getPendingCount())
    return () => alarmManager.stop()
  }, [settings.alarm.enabled, settings.alarm.soundEnabled, settings.alarm.vibrationEnabled])

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission()
    setNotifPermission(granted ? 'granted' : 'denied')
  }

  const alarmTasks = tasks.filter((t) => t.alarmEnabled && t.alarmTime)
  const syncPayload = alarmManager.exportForNativeSync()

  function handleCopySync() {
    navigator.clipboard.writeText(syncPayload)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lockedDateCount = Object.keys(disciplineLocks ?? {}).length
  const aiReady = isAiConfigured(settings)
  const currentProvider =
    settings.ai.provider ?? AI_PROVIDER_PRESETS[0].id
  const providerPreset =
    AI_PROVIDER_PRESETS.find((p) => p.id === currentProvider) ?? AI_PROVIDER_PRESETS[0]

  function handleProviderChange(provider: AIProviderId) {
    const defaults = getDefaultAiSettingsForProvider(provider)
    setAiTestResult(null)
    updateAISettings({
      provider,
      baseUrl: defaults.baseUrl,
      modelName: defaults.modelName,
    })
  }

  async function handleTestAiConnection() {
    setAiTesting(true)
    setAiTestResult(null)
    try {
      const result = await testAiConnection(settings)
      setAiTestResult({ ok: result.ok, message: result.message })
    } finally {
      setAiTesting(false)
    }
  }

  function handleDisciplineToggle(enabled: boolean) {
    if (!enabled && cannotDisableDisciplineToday) {
      window.alert(DISCIPLINE_CANNOT_DISABLE_TODAY_MSG)
      return
    }
    if (enabled) {
      const ok = window.confirm(
        '开启自律模式后：\n\n· 当天内不可手动关闭（次日 0 点自动关闭本模式）\n· 仅「今天」确认同步或锁定后不可再改\n· 明天及以后可在日历中点选日期，继续规划\n· 仅可在任务看板勾选「已完成」\n· 手动关闭将解除已锁定日期的限制\n\n确定开启？',
      )
      if (!ok) return
    } else if (lockedDateCount > 0) {
      const ok = window.confirm(
        `关闭自律模式将解除 ${lockedDateCount} 个已锁定日期的计划，之后可自由修改。确定关闭？`,
      )
      if (!ok) return
    }
    const ok = setDisciplineModeEnabled(enabled)
    if (!ok) window.alert(DISCIPLINE_CANNOT_DISABLE_TODAY_MSG)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-2xl glass-panel p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Shield className="h-4 w-4 text-violet-400" />
          自律模式
        </h3>
        <p className="mb-4 text-xs text-zinc-500">
          适合「定好计划就必须执行」的场景。仅<strong className="text-zinc-400">今天</strong>
          锁定后不可再改；之后几天仍可在日历或规划日期中自由排程。开启后
          <strong className="text-zinc-400">当天内不可手动关闭</strong>，次日 0 点自动关闭。
        </p>
        {cannotDisableDisciplineToday && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {DISCIPLINE_CANNOT_DISABLE_TODAY_MSG}
          </p>
        )}
        <ToggleRow
          label="开启自律模式"
          description={
            disciplineModeEnabled
              ? cannotDisableDisciplineToday
                ? '今日已开启，次日 0 点自动关闭'
                : lockedDateCount > 0
                  ? `当前有 ${lockedDateCount} 天计划已锁定`
                  : '尚未锁定任何日期；同步日程或手动锁定后生效'
              : '关闭时可自由修改任务与排程'
          }
          enabled={disciplineModeEnabled}
          toggleDisabled={disciplineModeEnabled && cannotDisableDisciplineToday}
          onToggle={() => handleDisciplineToggle(!disciplineModeEnabled)}
        />
      </section>

      {/* Work hours */}
      <section className="rounded-2xl glass-panel p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Clock className="h-4 w-4 text-accent-400" />
          工作时段配置
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ['workDayStart', '工作日开始'],
              ['workDayEnd', '工作日结束'],
              ['goldenHourStart', '黄金时段开始'],
              ['goldenHourEnd', '黄金时段结束'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1.5">
              <span className="text-xs text-zinc-500">{label}</span>
              <input
                type="time"
                value={settings[key]}
                onChange={(e) => updateSettings({ [key]: e.target.value })}
                className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent-500/50"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Alarm — AlarmManager Native Bridge */}
      <section className="rounded-2xl glass-panel p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Bell className="h-4 w-4 text-gold-400" />
          闹钟 & 提醒
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-normal text-zinc-500">
            {alarmManager.getPlatform()} bridge
          </span>
        </h3>
        <p className="mb-4 text-xs text-zinc-500">{getAlarmCapabilityHint()}</p>

        {isMobileDevice() && (
          <div className="mb-4 flex gap-2 rounded-xl border border-accent-500/20 bg-accent-500/5 p-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
            <div className="text-xs leading-relaxed text-zinc-400">
              <p className="mb-1 font-medium text-zinc-300">手机端说明</p>
              <p>
                浏览器无法读取系统「时钟」App 的铃声列表，到点会使用
                <span className="text-zinc-300">系统通知音</span>提醒。若不想有声音，可关闭「闹钟铃声」、只开「震动反馈」。
              </p>
              <p className="mt-1.5">
                建议：开启通知权限，并将本页「添加到主屏幕」，锁屏后提醒更稳定。
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <ToggleRow
            label="启用提醒"
            description={
              isMobileDevice()
                ? '到点弹出系统通知（需授权通知权限）'
                : '到点触发桌面通知与闹钟铃声'
            }
            enabled={settings.alarm.enabled}
            onToggle={() =>
              updateSettings({ alarm: { ...settings.alarm, enabled: !settings.alarm.enabled } })
            }
          />

          <ToggleRow
            label="闹钟铃声"
            description={
              isMobileDevice()
                ? '使用系统通知音（非手机闹钟 App 铃声）'
                : 'Web Audio 双音交替模拟经典闹钟'
            }
            enabled={settings.alarm.soundEnabled}
            onToggle={() =>
              updateSettings({
                alarm: { ...settings.alarm, soundEnabled: !settings.alarm.soundEnabled },
              })
            }
            icon="sound"
          />

          <ToggleRow
            label="震动反馈"
            description={
              supportsVibration()
                ? '关闭铃声时可仅振动提醒（适合静音场合）'
                : '当前浏览器不支持振动 API'
            }
            enabled={settings.alarm.vibrationEnabled}
            onToggle={() =>
              updateSettings({
                alarm: { ...settings.alarm, vibrationEnabled: !settings.alarm.vibrationEnabled },
              })
            }
            icon="vibrate"
          />

          <ToggleRow
            label="系统闹钟同步（Native Bridge 导出）"
            description="导出 JSON 供 Android/iOS/Windows 原生闹钟联动"
            enabled={settings.alarm.syncWithSystem}
            onToggle={() =>
              updateSettings({
                alarm: { ...settings.alarm, syncWithSystem: !settings.alarm.syncWithSystem },
              })
            }
            icon="sync"
          />

          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-200">浏览器通知权限</p>
                <p className="text-xs text-zinc-500">
                  {notifPermission === 'unsupported'
                    ? '当前浏览器不支持通知'
                    : notifPermission === 'granted'
                      ? `已授权 · 待触发 ${pendingCount} 个 · 已绑定 ${alarmTasks.length} 个任务`
                      : '未授权，请点击开启'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alarmManager.testAlarm()}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                >
                  测试闹钟
                </button>
                {isNotificationSupported() && notifPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs text-white hover:bg-accent-500"
                  >
                    开启通知
                  </button>
                )}
                {notifPermission === 'granted' && <Shield className="h-5 w-5 text-success" />}
              </div>
            </div>
          </div>

          {settings.alarm.syncWithSystem && (
            <div className="rounded-xl border border-white/8 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-zinc-400">Native Bridge 同步载荷</p>
                <button
                  type="button"
                  onClick={handleCopySync}
                  className="flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-[10px] text-zinc-400">
                {syncPayload || '[]'}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* AI settings */}
      <section className="rounded-2xl glass-panel p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Sparkles className="h-4 w-4 text-fuchsia-400" />
          AI 大模型接口
        </h3>
        <p className="mb-4 text-xs text-zinc-500">
          开源版本需自备 API Key。选择服务商并填写密钥后，即可使用 AI 排程、药膳推荐与外卖商户推荐；所有功能使用同一套提示词，仅请求格式按厂商适配。
        </p>

        <button
          type="button"
          onClick={() => void downloadAiApiGuidePdf()}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2.5 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20"
        >
          <FileDown className="h-4 w-4 shrink-0" />
          下载 API 获取操作手册（PDF）
        </button>

        {!aiReady && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            尚未配置 API Key，AI 功能暂不可用。请在下方的服务商中选择并填写你的密钥。
          </p>
        )}

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">服务商</span>
            <ProviderSelect value={currentProvider} onChange={handleProviderChange} />
            <p className="text-[10px] text-zinc-600">
              密钥申请：
              <a
                href={providerPreset.docsHint}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-fuchsia-400 hover:underline"
              >
                {providerPreset.docsHint}
              </a>
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">API Key（必填）</span>
            <input
              type="password"
              value={settings.ai.apiKey}
              onChange={(e) => {
                setAiTestResult(null)
                updateAISettings({ apiKey: e.target.value })
              }}
              placeholder={providerPreset.apiKeyPlaceholder}
              autoComplete="off"
              className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/50"
            />
            <p className="text-[10px] text-zinc-600">
              仅保存在本机浏览器，不会上传到任何服务器。
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">Base URL（一般无需修改）</span>
            <input
              type="url"
              value={settings.ai.baseUrl}
              onChange={(e) => updateAISettings({ baseUrl: e.target.value })}
              placeholder={providerPreset.defaultBaseUrl}
              className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/50"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">Model Name</span>
            <input
              type="text"
              value={settings.ai.modelName}
              onChange={(e) => updateAISettings({ modelName: e.target.value })}
              placeholder={providerPreset.defaultModel}
              className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/50"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleTestAiConnection()}
              disabled={aiTesting || !settings.ai.apiKey.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                'bg-fuchsia-600 text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {aiTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiTesting ? '测试中…' : '测试连接'}
            </button>
            {aiTestResult && (
              <p
                className={cn(
                  'text-xs',
                  aiTestResult.ok ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {aiTestResult.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl glass-panel p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <User className="h-4 w-4 text-accent-400" />
          账号
        </h3>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
          <div>
            <p className="text-sm text-zinc-200">{authUser?.username ?? '未登录'}</p>
            <p className="text-xs text-zinc-500">{authUser?.email ?? '邮箱验证码登录'}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            退出登录
          </button>
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="mt-3 flex items-center gap-2 rounded-xl border border-accent-500/20 bg-accent-500/5 px-4 py-3 text-sm text-accent-300 transition hover:bg-accent-500/10"
          >
            <LayoutDashboard className="h-4 w-4" />
            打开管理后台（仅你可见）
          </Link>
        )}
      </section>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  toggleDisabled = false,
  icon = 'bell',
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
  toggleDisabled?: boolean
  icon?: 'bell' | 'sound' | 'vibrate' | 'sync'
}) {
  const IconOn = icon === 'sound' ? Volume2 : icon === 'sync' ? Smartphone : Bell
  const IconOff = icon === 'sound' ? Volume2 : BellOff

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={toggleDisabled}
        className={cn(
          'flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition',
          enabled ? 'bg-accent-600' : 'bg-surface-600',
          toggleDisabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-0',
          )}
        >
          {enabled ? (
            <IconOn className="h-3 w-3 text-accent-600" />
          ) : (
            <IconOff className="h-3 w-3 text-zinc-400" />
          )}
        </span>
      </button>
    </div>
  )
}
