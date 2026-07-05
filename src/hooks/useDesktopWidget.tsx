import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  buildWidgetPayload,
  copyDocumentStyles,
  isDocumentPipSupported,
  publishWidgetPayload,
  readWidgetPrefs,
} from '@/lib/widgetBridge'
import { DesktopWidgetPanel } from '@/components/widget/DesktopWidgetPanel'
import { useAppStore } from '@/stores/appStore'

function widgetPopupUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}/widget.html`
}

export function useDesktopWidget() {
  const [open, setOpen] = useState(false)
  const pipWindowRef = useRef<Window | null>(null)
  const pipRootRef = useRef<Root | null>(null)
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<number | null>(null)

  const syncPayload = useCallback(() => {
    const state = useAppStore.getState()
    publishWidgetPayload(
      buildWidgetPayload({
        selectedDate: state.selectedDate,
        lastScheduleResult: state.lastScheduleResult,
        tasks: state.tasks,
      }),
    )
  }, [])

  const teardownPip = useCallback(() => {
    pipRootRef.current?.unmount()
    pipRootRef.current = null
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close()
    }
    pipWindowRef.current = null
  }, [])

  const close = useCallback(() => {
    teardownPip()
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    popupRef.current = null
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    setOpen(false)
  }, [teardownPip])

  const openWidget = useCallback(async () => {
    syncPayload()

    if (isDocumentPipSupported()) {
      try {
        const pipApi = window.documentPictureInPicture!
        if (pipApi.window && !pipApi.window.closed) {
          pipApi.window.focus()
          setOpen(true)
          return
        }

        const pipWindow = await pipApi.requestWindow({
          width: 300,
          height: 420,
        })

        pipWindowRef.current = pipWindow
        copyDocumentStyles(pipWindow)

        const doc = pipWindow.document
        doc.documentElement.style.background = 'transparent'
        doc.body.style.margin = '0'
        doc.body.style.background = 'transparent'
        doc.body.style.overflow = 'hidden'

        const mount = doc.createElement('div')
        mount.style.width = '100%'
        mount.style.height = '100%'
        mount.style.padding = '8px'
        mount.style.boxSizing = 'border-box'
        doc.body.appendChild(mount)

        const root = createRoot(mount)
        pipRootRef.current = root
        root.render(
          <DesktopWidgetPanel
            mode="pip"
            onClose={() => {
              close()
            }}
          />,
        )

        pipWindow.addEventListener('pagehide', () => {
          pipRootRef.current?.unmount()
          pipRootRef.current = null
          pipWindowRef.current = null
          setOpen(false)
        })

        setOpen(true)
        return
      } catch (err) {
        console.warn('Document PiP 打开失败，改用弹窗模式', err)
      }
    }

    const popup = window.open(
      widgetPopupUrl(),
      'mydate-desktop-widget',
      'width=300,height=440,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no',
    )

    if (!popup) {
      throw new Error('无法打开桌面视图：请允许本站弹出窗口')
    }

    popupRef.current = popup
    pollRef.current = window.setInterval(() => {
      if (popup.closed) {
        if (pollRef.current) window.clearInterval(pollRef.current)
        pollRef.current = null
        popupRef.current = null
        setOpen(false)
      }
    }, 800)

    setOpen(true)
  }, [close, syncPayload])

  const toggle = useCallback(async () => {
    if (open) {
      close()
      return
    }
    await openWidget()
  }, [open, close, openWidget])

  useEffect(() => {
    const onUnload = () => {
      if (!readWidgetPrefs().keepOnDesktop) close()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [close])

  return {
    open,
    toggle,
    close,
    openWidget,
    syncPayload,
    pipSupported: isDocumentPipSupported(),
  }
}
