import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, MapPin, Loader2, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { cn, formatDateKey } from '@/lib/utils'
import { getHolidayInfo, getHolidayBadge, getHolidayName } from '@/services/holidayService'
import {
  detectLocationAndTimezone,
  formatTimezoneLabel,
  formatUtcOffset,
} from '@/services/timezoneService'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarPage() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const tasks = useAppStore((s) => s.tasks)
  const timezoneInfo = useAppStore((s) => s.timezoneInfo)
  const setTimezoneInfo = useAppStore((s) => s.setTimezoneInfo)

  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate + 'T12:00:00'))
  const [popupDate, setPopupDate] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = monthStart.getDay()
  const paddedDays = [...Array(startPad).fill(null), ...days]

  function getTaskCount(date: Date) {
    return tasks.filter((t) => t.date === formatDateKey(date)).length
  }

  function getTasksForDate(dateKey: string) {
    return tasks.filter((t) => t.date === dateKey)
  }

  async function handleDetectLocation() {
    setLocating(true)
    setLocError(null)
    try {
      const result = await detectLocationAndTimezone()
      setTimezoneInfo({
        timezone: result.timezone,
        city: result.city,
        region: result.region,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        source: 'auto',
      })
    } catch (e) {
      setLocError(e instanceof Error ? e.message : '定位失败，请检查浏览器权限')
    } finally {
      setLocating(false)
    }
  }

  const popupTasks = popupDate ? getTasksForDate(popupDate) : []
  const popupHoliday = popupDate ? getHolidayName(popupDate, timezoneInfo.country) : undefined

  return (
    <div className="space-y-6">
      {/* Timezone bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass-panel px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500/20">
            <Globe className="h-4 w-4 text-accent-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">{formatTimezoneLabel(timezoneInfo)}</p>
            <p className="text-[10px] text-zinc-500">
              偏移 {formatUtcOffset(timezoneInfo.timezone)} · 来源{' '}
              {timezoneInfo.source === 'auto' ? 'GPS 定位' : '设备时区'}
              {timezoneInfo.latitude != null && (
                <> · {timezoneInfo.latitude.toFixed(2)}°, {timezoneInfo.longitude?.toFixed(2)}°</>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={locating}
          className="flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-500 disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          获取当前位置
        </button>
      </div>

      {locError && (
        <p className="text-xs text-red-400">{locError}</p>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">
          {format(viewMonth, 'yyyy年 M月', { locale: zhCN })}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date()
              setViewMonth(today)
              setSelectedDate(formatDateKey(today))
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            今天
          </button>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl glass-panel p-5">
        <div className="mb-3 flex gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="rounded bg-emerald-500/20 px-1 text-emerald-400">休</span> 法定节假日
          </span>
          <span className="flex items-center gap-1">
            <span className="rounded bg-orange-500/20 px-1 text-orange-400">班</span> 调休上班
          </span>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-zinc-500">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />

            const dateKey = formatDateKey(day)
            const count = getTaskCount(day)
            const isSelected = dateKey === selectedDate
            const today = isToday(day)
            const holiday = getHolidayInfo(dateKey, timezoneInfo.country)
            const badge = getHolidayBadge(holiday)

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => {
                  setSelectedDate(dateKey)
                  setPopupDate(dateKey)
                }}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition',
                  'hover:bg-white/8',
                  isSelected && 'bg-accent-600/30 ring-1 ring-accent-500/50',
                  today && !isSelected && 'ring-1 ring-gold-500/40',
                  holiday?.type === 'holiday' && !isSelected && 'bg-emerald-500/5',
                  holiday?.type === 'workday' && !isSelected && 'bg-orange-500/5',
                  !isSameMonth(day, viewMonth) && 'text-zinc-600',
                )}
              >
                <div className="flex items-center gap-0.5">
                  <span
                    className={cn(
                      'font-medium',
                      today ? 'text-gold-400' : 'text-zinc-200',
                      isSelected && 'text-white',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {badge && (
                    <span className={cn('rounded px-0.5 text-[8px] font-bold leading-tight', badge.className)}>
                      {badge.label}
                    </span>
                  )}
                </div>
                {holiday && (
                  <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px] text-zinc-500">
                    {holiday.name}
                  </span>
                )}
                {count > 0 && (
                  <span className="mt-0.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                      <span key={j} className="h-1 w-1 rounded-full bg-accent-400" />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {popupDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPopupDate(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-white">
                    {format(new Date(popupDate + 'T12:00:00'), 'M月d日 EEEE', { locale: zhCN })}
                  </h4>
                  {popupHoliday && (
                    <p className="text-xs text-emerald-400">{popupHoliday}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPopupDate(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {popupTasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">该日暂无任务</p>
              ) : (
                <ul className="space-y-2">
                  {popupTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5"
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          task.status === 'completed' ? 'bg-success' : 'bg-accent-400',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-zinc-200">{task.title}</span>
                        {task.scheduledStart && (
                          <p className="text-[10px] text-zinc-500">
                            {task.scheduledStart}–{task.scheduledEnd}
                            {task.alarmEnabled && ' · ⏰ 已设闹钟'}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedDate(popupDate)
                  setPopupDate(null)
                }}
                className="mt-4 w-full rounded-xl bg-accent-600 py-2.5 text-sm font-medium text-white transition hover:bg-accent-500"
              >
                切换到此日期
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
