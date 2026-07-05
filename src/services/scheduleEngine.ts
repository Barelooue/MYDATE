// src/services/scheduleEngine.ts
import type { AIScheduleResult, AppSettings, CreateTaskInput, ScheduledBlock, TcmMealAdvice } from '@/types'
import { normalizePriority } from '@/services/aiPrompt'
import { chatCompletionJson, resolveChatEndpoint, MISSING_API_KEY_MSG } from '@/services/aiClient'
import {
  buildHealthScheduleUserPrompt,
  HEALTH_SCHEDULE_SYSTEM_PROMPT,
  type RealtimeContext,
} from '@/services/aiPrompts'
import {
  buildMealBlocks,
  mergeTasksAndMeals,
  type MealScheduleConfig,
  DEFAULT_MEAL_CONFIG,
} from '@/lib/mealSchedule'
import {
  sequentializeScheduleBlocks,
  type PinnedTaskSlot,
} from '@/lib/scheduleNormalize'
import { parseTimeToMinutes } from '@/lib/utils'

export class ScheduleEngineError extends Error {
  code: 'NO_API_KEY' | 'API_ERROR' | 'PARSE_ERROR'
  constructor(message: string, code: 'NO_API_KEY' | 'API_ERROR' | 'PARSE_ERROR') {
    super(message)
    this.code = code
  }
}

export type { RealtimeContext } from '@/services/aiPrompts'

export type EnhancedScheduleResult = AIScheduleResult

function normalizeMeal(raw: unknown): TcmMealAdvice {
  const m = raw as Record<string, unknown>
  return {
    recipe: String(m?.recipe ?? '暂无推荐'),
    reason: String(m?.reason ?? ''),
  }
}

function normalizeTcmDietAdvice(raw: unknown): AIScheduleResult['tcmDietAdvice'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const d = raw as Record<string, unknown>
  if (!d.breakfast && !d.lunch && !d.dinner) return undefined
  return {
    breakfast: normalizeMeal(d.breakfast),
    lunch: normalizeMeal(d.lunch),
    dinner: normalizeMeal(d.dinner),
  }
}

function validateAndNormalize(
  raw: unknown,
  date: string,
  timezone: string,
  taskDurationById?: Map<string, number>,
  mealConfig: MealScheduleConfig = DEFAULT_MEAL_CONFIG,
  pinnedSlots: PinnedTaskSlot[] = [],
): AIScheduleResult {
  const data = raw as Record<string, unknown>
  const rawSchedule = (
    Array.isArray(data.schedule) ? data.schedule : Array.isArray(data.blocks) ? data.blocks : []
  ) as Record<string, unknown>[]

  const normalizedBlocks: ScheduledBlock[] = rawSchedule.map((b, i) => ({
    taskId: String(b.taskId ?? `draft-${i}`),
    title: String(b.title ?? '未命名任务'),
    startTime: String(b.startTime ?? '09:00'),
    endTime: String(b.endTime ?? '09:30'),
    priority: normalizePriority(String(b.priority ?? 'low')),
    score: Number(b.score ?? 0),
    reason: String(b.reason ?? ''),
    energyZone: ['peak', 'moderate', 'recovery', 'low'].includes(String(b.energyZone))
      ? (b.energyZone as ScheduledBlock['energyZone'])
      : undefined,
  }))

  normalizedBlocks.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime))

  const wakeTime = data.latestWakeUpTime ? String(data.latestWakeUpTime) : '07:00'
  const tcmDietAdvice = normalizeTcmDietAdvice(data.tcmDietAdvice)
  const mealBlocks = buildMealBlocks(wakeTime, mealConfig, tcmDietAdvice)

  const taskOnly = normalizedBlocks.filter((b) => !b.taskId.startsWith('meal-'))
  const placedTasks =
    taskOnly.length > 0
      ? sequentializeScheduleBlocks(
          taskOnly,
          wakeTime,
          taskDurationById ?? new Map(),
          mealBlocks,
          pinnedSlots,
        ).map((b) => ({
          ...b,
          isPinned: pinnedSlots.some((p) => p.taskId === b.taskId),
        }))
      : []

  const finalBlocks = mergeTasksAndMeals(placedTasks, mealBlocks)

  const totalMinutes =
    Number(data.totalMinutes) ||
    finalBlocks.reduce(
      (sum, b) => sum + (parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime)),
      0,
    )

  return {
    date: String(data.date ?? date),
    summary: String(data.summary ?? 'AI 已完成今日排程规划。'),
    totalMinutes,
    goldenHoursUsed: Array.isArray(data.goldenHoursUsed) ? data.goldenHoursUsed.map(String) : [],
    blocks: finalBlocks,
    timezone,
    latestWakeUpTime: data.latestWakeUpTime ? String(data.latestWakeUpTime) : undefined,
    tcmDietAdvice,
    totalNutrients: data.totalNutrients as AIScheduleResult['totalNutrients'],
  }
}

export async function scheduleWithAI(
  tasks: CreateTaskInput[],
  settings: AppSettings,
  date: string,
  timezone: string,
  context: RealtimeContext,
  mealConfig: MealScheduleConfig = DEFAULT_MEAL_CONFIG,
): Promise<EnhancedScheduleResult> {
  const { providerLabel, modelName } = resolveChatEndpoint(settings)
  const combinedUserContent = buildHealthScheduleUserPrompt(
    tasks,
    settings,
    date,
    timezone,
    context,
  )

  try {
    const parsed = await chatCompletionJson(
      settings,
      [
        { role: 'system', content: HEALTH_SCHEDULE_SYSTEM_PROMPT },
        { role: 'user', content: combinedUserContent },
      ],
      0.65,
    )
    const durationMap = new Map(
      tasks.map((t, i) => [`draft-${i}`, Number(t.estimatedMinutes) || 30]),
    )
    const pinned: PinnedTaskSlot[] = tasks
      .map((t, i) => ({
        taskId: `draft-${i}`,
        startTime: t.pinStartTime || '09:00',
        durationMinutes: Number(t.estimatedMinutes) || 30,
        pinTime: Boolean(t.pinTime && t.pinStartTime),
      }))
      .filter((p) => p.pinTime)
      .map(({ taskId, startTime, durationMinutes }) => ({
        taskId,
        startTime,
        durationMinutes,
      }))

    const baseResult = validateAndNormalize(
      parsed,
      date,
      timezone,
      durationMap,
      mealConfig,
      pinned,
    )

    return {
      ...baseResult,
      modelUsed: `${providerLabel} / ${modelName}`,
      summary: String(parsed.summary ?? baseResult.summary),
      latestWakeUpTime: parsed.latestWakeUpTime
        ? String(parsed.latestWakeUpTime)
        : baseResult.latestWakeUpTime,
      tcmDietAdvice: normalizeTcmDietAdvice(parsed.tcmDietAdvice) ?? baseResult.tcmDietAdvice,
      totalNutrients: (parsed.totalNutrients as AIScheduleResult['totalNutrients']) ?? baseResult.totalNutrients,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI 响应解析失败'
    if (msg.includes(MISSING_API_KEY_MSG) || msg.includes('API Key')) {
      throw new ScheduleEngineError(msg, 'NO_API_KEY')
    }
    throw new ScheduleEngineError(msg, 'PARSE_ERROR')
  }
}
