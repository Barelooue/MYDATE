import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AIProviderId,
  AppSettings,
  AIScheduleResult,
  CreateTaskInput,
  Note,
  Task,
  TimezoneInfo,
} from '@/types'
import {
  inferProviderFromLegacySettings,
  getProviderPreset,
} from '@/services/aiProviders'
import { generateId, formatDateKey, parseTimeToMinutes } from '@/lib/utils'
import {
  applyDisciplineCalendarDaySync,
  canLockDateUnderDiscipline,
  canPatchTaskWhenLocked,
  isPlanLocked,
  pruneFutureDisciplineLocks,
  shouldAutoLockOnApply,
  type DisciplineLock,
} from '@/lib/disciplineMode'
import { classifyPriority } from '@/services/aiScheduler'
import { alarmManager } from '@/services/alarm'
import {
  buildDefaultTimezoneInfo,
  convertTaskToTimezone,
  localDateTimeToUtc,
  migrateAllTasksTimezone,
} from '@/services/timezoneService'

const defaultSettings: AppSettings = {
  theme: 'dark',
  workDayStart: '09:00',
  workDayEnd: '22:00',
  goldenHourStart: '09:00',
  goldenHourEnd: '12:00',
  ai: {
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
  },
  alarm: {
    enabled: true,
    defaultLeadMinutes: 15,
    soundEnabled: true,
    vibrationEnabled: true,
    syncWithSystem: false,
  },
}

/** Migrate legacy flat AI settings from older builds */
function migrateLegacySettings(raw: Record<string, unknown> | undefined): AppSettings {
  if (!raw) return defaultSettings
  const ai = (raw.ai as AppSettings['ai']) ?? {}
  const baseUrl =
    ai.baseUrl ?? normalizeBaseUrl(String(raw.aiApiEndpoint ?? '')) ?? defaultSettings.ai.baseUrl
  const modelName = ai.modelName ?? String(raw.aiModelName ?? 'deepseek-chat')
  const provider: AIProviderId =
    ai.provider ??
    inferProviderFromLegacySettings(baseUrl, modelName)
  const preset = getProviderPreset(provider)
  return {
    ...defaultSettings,
    ...(raw as Partial<AppSettings>),
    ai: {
      provider,
      apiKey: ai.apiKey ?? String(raw.aiApiKey ?? ''),
      baseUrl: baseUrl || preset.defaultBaseUrl,
      modelName: modelName || preset.defaultModel,
    },
    alarm: {
      ...defaultSettings.alarm,
      ...(raw.alarm as AppSettings['alarm']),
      vibrationEnabled:
        (raw.alarm as AppSettings['alarm'])?.vibrationEnabled ?? true,
    },
  }
}

function normalizeBaseUrl(url: string): string {
  if (!url) return defaultSettings.ai.baseUrl
  return url.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '')
}

interface AppState {
  tasks: Task[]
  notes: Note[]
  settings: AppSettings
  timezoneInfo: TimezoneInfo
  selectedDate: string
  lastScheduleResult: AIScheduleResult | null
  sidebarCollapsed: boolean
  disciplineModeEnabled: boolean
  /** 自律模式开启的自然日 YYYY-MM-DD，当日不可关闭 */
  disciplineModeEnabledOnDate: string | null
  disciplineLocks: Record<string, DisciplineLock>

  setSelectedDate: (date: string) => void
  toggleSidebar: () => void
  setTimezoneInfo: (info: TimezoneInfo) => void

  addTask: (input: CreateTaskInput) => Task | null
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void

  upsertNote: (date: string, content: string) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  updateAISettings: (patch: Partial<AppSettings['ai']>) => void
  setScheduleResult: (result: AIScheduleResult | null) => void
  applyScheduleToTasks: (result: AIScheduleResult) => void
  setDisciplineModeEnabled: (enabled: boolean) => boolean
  syncDisciplineModeForCalendarDay: () => void
  lockPlanForDate: (date: string) => boolean
  isDatePlanLocked: (date: string) => boolean
}

async function syncTaskAlarm(task: Task, timezone: string) {
  if (task.alarmEnabled) {
    await alarmManager.scheduleFromTask(task, timezone)
  } else {
    await alarmManager.cancelForTask(task.id)
  }
}

function enrichTaskWithTimezone(task: Task, timezone: string): Task {
  const enriched = { ...task, timezone }
  if (task.alarmEnabled && task.alarmTime && task.date) {
    enriched.alarmAtUtc = localDateTimeToUtc(task.date, task.alarmTime, timezone)
  }
  if (task.scheduledStart && task.date) {
    /* scheduled times stay as local HH:mm; alarmAtUtc derived from alarmTime */
  }
  return enriched
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: [],
      notes: [],
      settings: defaultSettings,
      timezoneInfo: buildDefaultTimezoneInfo(),
      selectedDate: formatDateKey(new Date()),
      lastScheduleResult: null,
      sidebarCollapsed: false,
      disciplineModeEnabled: false,
      disciplineModeEnabledOnDate: null,
      disciplineLocks: {},

      setSelectedDate: (date) => {
        const safe = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : formatDateKey(new Date())
        if (get().selectedDate === safe) return
        set({ selectedDate: safe })
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setTimezoneInfo: (info) => {
        const prev = get().timezoneInfo
        if (prev.timezone !== info.timezone) {
          const migrated = migrateAllTasksTimezone(get().tasks, prev.timezone, info.timezone)
          set({ timezoneInfo: info, tasks: migrated })
          migrated
            .filter((t) => t.alarmEnabled)
            .forEach((t) => void syncTaskAlarm(t, info.timezone))
          return
        }
        const next = { ...prev, ...info }
        const unchanged =
          prev.latitude === next.latitude &&
          prev.longitude === next.longitude &&
          prev.city === next.city &&
          prev.region === next.region &&
          prev.country === next.country &&
          prev.source === next.source
        if (unchanged) return
        set({ timezoneInfo: next })
      },

      isDatePlanLocked: (date) => isPlanLocked(get().disciplineLocks, date),

      setDisciplineModeEnabled: (enabled) => {
        const today = formatDateKey(new Date())
        if (!enabled) {
          const s = get()
          if (
            s.disciplineModeEnabled &&
            s.disciplineModeEnabledOnDate === today
          ) {
            return false
          }
          set({
            disciplineModeEnabled: false,
            disciplineModeEnabledOnDate: null,
            disciplineLocks: {},
          })
          return true
        }
        set({
          disciplineModeEnabled: true,
          disciplineModeEnabledOnDate: today,
        })
        return true
      },

      syncDisciplineModeForCalendarDay: () => {
        const next = applyDisciplineCalendarDaySync(get())
        if (
          next.disciplineModeEnabled === get().disciplineModeEnabled &&
          next.disciplineModeEnabledOnDate === get().disciplineModeEnabledOnDate &&
          next.disciplineLocks === get().disciplineLocks
        ) {
          return
        }
        set({
          disciplineModeEnabled: next.disciplineModeEnabled,
          disciplineModeEnabledOnDate: next.disciplineModeEnabledOnDate,
          disciplineLocks: next.disciplineLocks,
        })
      },

      lockPlanForDate: (date) => {
        if (!canLockDateUnderDiscipline(date, get().disciplineModeEnabled)) return false
        set((s) => ({
          disciplineLocks: {
            ...pruneFutureDisciplineLocks(s.disciplineLocks),
            [date]: { lockedAt: new Date().toISOString() },
          },
        }))
        return true
      },

      addTask: (input) => {
        if (isPlanLocked(get().disciplineLocks, input.date)) return null
        const tz = get().timezoneInfo.timezone
        const now = new Date().toISOString()
        const task: Task = {
          id: generateId(),
          title: input.title,
          description: input.description,
          date: input.date,
          estimatedMinutes: input.estimatedMinutes,
          importance: input.importance,
          urgency: input.urgency,
          priority: classifyPriority(input.importance, input.urgency),
          status: 'pending',
          alarmEnabled: false,
          timezone: tz,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ tasks: [...s.tasks, task] }))
        return task
      },

      updateTask: (id, patch) => {
        const tz = get().timezoneInfo.timezone
        const existing = get().tasks.find((t) => t.id === id)
        if (!existing) return
        if (
          isPlanLocked(get().disciplineLocks, existing.date) &&
          !canPatchTaskWhenLocked(patch, existing)
        ) {
          return
        }
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t
            let updated: Task = {
              ...t,
              ...patch,
              timezone: tz,
              updatedAt: new Date().toISOString(),
            }
            if (patch.importance !== undefined || patch.urgency !== undefined) {
              updated.priority = classifyPriority(updated.importance, updated.urgency)
            }
            updated = enrichTaskWithTimezone(updated, tz)
            void syncTaskAlarm(updated, tz)
            return updated
          }),
        }))
      },

      deleteTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (task && isPlanLocked(get().disciplineLocks, task.date)) return
        void alarmManager.cancelForTask(id)
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
      },

      upsertNote: (date, content) => {
        const existing = get().notes.find((n) => n.date === date)
        const now = new Date().toISOString()
        if (existing) {
          set((s) => ({
            notes: s.notes.map((n) =>
              n.date === date ? { ...n, content, updatedAt: now } : n,
            ),
          }))
        } else {
          set((s) => ({
            notes: [...s.notes, { id: generateId(), date, content, updatedAt: now }],
          }))
        }
      },

      updateSettings: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            ...patch,
            ai: { ...s.settings.ai, ...(patch.ai ?? {}) },
            alarm: { ...s.settings.alarm, ...(patch.alarm ?? {}) },
          },
        })),

      updateAISettings: (patch) =>
        set((s) => ({
          settings: { ...s.settings, ai: { ...s.settings.ai, ...patch } },
        })),

      setScheduleResult: (result) => {
        if (result && isPlanLocked(get().disciplineLocks, result.date)) return
        set({ lastScheduleResult: result })
      },

      applyScheduleToTasks: (result) => {
        if (isPlanLocked(get().disciplineLocks, result.date)) return
        const tz = get().timezoneInfo.timezone
        const { addTask, updateTask, tasks } = get()
        const existingOnDate = tasks.filter((t) => t.date === result.date)

        result.blocks
          .filter((block) => !block.taskId.startsWith('meal-'))
          .forEach((block) => {
          const draftIdx = block.taskId.match(/draft-(\d+)/)?.[1]
          const matched = draftIdx ? existingOnDate[Number(draftIdx)] : undefined
          const duration = Math.max(
            5,
            parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime),
          )
          const alarmTime = block.startTime
          const alarmAtUtc = localDateTimeToUtc(result.date, alarmTime, tz)

          if (matched) {
            updateTask(matched.id, {
              scheduledStart: block.startTime,
              scheduledEnd: block.endTime,
              priority: block.priority,
              estimatedMinutes: duration,
              alarmEnabled: true,
              alarmTime,
              alarmAtUtc,
            })
          } else {
            const created = addTask({
              title: block.title,
              date: result.date,
              estimatedMinutes: duration,
              importance: block.priority === 'urgent-important' ? 5 : block.priority === 'important' ? 4 : 3,
              urgency: block.priority === 'urgent' || block.priority === 'urgent-important' ? 4 : 2,
            })
            if (!created) return
            updateTask(created.id, {
              scheduledStart: block.startTime,
              scheduledEnd: block.endTime,
              priority: block.priority,
              alarmEnabled: true,
              alarmTime,
              alarmAtUtc,
            })
          }
          })

        set((s) => ({
          selectedDate: result.date,
          ...(shouldAutoLockOnApply(result.date, s.disciplineModeEnabled)
            ? {
                disciplineLocks: {
                  ...pruneFutureDisciplineLocks(s.disciplineLocks),
                  [result.date]: { lockedAt: new Date().toISOString() },
                },
              }
            : {}),
        }))
      },
    }),
    {
      name: 'mydate-storage',
      partialize: (s) => ({
        tasks: s.tasks,
        notes: s.notes,
        settings: s.settings,
        timezoneInfo: s.timezoneInfo,
        selectedDate: s.selectedDate,
        lastScheduleResult: s.lastScheduleResult,
        disciplineModeEnabled: s.disciplineModeEnabled,
        disciplineModeEnabledOnDate: s.disciplineModeEnabledOnDate,
        disciplineLocks: s.disciplineLocks,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppState> | undefined
        const rawSettings = saved?.settings as Record<string, unknown> | undefined
        const merged = applyDisciplineCalendarDaySync({
          ...current,
          tasks: Array.isArray(saved?.tasks) ? saved.tasks : current.tasks,
          notes: Array.isArray(saved?.notes) ? saved.notes : current.notes,
          settings: migrateLegacySettings(rawSettings),
          timezoneInfo: saved?.timezoneInfo ?? current.timezoneInfo ?? buildDefaultTimezoneInfo(),
          selectedDate: saved?.selectedDate ?? current.selectedDate ?? formatDateKey(new Date()),
          lastScheduleResult:
            saved?.lastScheduleResult ?? current.lastScheduleResult ?? null,
          disciplineModeEnabled:
            saved?.disciplineModeEnabled ?? current.disciplineModeEnabled ?? false,
          disciplineModeEnabledOnDate:
            saved?.disciplineModeEnabledOnDate ??
            current.disciplineModeEnabledOnDate ??
            null,
          disciplineLocks: pruneFutureDisciplineLocks(
            saved?.disciplineLocks ?? current.disciplineLocks,
          ),
        })
        return merged
      },
    },
  ),
)

export function resyncAllAlarms(tasks: Task[], timezone: string) {
  tasks.filter((t) => t.alarmEnabled).forEach((t) => {
    const patch = convertTaskToTimezone(t, t.timezone ?? timezone, timezone)
    void alarmManager.scheduleFromTask({ ...t, ...patch }, timezone)
  })
}
