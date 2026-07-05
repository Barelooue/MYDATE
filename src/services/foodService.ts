import type { AppSettings } from '@/types'
import { chatCompletionJson } from '@/services/aiClient'
import {
  buildNearbyShopsUserPrompt,
  NEARBY_SHOPS_SYSTEM_PROMPT,
  type NearbyShopsUserPayload,
} from '@/services/aiPrompts'

export interface TakeoutShop {
  id: string
  name: string
  rating: number
  distance: string
  recommendDish: string
  whyMatch?: string
}

export interface FetchNearbyShopsInput extends NearbyShopsUserPayload {
  settings: AppSettings
}

const MEAL_LABELS: Record<FetchNearbyShopsInput['mealType'], string> = {
  breakfast: '早餐 / 早市',
  lunch: '午餐 / 午市',
  dinner: '晚餐 / 晚市',
}

function normalizeShops(raw: unknown): TakeoutShop[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 3).map((item, index) => {
    const s = item as Record<string, unknown>
    return {
      id: String(s.id ?? `shop-${index + 1}`),
      name: String(s.name ?? '附近健康餐店'),
      rating: Math.min(5, Math.max(3.5, Number(s.rating) || 4.5)),
      distance: String(s.distance ?? '500m'),
      recommendDish: '',
      whyMatch: undefined,
    }
  })
}

/**
 * 调用用户配置的 AI，结合 GPS、当日排程与本餐药膳处方，生成周边外卖商户推荐
 */
export async function fetchNearbyHealthyShops(
  input: FetchNearbyShopsInput,
): Promise<TakeoutShop[]> {
  const mealLabel = MEAL_LABELS[input.mealType]

  if (!input.prescribedRecipe?.trim()) {
    return []
  }

  try {
    const parsed = await chatCompletionJson(
      input.settings,
      [
        { role: 'system', content: NEARBY_SHOPS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildNearbyShopsUserPrompt({ ...input, mealLabel }),
        },
      ],
      0.7,
    )

    const shops = normalizeShops(parsed.shops)
    if (shops.length > 0) return shops
  } catch (err) {
    console.error('[foodService] AI 商户推荐失败:', err)
  }

  return []
}
