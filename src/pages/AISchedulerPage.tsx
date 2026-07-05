// src/pages/AISchedulerPage.tsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from '@/context/LocationContext'
import {
  Sparkles,
  Loader2,
  Clock,
  Brain,
  AlertCircle,
  CalendarCheck,
  Zap,
  Moon,
  CloudRain,
  Utensils,
  MapPin,
  Sun,
  Cloud,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'

// 💡 导入核心规划方法
import * as ScheduleService from '@/services/scheduleEngine'
import { cn, parseTimeToMinutes } from '@/lib/utils'
import { buildPlanInputFingerprint } from '@/lib/planFingerprint'
import { layoutTimelineBlocks, TIMELINE_COMPACT_HEIGHT_PX, TIMELINE_TRACK_HEIGHT_PX } from '@/lib/timelineLayout'
import {
  formatTimelineLabel,
  FULL_DAY_END_MINUTES,
  FULL_DAY_START_MINUTES,
} from '@/lib/scheduleNormalize'
import {
  DEFAULT_MEAL_CONFIG,
  isMealBlock,
  type MealScheduleConfig,
} from '@/lib/mealSchedule'
import type { AIScheduleResult } from '@/types'
import { fetchNearbyHealthyShops, type TakeoutShop } from '@/services/foodService'
import { QWeatherHostSetup } from '@/components/weather/QWeatherHostSetup'
import { DisciplineBanner } from '@/components/discipline/DisciplineBanner'
import { PlanningDatePicker } from '@/components/discipline/PlanningDatePicker'
import { useDisciplineForDate } from '@/hooks/useDisciplineForDate'
import { DISCIPLINE_LOCK_MSG, isTodayDateKey } from '@/lib/disciplineMode'
import { isAiConfigured } from '@/services/aiProviders'
import { resolveChatEndpoint } from '@/services/aiClient'
import { Link } from 'react-router-dom'

interface DraftTask {
  title: string
  estimatedMinutes: number
  importance: number
  urgency: number
  pinTime: boolean
  pinStartTime: string
}

const emptyDraft = (): DraftTask => ({
  title: '',
  estimatedMinutes: 30,
  importance: 3,
  urgency: 3,
  pinTime: false,
  pinStartTime: '09:00',
})

const ENERGY_COLORS = {
  peak: 'bg-violet-500/30 border-violet-500/40',
  moderate: 'bg-blue-500/20 border-blue-500/30',
  recovery: 'bg-amber-500/20 border-amber-500/30',
  low: 'bg-zinc-500/20 border-zinc-500/30',
} as const

const ENERGY_LABELS = {
  peak: '峰值',
  moderate: '次高峰',
  recovery: '恢复',
  low: '低谷',
} as const

function WeatherIcon({ condition, className }: { condition: string; className?: string }) {
  if (condition.includes('雨') || condition.includes('雷')) return <CloudRain className={className} />
  if (condition.includes('晴')) return <Sun className={className} />
  return <Cloud className={className} />
}

export function AISchedulerPage() {
  const liveGpsWeather = useLocation()
  const selectedDate = useAppStore((s) => s.selectedDate)
  const settings = useAppStore((s) => s.settings)
  const timezoneInfo = useAppStore((s) => s.timezoneInfo)
  const lastScheduleResult = useAppStore((s) => s.lastScheduleResult) as AIScheduleResult | null
  const setScheduleResult = useAppStore((s) => s.setScheduleResult)
  const applyScheduleToTasks = useAppStore((s) => s.applyScheduleToTasks)
  const tasks = useAppStore((s) => s.tasks)
  const tasksOnDate = useMemo(
    () => (Array.isArray(tasks) ? tasks : []).filter((t) => t.date === selectedDate),
    [tasks, selectedDate],
  )

  const {
    disciplineModeEnabled,
    locked: planLocked,
    lockedAt,
    lockPlanForDate,
  } = useDisciplineForDate(selectedDate)

  const aiReady = isAiConfigured(settings)
  const { providerLabel, modelName: configuredModelName } = resolveChatEndpoint(settings)

  const [drafts, setDrafts] = useState<DraftTask[]>([emptyDraft(), emptyDraft()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const [generatedFingerprint, setGeneratedFingerprint] = useState<string | null>(null)

  const [sleepHours, setSleepHours] = useState<number>(7.5)
  const [sleepQuality, setSleepQuality] = useState<string>('良好')
  const [mealConfig, setMealConfig] = useState<MealScheduleConfig>(DEFAULT_MEAL_CONFIG)

  // 🔴 联动外卖使用的当前选中的餐次标签：'breakfast' | 'lunch' | 'dinner'
  const [activeMealTab, setActiveMealTab] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch')

  const [nearbyShops, setNearbyShops] = useState<TakeoutShop[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const shopsFetchKeyRef = useRef('')

  const dayStart = FULL_DAY_START_MINUTES
  const daySpan = FULL_DAY_END_MINUTES

  const planContext = useMemo(
    () => ({
      sleepHours,
      sleepQuality,
      weatherCondition: liveGpsWeather.condition,
      temperature: liveGpsWeather.temp,
      locationName: liveGpsWeather.location,
    }),
    [sleepHours, sleepQuality, liveGpsWeather.condition, liveGpsWeather.temp, liveGpsWeather.location],
  )

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const gpsRef = useRef(liveGpsWeather)
  gpsRef.current = liveGpsWeather

  const scheduleStaleFingerprint = useMemo(
    () =>
      buildPlanInputFingerprint(
        drafts.map((d) => ({
          title: d.title,
          estimatedMinutes: d.estimatedMinutes,
          importance: d.importance,
          urgency: d.urgency,
          pinTime: d.pinTime,
          pinStartTime: d.pinStartTime,
        })),
        {
          sleepHours,
          sleepQuality,
          weatherCondition: '',
          temperature: 0,
          locationName: '',
        },
        selectedDate,
        settings?.workDayStart ?? '09:00',
        settings?.workDayEnd ?? '22:00',
        {
          breakfastMinutes: mealConfig.breakfastMinutes,
          lunchMinutes: mealConfig.lunchMinutes,
          dinnerMinutes: mealConfig.dinnerMinutes,
        },
      ),
    [
      drafts,
      sleepHours,
      sleepQuality,
      selectedDate,
      settings?.workDayStart,
      settings?.workDayEnd,
      mealConfig.breakfastMinutes,
      mealConfig.lunchMinutes,
      mealConfig.dinnerMinutes,
    ],
  )

  const isPlanStale =
    !!lastScheduleResult &&
    !!generatedFingerprint &&
    generatedFingerprint !== scheduleStaleFingerprint

  const scheduleBlocks = useMemo(() => {
    const raw = lastScheduleResult?.blocks
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (b) => b && typeof b.taskId === 'string' && b.startTime && b.endTime,
    )
  }, [lastScheduleResult?.blocks])

  const timelineLayouts = useMemo(() => {
    const blocks = scheduleBlocks.map((b) => ({
      taskId: b.taskId,
      startTime: b.startTime,
      endTime: b.endTime,
      isMeal: isMealBlock(b),
    }))
    return layoutTimelineBlocks(blocks, dayStart, daySpan)
  }, [scheduleBlocks, dayStart, daySpan])

  const layoutByTaskId = useMemo(() => {
    const map = new Map<string, (typeof timelineLayouts)[0]>()
    timelineLayouts.forEach((l) => map.set(l.taskId, l))
    return map
  }, [timelineLayouts])

  const shopsFetchKey = useMemo(() => {
    if (!lastScheduleResult || isPlanStale) return ''
    const meal = lastScheduleResult.tcmDietAdvice?.[activeMealTab]
    if (!meal?.recipe) return ''
    return `${lastScheduleResult.date}:${activeMealTab}:${meal.recipe}`
  }, [lastScheduleResult, activeMealTab, isPlanStale])

  // 根据 GPS + 当日排程 + 本餐药膳，调用 AI 推荐周边外卖商户
  useEffect(() => {
    if (!shopsFetchKey) {
      shopsFetchKeyRef.current = ''
      return
    }
    if (shopsFetchKeyRef.current === shopsFetchKey) return
    shopsFetchKeyRef.current = shopsFetchKey

    const advice = lastScheduleResult?.tcmDietAdvice
    const meal = advice?.[activeMealTab]
    if (!meal?.recipe || !lastScheduleResult) return

    let cancelled = false
    setShopsLoading(true)

    const scheduleBlocks = (lastScheduleResult.blocks ?? []).map((b) => ({
      title: b.title,
      startTime: b.startTime,
      endTime: b.endTime,
    }))

    const gps = gpsRef.current
    fetchNearbyHealthyShops({
      mealType: activeMealTab,
      mealLabel: activeMealTab === 'breakfast' ? '早餐' : activeMealTab === 'lunch' ? '午餐' : '晚餐',
      locationName: gps.location,
      latitude: gps.latitude,
      longitude: gps.longitude,
      prescribedRecipe: meal.recipe,
      prescribedReason: meal.reason ?? '',
      scheduleSummary: lastScheduleResult.summary ?? '',
      scheduleBlocks,
      settings: settingsRef.current,
    })
      .then((shops) => {
        if (!cancelled) setNearbyShops(shops)
      })
      .catch((err) => {
        console.error('AI 周边商户推荐失败', err)
        if (!cancelled) setNearbyShops([])
      })
      .finally(() => {
        if (!cancelled) setShopsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [shopsFetchKey, lastScheduleResult, activeMealTab])

  useEffect(() => {
    if (shopsFetchKey) return
    setNearbyShops([])
    setShopsLoading(false)
  }, [shopsFetchKey])

  function updateDraft(index: number, patch: Partial<DraftTask>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function addDraft() {
    setDrafts((prev) => [...prev, emptyDraft()])
  }

  async function handleSchedule() {
    if (planLocked) {
      setError(DISCIPLINE_LOCK_MSG)
      return
    }
    const taskInputs = drafts
      .map((d, index) => ({ draft: d, index }))
      .filter(({ draft }) => draft.title.trim())

    if (taskInputs.length === 0) return

    setLoading(true)
    setError(null)
    setApplied(false)

    try {
      const result = await ScheduleService.scheduleWithAI(
        taskInputs.map(({ draft }) => ({
          title: draft.title.trim(),
          estimatedMinutes: Number(draft.estimatedMinutes) || 30,
          importance: Number(draft.importance) || 3,
          urgency: Number(draft.urgency) || 3,
          date: selectedDate,
          pinTime: draft.pinTime,
          pinStartTime: draft.pinTime ? draft.pinStartTime : undefined,
        })),
        settings,
        selectedDate,
        timezoneInfo?.timezone || 'Asia/Shanghai',
        planContext,
        mealConfig,
      )

      setScheduleResult(result)
      setGeneratedFingerprint(scheduleStaleFingerprint)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '规划失败')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!lastScheduleResult) return
    if (planLocked) {
      setError(DISCIPLINE_LOCK_MSG)
      return
    }
    applyScheduleToTasks(lastScheduleResult)
    setApplied(true)
  }

  const canLockPlan =
    disciplineModeEnabled &&
    isTodayDateKey(selectedDate) &&
    !planLocked &&
    ((lastScheduleResult?.date === selectedDate && !!lastScheduleResult) ||
      tasksOnDate.length > 0)

  function blockPosition(startTime: string, endTime: string) {
    if (!startTime || !endTime) return { top: '0px', height: '40px' }
    try {
      const start = Math.max(0, parseTimeToMinutes(startTime) - dayStart)
      const end = parseTimeToMinutes(endTime) - dayStart
      const safeEnd = end > start ? end : start + 30
      const topPx = (start / daySpan) * TIMELINE_TRACK_HEIGHT_PX
      const bottomPx = (safeEnd / daySpan) * TIMELINE_TRACK_HEIGHT_PX
      return {
        top: `${topPx}px`,
        height: `${Math.max(1, bottomPx - topPx)}px`,
      }
    } catch {
      return { top: '0px', height: '40px' }
    }
  }

  return (
    <div className="space-y-6">
      {/* 顶部面板 */}
      <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20">
            <Brain className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">大模型驱动的全人健康运筹学排程</h3>
            <p className="mt-1 text-sm text-zinc-400">
              点击生成后由{' '}
              <span className="text-fuchsia-300">
                {lastScheduleResult?.modelUsed ||
                  (aiReady ? `${providerLabel} / ${configuredModelName}` : '未配置 AI')}
              </span>{' '}
              根据任务、GPS 天气与睡眠，在全天 00:00–24:00 内自动排程并定制三餐
            </p>
          </div>
        </div>
      </div>

      <PlanningDatePicker />

      {!aiReady && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <span>请先在设置中选择 AI 服务商并填写 API Key，才能生成日程。</span>
          <Link
            to="/app/settings"
            className="shrink-0 rounded-lg bg-amber-600/80 px-3 py-1.5 font-medium text-white transition hover:bg-amber-500"
          >
            去设置
          </Link>
        </div>
      )}

      <DisciplineBanner
        planningDate={selectedDate}
        disciplineEnabled={disciplineModeEnabled}
        locked={planLocked}
        lockedAt={lockedAt}
        canLock={canLockPlan}
        onLock={() => lockPlanForDate()}
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* 三餐预留时长（开饭时刻固定：早餐后 / 12:00 午餐 / 18:00 晚餐） */}
      <div
        className={cn(
          'rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3',
          planLocked && 'pointer-events-none opacity-50',
        )}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-200">
          <Utensils className="h-4 w-4" />
          固定三餐时段（任务自动绕开）
        </div>
        <p className="text-[11px] text-zinc-500">
          早餐在起床后约 20 分钟；午餐 <span className="text-orange-300">12:00</span>；晚餐{' '}
          <span className="text-orange-300">18:00</span>。仅调整每餐时长（分钟）。
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['breakfastMinutes', '早餐时长', 20, 75],
              ['lunchMinutes', '午餐时长', 30, 90],
              ['dinnerMinutes', '晚餐时长', 30, 90],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key} className="space-y-1">
              <span className="text-[10px] text-zinc-500">
                {label} · {mealConfig[key]} 分钟
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={5}
                value={mealConfig[key]}
                onChange={(e) =>
                  setMealConfig((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value),
                  }))
                }
                className="w-full accent-orange-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* 生理健康与 GPS 环境采集卡片 */}
      <div
        className={cn(
          'grid gap-4 md:grid-cols-2',
          planLocked && 'pointer-events-none opacity-50',
        )}
      >
        {/* 睡眠状况 */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <Moon className="h-4 w-4 text-indigo-400" /> 昨晚生理健康状况
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[11px] text-zinc-500 block">睡眠时长: {sleepHours} 小时</span>
              <input
                type="range"
                min={3}
                max={12}
                step={0.5}
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-zinc-500 block">晨起自觉状态</span>
              <select
                value={sleepQuality}
                onChange={(e) => setSleepQuality(e.target.value)}
                className="w-full rounded-lg border border-white/8 bg-zinc-900 px-2 py-1 text-xs text-white outline-none"
              >
                <option value="神清气爽">⚡ 神清气爽</option>
                <option value="良好">🙂 精力良好</option>
                <option value="略显疲惫">😑 略显疲惫</option>
                <option value="极度疲惫">🥱 极度疲惫 / 通宵严重</option>
              </select>
            </div>
          </div>
        </div>

        {/* 气象环境 */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <WeatherIcon condition={liveGpsWeather.condition} className="h-4 w-4 text-sky-400" /> 
              实时 GPS 环境气象雷达
            </div>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5 text-emerald-400" />
              {liveGpsWeather.error && !liveGpsWeather.gpsReady
                ? '气象同步异常'
                : liveGpsWeather.gpsReady
                  ? '卫星定位就绪'
                  : '等待 GPS'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs text-zinc-400 font-mono truncate">{liveGpsWeather.location}</p>
              <p className="text-base font-bold text-white truncate">
                {liveGpsWeather.condition || '—'}
              </p>
            </div>
            <div className="text-3xl font-black text-sky-400 tracking-tighter shrink-0">
              {liveGpsWeather.temp}°C
            </div>
          </div>
          {(liveGpsWeather.error?.includes('403') ||
            liveGpsWeather.condition.includes('403')) && (
            <QWeatherHostSetup />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：任务录入 */}
        <div
          className={cn('space-y-4', planLocked && 'pointer-events-none opacity-50')}
        >
          <h4 className="text-sm font-semibold text-zinc-300">输入待规划任务</h4>
          {drafts.map((draft, i) => (
            <div key={i} className="space-y-3 rounded-xl p-4 bg-white/3 border border-white/5">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateDraft(i, { title: e.target.value })}
                placeholder={`任务 ${i + 1} 描述...`}
                className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-fuchsia-500/50"
              />
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.pinTime}
                  onChange={(e) => updateDraft(i, { pinTime: e.target.checked })}
                  className="rounded border-white/20 accent-fuchsia-500"
                />
                固定时间段（如上课时间，不参与自动顺排）
              </label>
              {draft.pinTime && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-500">开始时刻</span>
                    <input
                      type="time"
                      value={draft.pinStartTime}
                      onChange={(e) => updateDraft(i, { pinStartTime: e.target.value })}
                      className="w-full rounded-lg border border-white/8 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-500">持续时长(分)</span>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={draft.estimatedMinutes}
                      onChange={(e) =>
                        updateDraft(i, { estimatedMinutes: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-white/8 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none"
                    />
                  </label>
                </div>
              )}
              {!draft.pinTime && (
                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-500">预计时长(分)</span>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={draft.estimatedMinutes}
                      onChange={(e) =>
                        updateDraft(i, { estimatedMinutes: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-1.5 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-500">重要性 1-5</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={draft.importance}
                      onChange={(e) => updateDraft(i, { importance: Number(e.target.value) })}
                      className="w-full accent-fuchsia-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-500">紧迫度 1-5</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={draft.urgency}
                      onChange={(e) => updateDraft(i, { urgency: Number(e.target.value) })}
                      className="w-full accent-violet-500"
                    />
                  </label>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addDraft}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5"
            >
              + 添加任务
            </button>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={loading || planLocked || !aiReady}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? '智能中医调配及运筹计算中...' : '生成元气健康日程'}
            </button>
          </div>
        </div>

        {/* 右侧：排程展示与动态联动面板 */}
        <div className="rounded-2xl p-5 space-y-6 bg-white/3 border border-white/5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-300">时间轴排程</h4>
            {lastScheduleResult && !isPlanStale && !planLocked && (
              <button
                type="button"
                onClick={handleApply}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  applied
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500',
                  disciplineModeEnabled && !applied && 'ring-1 ring-amber-400/50',
                )}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                {applied
                  ? '已同步到日历闹钟'
                  : disciplineModeEnabled && isTodayDateKey(selectedDate)
                    ? '确认同步并锁定今日'
                    : '确认同步日程'}
              </button>
            )}
          </div>

          {!lastScheduleResult ? (
            <div className="flex flex-col items-center py-24 text-center">
              <Sparkles className="h-10 w-10 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500">点击「生成元气健康日程」解锁完美排程</p>
            </div>
          ) : (
            <div className={cn('space-y-5', isPlanStale && 'opacity-60')}>
              {isPlanStale && (
                <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 text-xs text-fuchsia-200">
                  任务、睡眠或餐次时长已变更，当前为<strong>旧版 AI 结果</strong>。请再次点击左侧「生成元气健康日程」以调用
                  已根据最新输入变更，请重新生成日程。
                </div>
              )}
              {/* 头部摘要 */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] text-amber-400 font-medium tracking-wider uppercase flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 人性化最晚起床时刻
                  </div>
                  <div className="text-3xl font-black text-amber-300 mt-1">
                    {lastScheduleResult?.latestWakeUpTime || '08:00'}
                  </div>
                </div>
                <p className="text-xs text-zinc-300 flex-1 border-l border-white/10 pl-4 leading-relaxed">
                  {lastScheduleResult?.summary || 'AI 规划已准备就绪。'}
                </p>
              </div>

              {/* 🔴 核心修复：渲染完整的一日三餐（早餐、午餐、晚餐） */}
              {lastScheduleResult?.tcmDietAdvice && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5 text-orange-400" /> AI 结合今日环境定制的一日三餐药膳：
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* 早餐 */}
                    <div className="p-3 bg-white/4 rounded-xl border border-white/5 flex flex-col justify-between min-h-[110px]">
                      <div>
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 mb-1.5">
                          🍳 调理早餐
                        </span>
                        <div className="font-bold text-zinc-100 text-xs">
                          {lastScheduleResult?.tcmDietAdvice?.breakfast?.recipe || '暂无推荐'}
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-tight border-t border-white/5 mt-2 pt-1.5">
                        {lastScheduleResult?.tcmDietAdvice?.breakfast?.reason}
                      </div>
                    </div>

                    {/* 午餐 */}
                    <div className="p-3 bg-white/4 rounded-xl border border-white/5 flex flex-col justify-between min-h-[110px]">
                      <div>
                        <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 mb-1.5">
                          ☀️ 养理午餐
                        </span>
                        <div className="font-bold text-zinc-100 text-xs">
                          {lastScheduleResult?.tcmDietAdvice?.lunch?.recipe || '暂无推荐'}
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-tight border-t border-white/5 mt-2 pt-1.5">
                        {lastScheduleResult?.tcmDietAdvice?.lunch?.reason}
                      </div>
                    </div>

                    {/* 晚餐 */}
                    <div className="p-3 bg-white/4 rounded-xl border border-white/5 flex flex-col justify-between min-h-[110px]">
                      <div>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 mb-1.5">
                          🌙 歇理晚餐
                        </span>
                        <div className="font-bold text-zinc-100 text-xs">
                          {lastScheduleResult?.tcmDietAdvice?.dinner?.recipe || '暂无推荐'}
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-tight border-t border-white/5 mt-2 pt-1.5">
                        {lastScheduleResult?.tcmDietAdvice?.dinner?.reason}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔴 核心修复：联动周边健康外卖，添加餐次切换选项卡 */}
              {lastScheduleResult?.tcmDietAdvice && (
                <div className="p-4 bg-zinc-950 rounded-xl border border-white/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-teal-400" /> 周边健康商户联动（点击切换餐次）：
                    </div>
                    {/* 餐次切换器 */}
                    <div className="flex rounded-md bg-white/5 p-0.5 text-[11px]">
                      {(['breakfast', 'lunch', 'dinner'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveMealTab(tab)}
                          className={cn(
                            'px-2 py-1 rounded transition-all',
                            activeMealTab === tab ? 'bg-teal-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          {tab === 'breakfast' ? '早市' : tab === 'lunch' ? '午市' : '晚市'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 外卖商户列表（AI + GPS + 药膳联动） */}
                  <div className="grid gap-2 sm:grid-cols-3">
                    {shopsLoading ? (
                      <div className="col-span-3 flex items-center justify-center gap-2 py-6 text-xs text-zinc-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
                        正在根据 GPS 与今日药膳 AI 筛选周边外卖…
                      </div>
                    ) : nearbyShops.length > 0 ? (
                      nearbyShops.map((shop) => (
                        <div
                          key={shop.id}
                          className="p-3 bg-white/3 border border-white/5 rounded-lg hover:border-teal-500/30 transition"
                        >
                          <div className="font-bold text-sm text-zinc-100 truncate">{shop.name}</div>
                          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                            <span className="text-amber-400">★ {shop.rating}</span>
                            <span>{shop.distance}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-3 text-center py-4 text-xs text-zinc-600">
                        暂无推荐，请确认已生成日程且 AI 服务可用
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 时间轴图形化 */}
              <div
                className="relative rounded-xl bg-white/3 p-3"
                style={{ minHeight: TIMELINE_TRACK_HEIGHT_PX + 24 }}
              >
                <div className="absolute left-3 top-3 bottom-3 w-10 border-r border-white/10">
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const mins = Math.round(dayStart + daySpan * pct)
                    return (
                      <div
                        key={pct}
                        className="absolute left-0 text-[9px] text-zinc-600"
                        style={{ top: `${pct * 100}%`, transform: 'translateY(-50%)' }}
                      >
                        {formatTimelineLabel(mins)}
                      </div>
                    )
                  })}
                </div>

                <div
                  className="relative ml-12 mr-1"
                  style={{ height: TIMELINE_TRACK_HEIGHT_PX }}
                >
                  {scheduleBlocks.map((block, i) => {
                    const layout =
                      layoutByTaskId.get(block.taskId) ??
                      (() => {
                        const fallback = blockPosition(block.startTime, block.endTime)
                        return {
                          taskId: block.taskId,
                          top: fallback.top,
                          height: fallback.height,
                          left: '0%',
                          width: '100%',
                        }
                      })()
                    const isMeal = block.blockType === 'meal' || isMealBlock(block)
                    const isPinned = block.isPinned
                    const energy = block.energyZone ?? 'moderate'
                    const durationMin =
                      parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime)
                    const blockHeightPx = parseFloat(layout.height) || 0
                    const ultraCompact =
                      durationMin < 35 || blockHeightPx < TIMELINE_COMPACT_HEIGHT_PX
                    const blockTitle = `${block.title || '未命名任务'} · ${block.startTime}–${block.endTime}`
                    return (
                      <motion.div
                        key={block.taskId + i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        title={blockTitle}
                        style={{
                          top: layout.top,
                          height: layout.height,
                          left: layout.left,
                          width: layout.width,
                          maxHeight: layout.height,
                        }}
                        className={cn(
                          'absolute box-border overflow-hidden rounded-lg border',
                          ultraCompact ? 'px-1 py-0' : 'px-2 py-1',
                          isMeal
                            ? 'bg-amber-500/25 border-amber-400/50'
                            : isPinned
                              ? 'bg-violet-600/30 border-violet-400/60 border-dashed'
                              : ENERGY_COLORS[energy as keyof typeof ENERGY_COLORS] ||
                                  ENERGY_COLORS.moderate,
                        )}
                      >
                        <div className="flex h-full min-h-0 w-full items-center overflow-hidden">
                          <p
                            className={cn(
                              'min-w-0 flex-1 truncate font-medium leading-none',
                              ultraCompact ? 'text-[9px]' : 'text-[11px]',
                              isMeal ? 'text-amber-100' : 'text-white',
                            )}
                          >
                            {block.title || '未命名任务'}
                          </p>
                          {!ultraCompact && (
                            <span className="ml-1 shrink-0 text-[9px] leading-none text-zinc-400">
                              {block.startTime}–{block.endTime}
                            </span>
                          )}
                        </div>
                        {!isMeal && !ultraCompact && blockHeightPx >= 40 && (
                          <div className="mt-0.5 flex min-h-0 items-center gap-1 overflow-hidden text-[8px] text-zinc-500">
                            <Zap className="h-2 w-2 shrink-0" />
                            <span className="truncate">
                              {ENERGY_LABELS[energy as keyof typeof ENERGY_LABELS] ||
                                ENERGY_LABELS.moderate}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}