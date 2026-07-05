/** AI API 获取手册正文（用于生成 PDF） */
export const AI_API_GUIDE_TITLE = 'My Date — AI API Key 获取操作手册'

export interface AiGuideSection {
  provider: string
  website: string
  steps: string[]
  keyFormat: string
  notes: string[]
}

export const AI_API_GUIDE_SECTIONS: AiGuideSection[] = [
  {
    provider: 'DeepSeek',
    website: 'https://platform.deepseek.com/api_keys',
    keyFormat: 'sk- 开头',
    steps: [
      '打开 https://platform.deepseek.com 并注册 / 登录账号。',
      '进入左侧「API Keys」或「API 密钥」页面。',
      '点击「创建 API Key」，按提示完成验证。',
      '复制生成的 Key（只显示一次，请立即保存）。',
      '在本应用「设置 → AI 大模型接口」中选择「DeepSeek」，粘贴 Key 后点击「测试连接」。',
    ],
    notes: [
      'DeepSeek 使用 OpenAI 兼容接口，默认 Base URL：https://api.deepseek.com/v1',
      '推荐模型：deepseek-chat',
    ],
  },
  {
    provider: 'Google Gemini',
    website: 'https://aistudio.google.com/apikey',
    keyFormat: 'AIza 开头',
    steps: [
      '打开 https://aistudio.google.com 并使用 Google 账号登录。',
      '点击左侧或顶部的「Get API key / 获取 API 密钥」。',
      '选择「Create API key in new project」或已有项目。',
      '复制生成的 API Key。',
      '在本应用中选择「Google Gemini」，粘贴 Key 并测试连接。',
    ],
    notes: [
      '默认 Base URL：https://generativelanguage.googleapis.com/v1beta',
      '推荐模型：gemini-2.0-flash（可在设置中改为 gemini-1.5-flash 等）',
      '若浏览器直连报 CORS 错误，请检查 Google Cloud 控制台是否启用了 Generative Language API。',
    ],
  },
  {
    provider: 'Anthropic Claude',
    website: 'https://console.anthropic.com/settings/keys',
    keyFormat: 'sk-ant- 开头',
    steps: [
      '打开 https://console.anthropic.com 并注册 / 登录。',
      '进入 Settings → API Keys。',
      '点击「Create Key」，命名后创建。',
      '复制 Key 并妥善保存。',
      '在本应用中选择「Anthropic Claude」，粘贴 Key 并测试连接。',
    ],
    notes: [
      '默认 Base URL：https://api.anthropic.com/v1',
      '推荐模型：claude-sonnet-4-20250514（可按账号权限修改）',
      'Claude API 需账户有余额或免费额度。',
    ],
  },
  {
    provider: 'OpenAI / Codex',
    website: 'https://platform.openai.com/api-keys',
    keyFormat: 'sk- 开头（OpenAI 格式）',
    steps: [
      '打开 https://platform.openai.com 并登录。',
      '进入 API keys 页面（Settings → API keys）。',
      '点击「Create new secret key」，命名后创建。',
      '复制 Key（仅显示一次）。',
      '在本应用中选择「OpenAI / Codex」，粘贴 Key 并测试连接。',
    ],
    notes: [
      '默认 Base URL：https://api.openai.com/v1',
      '推荐模型：gpt-4o（可按订阅改为 gpt-4o-mini 等）',
      'Codex 能力通过 OpenAI API 的代码/对话模型提供，使用同一套 Key。',
    ],
  },
]

export const AI_API_GUIDE_FOOTER = [
  '安全提示：API Key 仅保存在您本机浏览器的本地存储中，不会上传至 My Date 服务器。',
  '配置完成后，请在设置页点击「测试连接」确认所选服务商可用，再前往 AI 智能规划生成日程。',
  '所有 AI 功能（排程、药膳、外卖推荐）使用同一套提示词，仅请求格式按厂商自动适配。',
]
