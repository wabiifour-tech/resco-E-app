'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Download, Share, Plus, CheckCircle2 } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectIos(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

/**
 * Install / Download button for the PWA.
 *  - Android (Chrome/Edge): captures `beforeinstallprompt` and triggers the
 *    native install dialog when clicked.
 *  - iOS (Safari): no beforeinstallprompt support, so the button opens a modal
 *    with the "Share → Add to Home Screen" steps.
 *  - Already installed (display-mode: standalone): shows an "Installed" badge.
 */
export function InstallAppButton({
  variant = 'outline',
  size = 'sm',
  className,
  label = 'Install App',
}: {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  label?: string
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosModal, setShowIosModal] = useState(false)
  const [showGenericModal, setShowGenericModal] = useState(false)
  const [installed, setInstalled] = useState(false)

  const onBIP = useCallback((e: Event) => {
    e.preventDefault()
    setDeferred(e as BeforeInstallPromptEvent)
  }, [])
  const onInstalled = useCallback(() => {
    setDeferred(null)
    setInstalled(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [onBIP, onInstalled])

  function onInstall() {
    if (isStandalonePwa()) return
    if (detectIos()) {
      setShowIosModal(true)
      return
    }
    if (deferred) {
      deferred.prompt().then(() => deferred.userChoice).then(() => setDeferred(null))
      return
    }
    setShowGenericModal(true)
  }

  if (installed) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-emerald-700 ${className ?? ''}`}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Installed
      </span>
    )
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={onInstall}>
        <Download className="h-4 w-4" /> {label}
      </Button>

      {/* iOS instructions */}
      <Dialog open={showIosModal} onOpenChange={setShowIosModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install RESCO eCard on iPhone/iPad</DialogTitle>
            <DialogDescription>
              iOS Safari doesn&apos;t support a one-tap install. Add the app to your Home Screen:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground/90 list-none pl-0">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
              <span>
                Tap the <strong>Share</strong> button in Safari&apos;s toolbar
                <Share className="inline h-4 w-4 mx-1 align-text-bottom" />
                (square with an up arrow).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
              <span>
                Scroll and tap <strong>Add to Home Screen</strong>
                <Plus className="inline h-4 w-4 mx-1 align-text-bottom" />.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
              <span>Tap <strong>Add</strong> — the RESCO eCard icon appears on your Home Screen.</span>
            </li>
          </ol>
          <DialogFooter>
            <Button onClick={() => setShowIosModal(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generic instructions (desktop / unsupported browsers) */}
      <Dialog open={showGenericModal} onOpenChange={setShowGenericModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install RESCO eCard</DialogTitle>
            <DialogDescription>
              Install this app from your browser menu so it opens like a native app (full-screen, with the school logo).
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-foreground/90 list-disc pl-5">
            <li><strong>Chrome / Edge (Android &amp; desktop):</strong> open the browser menu (⋮) → <em>Install app</em> / <em>Install RESCO eCard</em>.</li>
            <li><strong>iPhone / iPad (Safari):</strong> tap <em>Share</em> → <em>Add to Home Screen</em>.</li>
          </ul>
          <DialogFooter>
            <Button onClick={() => setShowGenericModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
