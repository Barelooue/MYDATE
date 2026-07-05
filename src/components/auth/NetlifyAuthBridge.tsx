import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setNetlifyAuthSuccessHandler } from '@/lib/netlifyIdentityAuth'

/** Wires Netlify Identity login success to React Router navigation. */
export function NetlifyAuthBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    setNetlifyAuthSuccessHandler(() => {
      navigate('/app', { replace: true })
    })
    return () => setNetlifyAuthSuccessHandler(null)
  }, [navigate])

  return null
}
