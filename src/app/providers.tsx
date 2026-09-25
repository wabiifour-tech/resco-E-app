'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { PwaRegistrar } from '@/components/pwa/pwa-registrar'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  )
  // Ensure dark/light theme defaults to light
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])
  return (
    <QueryClientProvider client={client}>
      {children}
      <PwaRegistrar />
      <SonnerToaster richColors position="top-right" />
      <Toaster />
    </QueryClientProvider>
  )
}
