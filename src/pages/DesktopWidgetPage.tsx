import { useCallback } from 'react'
import { DesktopWidgetPanel } from '@/components/widget/DesktopWidgetPanel'

export function DesktopWidgetPage() {
  const handleClose = useCallback(() => {
    window.close()
  }, [])

  return (
    <div className="h-full w-full bg-transparent p-2 box-border">
      <DesktopWidgetPanel mode="popup" onClose={handleClose} />
    </div>
  )
}
