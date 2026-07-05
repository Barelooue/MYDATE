import { useState } from 'react'
import {
  getSavedQWeatherHost,
  saveQWeatherHost,
  getQWeatherSetupHint,
} from '@/services/weatherService'

interface QWeatherHostSetupProps {
  onSaved?: () => void
}

export function QWeatherHostSetup({ onSaved }: QWeatherHostSetupProps) {
  const [host, setHost] = useState(getSavedQWeatherHost())
  const [saved, setSaved] = useState(false)

  function handleSave() {
    saveQWeatherHost(host)
    setSaved(true)
    onSaved?.()
    setTimeout(() => setSaved(false), 2000)
  }

  const envLine = host.trim()
    ? `VITE_QWEATHER_PROXY_TARGET=https://${host.trim().replace(/^https?:\/\//, '')}`
    : 'VITE_QWEATHER_PROXY_TARGET=https://你的Host.qweatherapi.com'

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-100/90 space-y-2">
      <p>{getQWeatherSetupHint()}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="xxx.qweatherapi.com"
          className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white outline-none focus:border-sky-500/50"
        />
        <button
          type="button"
          onClick={handleSave}
          className="shrink-0 rounded-md bg-sky-600 px-3 py-1 text-white hover:bg-sky-500"
        >
          {saved ? '已保存' : '保存'}
        </button>
      </div>
      <p className="text-zinc-400">
        点「保存」后<strong className="text-amber-200">当前浏览器立即生效</strong>。若需固化到部署包，把下面一行写入{' '}
        <code className="text-amber-200">
          {import.meta.env.DEV ? '.env.local' : '.env.production.local'}
        </code>{' '}
        后{import.meta.env.DEV ? '重启 npm run dev' : '重新 npm run build'}：
      </p>
      <code className="block break-all rounded bg-black/40 px-2 py-1 text-amber-200">{envLine}</code>
    </div>
  )
}
