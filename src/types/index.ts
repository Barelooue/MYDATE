export type TaskPriority = 'urgent-important' | 'important' | 'urgent' | 'low'
export type TaskStatus = 'pending' | 'in-progress' | 'completed'

export interface Task {
  id: string
  title: string
  description?: string
  /** Local calendar date (YYYY-MM-DD) in user's active timezone */
  date: string
  estimatedMinutes: number
  importance: number
  urgency: number
  priority: TaskPriority
  status: TaskStatus
  /** HH:mm in user's active timezone */
  scheduledStart?: string
  scheduledEnd?: string
  alarmEnabled: boolean
  /** HH:mm in user's active timezone */
  alarmTime?: string
  /** Absolute UTC instant for alarm firing — survives timezone changes */
  alarmAtUtc?: string
  /** IANA timezone active when task was last aligned */
  timezone?: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  date: string
  content: string
  updatedAt: string
}

export interface ScheduledBlock {
  taskId: string
  title: string
  startTime: string
  endTime: string
  priority: TaskPriority
  score: number
  reason: string
  energyZone?: 'peak' | 'moderate' | 'recovery' | 'low'
  /** 时间轴上的三餐预留块 */
  blockType?: 'task' | 'meal'
  /** 用户勾选的固定时段任务 */
  isPinned?: boolean
}

export interface TcmMealAdvice {
  recipe: string
  reason: string
}

export interface AIScheduleResult {
  date: string
  blocks: ScheduledBlock[]
  summary: string
  totalMinutes: number
  goldenHoursUsed: string[]
  modelUsed?: string
  timezone?: string
  latestWakeUpTime?: string
  tcmDietAdvice?: {
    breakfast: TcmMealAdvice
    lunch: TcmMealAdvice
    dinner: TcmMealAdvice
  }
  totalNutrients?: {
    carbs: number
    protein: number
    fat: number
    fiber: number
    calories: number
  }
}

export interface AlarmSettings {
  enabled: boolean
  defaultLeadMinutes: number
  soundEnabled: boolean
  vibrationEnabled: boolean
  syncWithSystem: boolean
}

export type AIProviderId = 'deepseek' | 'gemini' | 'claude' | 'codex'

export interface AISettings {
  /** 用户选择的大模型服务商 */
  provider: AIProviderId
  /** 用户自备 API Key（必填，仅存于本地） */
  apiKey: string
  /** 可覆盖默认 API 根地址 */
  baseUrl: string
  /** 可覆盖默认模型名 */
  modelName: string
}

export interface AppSettings {
  theme: 'dark' | 'light'
  workDayStart: string
  workDayEnd: string
  goldenHourStart: string
  goldenHourEnd: string
  ai: AISettings
  alarm: AlarmSettings
}

export interface TimezoneInfo {
  timezone: string
  city?: string
  region?: string
  country?: string
  latitude?: number
  longitude?: number
  /** Detected automatically or set manually */
  source: 'auto' | 'device' | 'manual'
}

export interface HolidayInfo {
  date: string
  type: 'holiday' | 'workday'
  name: string
  region: 'CN' | 'INTL'
}

export type CreateTaskInput = Pick<
  Task,
  'title' | 'description' | 'date' | 'estimatedMinutes' | 'importance' | 'urgency'
> & {
  /** 勾选后使用 pinStartTime + estimatedMinutes 固定时段，不参与自动顺排 */
  pinTime?: boolean
  pinStartTime?: string
}
