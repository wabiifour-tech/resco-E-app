'use client'
import { useEffect } from 'react'

/**
 * Registers the service worker (/sw.js) so the app is installable as a PWA
 * (Chrome's installability criterion). Registered only in production to avoid
 * interfering with HMR in dev.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Non-fatal: the app still works without the SW; it just won't be installable.
        console.warn('SW registration failed', err)
      })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}
