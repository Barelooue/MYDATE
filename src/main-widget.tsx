import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DesktopWidgetPage } from '@/pages/DesktopWidgetPage'
import './index.css'

document.documentElement.style.background = 'transparent'
document.body.style.background = 'transparent'
document.body.style.margin = '0'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopWidgetPage />
  </StrictMode>,
)
