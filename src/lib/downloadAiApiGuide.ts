import { AI_API_GUIDE_FOOTER, AI_API_GUIDE_SECTIONS, AI_API_GUIDE_TITLE } from '@/lib/aiApiGuideContent'

/**
 * 在浏览器内生成并下载 PDF 操作手册（不依赖 public 静态文件，支持中文）
 */
export async function downloadAiApiGuidePdf(): Promise<void> {
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;padding:40px;background:#fff;color:#111;font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:14px;line-height:1.6;'
  container.innerHTML = buildGuideHtml()
  document.body.appendChild(container)

  try {
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import('jspdf'),
      import('html2canvas').then((m) => m.default),
    ])

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    const contentWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * contentWidth) / canvas.width

    let heightLeft = imgHeight
    let position = margin

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2
    }

    pdf.save('MyDate-AI-API-获取手册.pdf')
  } catch {
    // 降级：打开静态 PDF 或 HTML
    const link = document.createElement('a')
    link.href = `${import.meta.env.BASE_URL}docs/ai-api-setup-guide.pdf`
    link.download = 'MyDate-AI-API-获取手册.pdf'
    link.click()
  } finally {
    container.remove()
  }
}

function buildGuideHtml(): string {
  const sections = AI_API_GUIDE_SECTIONS.map(
    (s) => `
    <section style="margin-bottom:24px;">
      <h2 style="color:#6d28d9;font-size:18px;margin:0 0 8px;">${s.provider}</h2>
      <p style="margin:4px 0;color:#444;font-size:13px;">申请地址：<a href="${s.website}">${s.website}</a></p>
      <p style="margin:4px 0;color:#444;font-size:13px;">Key 格式：${s.keyFormat}</p>
      <p style="margin:12px 0 6px;font-weight:600;">操作步骤</p>
      <ol style="margin:0;padding-left:20px;">
        ${s.steps.map((step) => `<li style="margin-bottom:6px;">${step}</li>`).join('')}
      </ol>
      <p style="margin:12px 0 6px;font-weight:600;">备注</p>
      <ul style="margin:0;padding-left:20px;color:#555;">
        ${s.notes.map((n) => `<li style="margin-bottom:4px;">${n}</li>`).join('')}
      </ul>
    </section>`,
  ).join('')

  return `
    <h1 style="text-align:center;font-size:22px;margin:0 0 12px;">${AI_API_GUIDE_TITLE}</h1>
    <p style="text-align:center;color:#666;font-size:13px;margin-bottom:28px;">
      本手册说明如何获取并配置 DeepSeek、Gemini、Claude、OpenAI 的 API Key，供 My Date 开源版使用。
    </p>
    ${sections}
    <section>
      <h2 style="font-size:16px;margin-bottom:8px;">通用说明</h2>
      <ul style="padding-left:20px;color:#444;">
        ${AI_API_GUIDE_FOOTER.map((f) => `<li style="margin-bottom:6px;">${f}</li>`).join('')}
      </ul>
    </section>
  `
}
