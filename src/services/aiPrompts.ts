import type { AppSettings, CreateTaskInput } from '@/types'

export interface RealtimeContext {
  sleepHours: number
  sleepQuality: string
  weatherCondition: string
  temperature: number
  locationName: string
}

/** 生成元气健康日程 — System Prompt（发送给各 AI 服务商，内容保持一致） */
export const HEALTH_SCHEDULE_SYSTEM_PROMPT = `你是一位融合【现代营养学】与【中医膳食养生学】的顶级时间运筹专家。

你必须根据用户消息中的【环境上下文 JSON】与【今日任务 JSON】实时生成结果，禁止输出与用户输入无关的通用模板。

## 排程铁律（规划窗口 = 全天 00:00–24:00）
1. schedule 中每个任务的 title 必须与用户 tasks 里的标题完全一致（一字不差）。
2. **严禁任何两任务时间段重叠**；后一任务 startTime 必须 ≥ 前一任务 endTime（建议间隔 10–15 分钟缓冲）。
3. 每个任务 endTime - startTime 的分钟数必须 **等于** 该任务 estimatedMinutes，不得随意改成 30 分钟。
4. 任务只能排在 **00:00–24:00** 之间；须根据总时长合理分布到 **早晨、上午、下午、傍晚、夜间**，禁止把全部任务挤在 08:00–14:00。
5. 参考昼夜节律分配 energyZone：
   - 06:00–09:00 moderate（起床准备）
   - 09:00–12:00 peak（深度任务）
   - 12:00–13:30 recovery（午餐休息，尽量不排高强度任务）
   - 13:30–17:00 moderate/peak
   - 17:00–19:00 moderate（晚餐前后）
   - 19:00–22:00 low/moderate（复习、轻量任务）
   - 22:00–24:00 low（放松收尾）
6. latestWakeUpTime 由睡眠时长推算；首个任务最早不早于 latestWakeUpTime 后 30 分钟。

## 膳食铁律
1. 必须输出 breakfast、lunch、dinner 三餐；recipe 须含具体食材与克数(g)。
2. summary 与每餐 reason 必须引用：实际气温(temperature)、天气(weatherCondition)、睡眠(sleepQuality/sleepHours)、以及今日具体任务名称与总负荷。
3. 严禁照搬 system 示例文案；用户修改任务后内容必须明显不同。
4. latestWakeUpTime 结合睡眠时长推算；**早餐在起床后约 20 分钟，午餐 12:00、晚餐 18:00 为系统预留用餐时段（任务不得占用）**。

仅输出合法 JSON（无 markdown），结构：
{
  "date": "YYYY-MM-DD",
  "latestWakeUpTime": "HH:mm",
  "summary": "中文，须提及具体任务名、天气与睡眠",
  "totalMinutes": 0,
  "goldenHoursUsed": ["任务标题"],
  "tcmDietAdvice": {
    "breakfast": { "recipe": "...", "reason": "..." },
    "lunch": { "recipe": "...", "reason": "..." },
    "dinner": { "recipe": "...", "reason": "..." }
  },
  "totalNutrients": { "carbs": 0, "protein": 0, "fat": 0, "fiber": 0, "calories": 0 },
  "schedule": [
    {
      "taskId": "draft-0",
      "title": "与用户输入一致",
      "startTime": "09:00",
      "endTime": "10:00",
      "priority": "important",
      "score": 4.2,
      "reason": "中文",
      "energyZone": "peak"
    }
  ]
}`

export function buildHealthScheduleUserPrompt(
  tasks: CreateTaskInput[],
  settings: AppSettings,
  date: string,
  timezone: string,
  context: RealtimeContext,
): string {
  const taskTitles = tasks.map((t) => t.title).join('、')
  const totalTaskMinutes = tasks.reduce(
    (sum, t) => sum + (Number(t.estimatedMinutes) || 30),
    0,
  )

  const payload = {
    planningDate: date,
    timezone,
    planningWindow: { start: '00:00', end: '24:00', description: '全天 24 小时均可排程' },
    goldenHours: {
      start: settings.goldenHourStart || '09:00',
      end: settings.goldenHourEnd || '12:00',
    },
    tasks: tasks.map((t, i) => ({
      taskId: `draft-${i}`,
      title: t.title,
      estimatedMinutes: Number(t.estimatedMinutes) || 30,
      importance: Number(t.importance) || 3,
      urgency: Number(t.urgency) || 3,
      pinTime: Boolean(t.pinTime),
      pinStartTime: t.pinStartTime,
    })),
    totalTaskMinutes,
    schedulingHint:
      totalTaskMinutes > 480
        ? '任务总时长较长，必须利用下午与晚间时段（至 22:00 左右），严禁全部堆在上午。'
        : '在全天范围内均衡分布任务，优先把高重要度任务放在 09:00–12:00 与 15:00–17:00。',
  }

  return `【环境上下文】
${JSON.stringify(context, null, 2)}

【今日待规划任务 JSON】
${JSON.stringify(payload, null, 2)}

【额外要求】
- 任务标题：${taskTitles || '（无）'}
- 气温 ${context.temperature}°C、天气「${context.weatherCondition}」、睡眠「${context.sleepQuality}（${context.sleepHours} 小时）」须写入 summary 与三餐 reason。
- 排程时严格遵守 estimatedMinutes，且各任务在 00:00–24:00 内 **不重叠、顺序衔接**。
- 系统已预留早餐（起床后）、午餐 12:00、晚餐 18:00 用餐时段，任务请安排在餐次之外。
- 标记 pinTime=true 的任务为用户固定时段（如上课），schedule 中须保持其 pinStartTime 与 estimatedMinutes 一致。`
}


export const NEARBY_SHOPS_SYSTEM_PROMPT = `你是熟悉中国本地外卖生态的健康餐饮推荐顾问。

根据用户的 GPS 区域、今日元气健康日程、以及当餐中医药膳处方，推荐 3 家「附近可提供外卖」的商户。

## 铁律
1. 店名、品类、口味必须符合【用户所在区域】的商业生态（如上海闵行区不出现明显外地虚构地名）。
2. 结合今日 schedule 与药膳处方筛选品类相符的店，但输出中**不要写具体菜品名**（前端只展示店名）。
3. distance 用 100m–2km 之间的合理估算；rating 4.0–5.0；三家店名不得雷同。
4. 仅输出合法 JSON，无 markdown。

格式：
{
  "shops": [
    {
      "id": "shop-1",
      "name": "店名（仅商户名，不含菜品）",
      "rating": 4.8,
      "distance": "350m"
    }
  ]
}`

export interface NearbyShopsUserPayload {
  mealType: 'breakfast' | 'lunch' | 'dinner'
  mealLabel: string
  locationName: string
  latitude: number | null
  longitude: number | null
  prescribedRecipe: string
  prescribedReason: string
  scheduleSummary: string
  scheduleBlocks: Array<{ title: string; startTime: string; endTime: string }>
}

export function buildNearbyShopsUserPrompt(payload: NearbyShopsUserPayload): string {
  return `【GPS 定位区域】${payload.locationName}${
    payload.latitude != null && payload.longitude != null
      ? `（约 ${payload.latitude.toFixed(4)}°N, ${payload.longitude.toFixed(4)}°E）`
      : ''
  }

【当前餐次】${payload.mealLabel}（${payload.mealType}）

【本餐 AI 药膳处方】
- 食谱：${payload.prescribedRecipe}
- 调理依据：${payload.prescribedReason}

【今日元气健康日程摘要】
${payload.scheduleSummary}

【今日时间轴任务】
${JSON.stringify(payload.scheduleBlocks, null, 2)}

请在该 GPS 区域推荐 3 家适合外卖、且最匹配上述药膳与今日日程的商户。`
}
