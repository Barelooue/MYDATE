import type { AIProviderId, AISettings, AppSettings } from '@/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIProviderPreset {
  id: AIProviderId
  label: string
  defaultBaseUrl: string
  defaultModel: string
  apiKeyPlaceholder: string
  docsHint: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyPlaceholder: 'sk-...',
    docsHint: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    apiKeyPlaceholder: 'AIza...',
    docsHint: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    apiKeyPlaceholder: 'sk-ant-...',
    docsHint: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'codex',
    label: 'OpenAI / Codex',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyPlaceholder: 'sk-...',
    docsHint: 'https://platform.openai.com/api-keys',
  },
]

const PRESET_BY_ID = Object.fromEntries(
  AI_PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
) as Record<AIProviderId, AIProviderPreset>

export interface ResolvedAiConfig {
  provider: AIProviderId
  providerLabel: string
  apiKey: string
  baseUrl: string
  modelName: string
}

export function getProviderPreset(provider: AIProviderId): AIProviderPreset {
  return PRESET_BY_ID[provider] ?? PRESET_BY_ID.deepseek
}

export function inferProviderFromLegacySettings(
  baseUrl?: string,
  modelName?: string,
): AIProviderId {
  const url = (baseUrl ?? '').toLowerCase()
  const model = (modelName ?? '').toLowerCase()
  if (url.includes('generativelanguage.googleapis.com') || model.includes('gemini')) {
    return 'gemini'
  }
  if (url.includes('anthropic.com') || model.includes('claude')) {
    return 'claude'
  }
  if (url.includes('openai.com') || model.includes('gpt') || model.includes('codex')) {
    return 'codex'
  }
  return 'deepseek'
}

export function resolveAiConfig(settings: AppSettings): ResolvedAiConfig {
  const ai = settings.ai
  const provider = ai?.provider ?? inferProviderFromLegacySettings(ai?.baseUrl, ai?.modelName)
  const preset = getProviderPreset(provider)
  return {
    provider,
    providerLabel: preset.label,
    apiKey: ai?.apiKey?.trim() ?? '',
    baseUrl: (ai?.baseUrl?.trim() || preset.defaultBaseUrl).replace(/\/+$/, ''),
    modelName: ai?.modelName?.trim() || preset.defaultModel,
  }
}

export function isAiConfigured(settings: AppSettings): boolean {
  return Boolean(resolveAiConfig(settings).apiKey)
}

export function getDefaultAiSettingsForProvider(provider: AIProviderId): AISettings {
  const preset = getProviderPreset(provider)
  return {
    provider,
    apiKey: '',
    baseUrl: preset.defaultBaseUrl,
    modelName: preset.defaultModel,
  }
}

function splitMessages(messages: ChatMessage[]): {
  system: string
  conversation: ChatMessage[]
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const conversation = messages.filter((m) => m.role !== 'system')
  return { system, conversation }
}

function extractErrorMessage(status: number, errText: string): string {
  const trimmed = errText.trim()
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<meta charset')
  ) {
    return `AI 请求失败 (${status})：服务器返回了网页而非 API 数据，请检查 Base URL 是否正确。`
  }
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>
    const err = json.error as Record<string, unknown> | undefined
    const msg =
      (err?.message as string) ||
      (json.message as string) ||
      (json.error as string) ||
      trimmed
    return `AI 请求失败 (${status}): ${String(msg).slice(0, 200)}`
  } catch {
    return `AI 请求失败 (${status})${trimmed ? `: ${trimmed.slice(0, 120)}` : ''}`
  }
}

async function readResponseText(response: Response): Promise<string> {
  return response.text().catch(() => '')
}

function buildOpenAiChatUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
}

async function callOpenAiCompatible(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  const response = await fetch(buildOpenAiChatUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages,
      temperature,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error(extractErrorMessage(response.status, await readResponseText(response)))
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回内容为空')
  return content
}

async function callClaude(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  const { system, conversation } = splitMessages(messages)
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.modelName,
      max_tokens: 8192,
      system: system || undefined,
      messages: conversation.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      temperature,
    }),
  })

  if (!response.ok) {
    throw new Error(extractErrorMessage(response.status, await readResponseText(response)))
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const content = data.content?.find((part) => part.type === 'text')?.text
  if (!content) throw new Error('AI 返回内容为空')
  return content
}

async function callGemini(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  const { system, conversation } = splitMessages(messages)
  const userText = conversation
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n')

  const url = `${config.baseUrl}/models/${encodeURIComponent(config.modelName)}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(extractErrorMessage(response.status, await readResponseText(response)))
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('AI 返回内容为空')
  return content
}

/** 向不同服务商发送同一套 messages，仅请求/响应格式按厂商适配 */
export async function callProviderChatCompletion(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  switch (config.provider) {
    case 'claude':
      return callClaude(config, messages, temperature)
    case 'gemini':
      return callGemini(config, messages, temperature)
    case 'deepseek':
    case 'codex':
    default:
      return callOpenAiCompatible(config, messages, temperature)
  }
}

const TEST_PROMPT = '请只回复一个 JSON 对象：{"status":"ok"}，不要其他文字。'

/** 验证当前配置能否连通所选 AI 服务商 */
export async function testAiConnection(settings: AppSettings): Promise<{
  ok: boolean
  message: string
  providerLabel: string
  modelName: string
}> {
  const config = resolveAiConfig(settings)
  if (!config.apiKey) {
    return {
      ok: false,
      message: '请先填写 API Key',
      providerLabel: config.providerLabel,
      modelName: config.modelName,
    }
  }

  try {
    const content = await callProviderChatCompletion(
      config,
      [{ role: 'user', content: TEST_PROMPT }],
      0,
    )
    if (!content.trim()) {
      return {
        ok: false,
        message: 'AI 返回内容为空，请检查模型名称是否正确',
        providerLabel: config.providerLabel,
        modelName: config.modelName,
      }
    }
    return {
      ok: true,
      message: `连接成功！当前使用 ${config.providerLabel} · ${config.modelName}`,
      providerLabel: config.providerLabel,
      modelName: config.modelName,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败'
    return {
      ok: false,
      message: msg,
      providerLabel: config.providerLabel,
      modelName: config.modelName,
    }
  }
}
