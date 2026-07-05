/**
 * 生成 public/docs/ai-api-setup-guide.pdf
 * 运行：node scripts/generate-ai-api-guide.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'docs')
const outFile = path.join(outDir, 'ai-api-setup-guide.pdf')

const sections = [
  {
    provider: 'DeepSeek',
    website: 'https://platform.deepseek.com/api_keys',
    keyFormat: 'sk- 开头',
    steps: [
      '打开 platform.deepseek.com 并注册 / 登录。',
      '进入 API Keys 页面，点击创建 API Key。',
      '复制 Key，在本应用设置中选择 DeepSeek 并粘贴。',
    ],
    notes: ['Base URL: https://api.deepseek.com/v1', '模型: deepseek-chat'],
  },
  {
    provider: 'Google Gemini',
    website: 'https://aistudio.google.com/apikey',
    keyFormat: 'AIza 开头',
    steps: [
      '打开 aistudio.google.com 并登录 Google 账号。',
      '点击 Get API key，创建并复制密钥。',
      '在本应用设置中选择 Google Gemini 并粘贴。',
    ],
    notes: [
      'Base URL: https://generativelanguage.googleapis.com/v1beta',
      '模型: gemini-2.0-flash',
    ],
  },
  {
    provider: 'Anthropic Claude',
    website: 'https://console.anthropic.com/settings/keys',
    keyFormat: 'sk-ant- 开头',
    steps: [
      '打开 console.anthropic.com 并登录。',
      'Settings → API Keys → Create Key。',
      '复制 Key，在本应用设置中选择 Anthropic Claude 并粘贴。',
    ],
    notes: ['Base URL: https://api.anthropic.com/v1', '模型: claude-sonnet-4-20250514'],
  },
  {
    provider: 'OpenAI / Codex',
    website: 'https://platform.openai.com/api-keys',
    keyFormat: 'sk- 开头',
    steps: [
      '打开 platform.openai.com 并登录。',
      'API keys → Create new secret key。',
      '复制 Key，在本应用设置中选择 OpenAI / Codex 并粘贴。',
    ],
    notes: ['Base URL: https://api.openai.com/v1', '模型: gpt-4o'],
  },
]

fs.mkdirSync(outDir, { recursive: true })

const doc = new PDFDocument({ margin: 50, size: 'A4' })
const stream = fs.createWriteStream(outFile)
doc.pipe(stream)

doc.fontSize(20).text('My Date — AI API Key 获取操作手册', { align: 'center' })
doc.moveDown()
doc.fontSize(11).fillColor('#444').text(
  '本手册说明如何为 My Date 开源版获取并配置 DeepSeek、Gemini、Claude、OpenAI 的 API Key。',
  { align: 'center' },
)
doc.moveDown(1.5)
doc.fillColor('#000')

for (const section of sections) {
  doc.fontSize(14).fillColor('#6d28d9').text(section.provider)
  doc.fontSize(10).fillColor('#333').text(`申请地址：${section.website}`)
  doc.text(`Key 格式：${section.keyFormat}`)
  doc.moveDown(0.3)
  doc.fontSize(11).fillColor('#000').text('操作步骤：')
  section.steps.forEach((step, i) => {
    doc.fontSize(10).text(`  ${i + 1}. ${step}`)
  })
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#555').text('备注：')
  section.notes.forEach((note) => doc.text(`  • ${note}`))
  doc.moveDown(1.2)
}

doc.fontSize(11).fillColor('#000').text('通用说明', { underline: true })
doc.moveDown(0.3)
doc.fontSize(10).text('• API Key 仅保存在本机浏览器，不会上传到任何服务器。')
doc.text('• 配置后请在设置页点击「测试连接」验证。')
doc.text('• 排程、药膳、外卖推荐使用同一套提示词，仅请求格式按厂商适配。')

doc.end()

stream.on('finish', () => {
  console.log(`已生成：${outFile}`)
})
