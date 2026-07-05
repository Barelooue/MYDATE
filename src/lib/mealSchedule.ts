import type { AIScheduleResult, ScheduledBlock } from '@/types'
import { minutesToTime, parseTimeToMinutes } from '@/lib/utils'
import { FULL_DAY_END_MINUTES } from '@/lib/scheduleNormalize'

export interface MealScheduleConfig {
  /** 午餐开始（固定） */
  lunchStart: string
  /** 晚餐开始（固定） */
  dinnerStart: string
  breakfastMinutes: number
  lunchMinutes: number
  dinnerMinutes: number
}

export const DEFAULT_MEAL_CONFIG: MealScheduleConfig = {
  lunchStart: '12:00',
  dinnerStart: '18:00',
  breakfastMinutes: 40,
  lunchMinutes: 60,
  dinnerMinutes: 45,
}

export function isMealBlock(block: Pick<ScheduledBlock, 'taskId' | 'blockType'>): boolean {
  if (block.blockType === 'meal') return true
  return typeof block.taskId === 'string' && block.taskId.startsWith('meal-')
}

function shortRecipe(recipe: string, maxLen = 12): string {
  const clean = recipe.replace(/\(.*?\)|（.*?）/g, '').trim()
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean
}

/** 根据起床时刻与固定午/晚餐时间生成三餐时间块 */
export function buildMealBlocks(
  wakeTime: string,
  config: MealScheduleConfig,
  tcmDietAdvice?: AIScheduleResult['tcmDietAdvice'],
): ScheduledBlock[] {
  const wake = parseTimeToMinutes(wakeTime || '07:00')
  const breakfastStart = Math.min(Math.max(wake + 20, 6 * 60 + 30), 9 * 60)
  const breakfastEnd = breakfastStart + config.breakfastMinutes

  const lunchStart = parseTimeToMinutes(config.lunchStart)
  const lunchEnd = lunchStart + config.lunchMinutes

  const dinnerStart = parseTimeToMinutes(config.dinnerStart)
  const dinnerEnd = dinnerStart + config.dinnerMinutes

  const meals: Array<{
    id: string
    title: string
    start: number
    end: number
    recipe?: string
  }> = [
    {
      id: 'meal-breakfast',
      title: '🍳 早餐',
      start: breakfastStart,
      end: breakfastEnd,
      recipe: tcmDietAdvice?.breakfast?.recipe,
    },
    {
      id: 'meal-lunch',
      title: '☀️ 午餐',
      start: lunchStart,
      end: lunchEnd,
      recipe: tcmDietAdvice?.lunch?.recipe,
    },
    {
      id: 'meal-dinner',
      title: '🌙 晚餐',
      start: dinnerStart,
      end: dinnerEnd,
      recipe: tcmDietAdvice?.dinner?.recipe,
    },
  ]

  return meals.map((m) => ({
    taskId: m.id,
    title: m.recipe ? `${m.title} · ${shortRecipe(m.recipe)}` : m.title,
    startTime: minutesToTime(m.start),
    endTime: minutesToTime(Math.min(m.end, FULL_DAY_END_MINUTES - 1)),
    priority: 'low' as const,
    score: 0,
    reason: '用餐休息（固定时段，时长可调整）',
    energyZone: 'recovery' as const,
    blockType: 'meal' as const,
  }))
}

export function mergeTasksAndMeals(
  tasks: ScheduledBlock[],
  meals: ScheduledBlock[],
): ScheduledBlock[] {
  return [...meals, ...tasks.filter((t) => !isMealBlock(t))].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  )
}
