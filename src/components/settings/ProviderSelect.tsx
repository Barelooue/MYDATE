import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AI_PROVIDER_PRESETS } from '@/services/aiProviders'
import type { AIProviderId } from '@/types'

interface ProviderSelectProps {
  value: AIProviderId
  onChange: (provider: AIProviderId) => void
}

export function ProviderSelect({ value, onChange }: ProviderSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = AI_PROVIDER_PRESETS.find((p) => p.id === value) ?? AI_PROVIDER_PRESETS[0]

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-white/8',
          'bg-zinc-900 px-3 py-2 text-sm text-white outline-none',
          'focus:border-fuchsia-500/50',
          open && 'border-fuchsia-500/50',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected.label}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-zinc-400 transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {AI_PROVIDER_PRESETS.map((preset) => {
            const active = preset.id === value
            return (
              <li key={preset.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(preset.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                    active
                      ? 'bg-fuchsia-50 font-medium text-fuchsia-700'
                      : 'text-zinc-900 hover:bg-zinc-100',
                  )}
                >
                  <span>{preset.label}</span>
                  {active && <Check className="h-4 w-4 text-fuchsia-600" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
