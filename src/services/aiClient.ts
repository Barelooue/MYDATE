import type { AppSettings } from '@/types'
import { parseAIResponse } from '@/services/aiPrompt'
import {
  callProviderChatCompletion,
  isAiConfigured,
  resolveAiConfig,
  type ChatMessage,
} from '@/services/aiProviders'

export type { ChatMessage }

const MISSING_API_KEY_MSG =
  '请先在「设置 → AI 大模型接口」选择服务商并填写你的 API Key，才能使用 AI 排程与推荐功能。'

export function resolveChatEndpoint(settings: AppSettings): {
  providerLabel: string
  modelName: string
  configured: boolean
} {
  const config = resolveAiConfig(settings)
  return {
    providerLabel: config.providerLabel,
    modelName: config.modelName,
    configured: Boolean(config.apiKey),
  }
}

export async function chatCompletionJson(
  settings: AppSettings,
  messages: ChatMessage[],
  temperature = 0.65,
): Promise<Record<string, unknown>> {
  if (!isAiConfigured(settings)) {
    throw new Error(MISSING_API_KEY_MSG)
  }

  const config = resolveAiConfig(settings)
  const content = await callProviderChatCompletion(config, messages, temperature)
  return parseAIResponse(content) as Record<string, unknown>
}

export { isAiConfigured, MISSING_API_KEY_MSG }

export { testAiConnection } from '@/services/aiProviders'
