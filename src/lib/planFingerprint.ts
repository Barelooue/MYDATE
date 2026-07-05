export interface PlanDraftInput {
  title: string
  estimatedMinutes: number
  importance: number
  urgency: number
  pinTime?: boolean
  pinStartTime?: string
}

export interface PlanContextInput {
  sleepHours: number
  sleepQuality: string
  weatherCondition: string
  temperature: number
  locationName: string
}

/** 用于判断左侧任务/环境变更后，右侧 AI 结果是否已过期 */
export function buildPlanInputFingerprint(
  drafts: PlanDraftInput[],
  context: PlanContextInput,
  date: string,
  workDayStart: string,
  workDayEnd: string,
  mealDurations?: { breakfastMinutes: number; lunchMinutes: number; dinnerMinutes: number },
): string {
  const tasks = drafts
    .filter((d) => d.title.trim())
    .map((d) => ({
      title: d.title.trim(),
      estimatedMinutes: Number(d.estimatedMinutes) || 30,
      importance: Number(d.importance) || 3,
      urgency: Number(d.urgency) || 3,
      pinTime: Boolean(d.pinTime),
      pinStartTime: d.pinStartTime || '',
    }))

  return JSON.stringify({
    date,
    workDayStart,
    workDayEnd,
    tasks,
    context: {
      sleepHours: context.sleepHours,
      sleepQuality: context.sleepQuality,
      weatherCondition: context.weatherCondition,
      temperature: context.temperature,
      locationName: context.locationName,
    },
    mealDurations,
  })
}
