import { useEffect, useMemo, useState } from 'react'
import { X, Pin, PinOff } from 'lucide-react'
import { cn, parseTimeToMinutes } from '@/lib/utils'
import {
  readWidgetPayload,
  readWidgetPrefs,
  subscribeWidgetPayload,
  writeWidgetPrefs,
  type WidgetBlock,
  type WidgetPayload,
} from '@/lib/widgetBridge'

function isCurrentBlock(block: WidgetBlock, nowMinutes: number): boolean {
  const start = parseTimeToMinutes(block.startTime)
  const end = parseTimeToMinutes(block.endTime)
  return nowMinutes >= start && nowMinutes < end
}

const kindStyles: Record<WidgetBlock['kind'], string> = {
  meal: 'border-amber-600/35 bg-amber-50/55',
  pinned: 'border-violet-600/40 border-dashed bg-violet-50/50',
  task: 'border-black/10 bg-white/45',
}

interface DesktopWidgetPanelProps {
  mode: 'pip' | 'popup' | 'embedded'
  onClose?: () => void
}

export function DesktopWidgetPanel({ mode, onClose }: DesktopWidgetPanelProps) {
  const [payload, setPayload] = useState<WidgetPayload | null>(() => readWidgetPayload())
  const [keepOnDesktop, setKeepOnDesktop] = useState(() => readWidgetPrefs().keepOnDesktop)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => subscribeWidgetPayload(setPayload), [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const blocks = payload?.blocks ?? []

  const nextBlockId = useMemo(() => {
    for (const b of blocks) {
      if (parseTimeToMinutes(b.startTime) > nowMinutes) return b.id
    }
    return null
  }, [blocks, nowMinutes])

  function handleClose() {
    if (!keepOnDesktop) writeWidgetPrefs({ keepOnDesktop: false })
    onClose?.()
  }

  function toggleKeep() {
    const next = !keepOnDesktop
    setKeepOnDesktop(next)
    writeWidgetPrefs({ keepOnDesktop: next })
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-xl border border-black/10 shadow-lg',
        'bg-[rgba(255,255,255,0.32)] backdrop-blur-md',
        mode === 'pip' && 'rounded-lg',
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-black">今日日程</p>
          <p className="truncate text-[10px] text-zinc-800">
            {payload?.dateLabel ?? '暂无日期'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={keepOnDesktop ? '已标记保留在桌面' : '保留在桌面（关闭主页面后仍可手动打开）'}
            onClick={toggleKeep}
            className={cn(
              'rounded-md p-1 transition',
              keepOnDesktop
                ? 'bg-fuchsia-200/80 text-fuchsia-900'
                : 'text-zinc-700 hover:bg-black/8 hover:text-black',
            )}
          >
            {keepOnDesktop ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              type="button"
              title="关闭桌面视图"
              onClick={handleClose}
              className="rounded-md p-1 text-zinc-700 transition hover:bg-red-100/80 hover:text-red-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {blocks.length === 0 ? (
          <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-zinc-800">
            暂无日程。请先在 AI 智能规划中生成，或同步已排程任务。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {blocks.map((block) => {
              const current = isCurrentBlock(block, nowMinutes)
              const upcoming = block.id === nextBlockId
              return (
                <li
                  key={block.id}
                  className={cn(
                    'rounded-lg border px-2 py-1.5',
                    kindStyles[block.kind],
                    current && 'ring-1 ring-emerald-600/70',
                    upcoming && !current && 'ring-1 ring-black/15',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        'line-clamp-2 text-[11px] font-semibold leading-snug text-black',
                        current && 'text-emerald-950',
                      )}
                    >
                      {block.title}
                    </p>
                    <span className="shrink-0 text-[9px] tabular-nums font-medium text-zinc-900">
                      {block.startTime}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[9px] text-zinc-800">
                    {block.startTime} – {block.endTime}
                    {current && (
                      <span className="ml-1 font-medium text-emerald-800">进行中</span>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {payload?.summary && (
        <p className="shrink-0 border-t border-black/10 px-3 py-1.5 text-[9px] leading-snug text-zinc-900 line-clamp-2">
          {payload.summary}
        </p>
      )}

      {mode !== 'embedded' && (
        <footer className="shrink-0 border-t border-black/10 px-3 py-1.5 text-[9px] text-zinc-700">
          {keepOnDesktop ? '已保留：可随时重新打开桌面视图' : '可拖动窗口位置 · 点击 × 关闭'}
        </footer>
      )}
    </div>
  )
}
