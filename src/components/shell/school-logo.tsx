'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { GraduationCap } from 'lucide-react'

type Branding = {
  schoolName: string
  address: string
  motto: string
  logoUrl: string
  principalName: string | null
}

/**
 * Renders the school logo (from the public /api/branding endpoint, which reads
 * the principal-configured logoDataUrl from settings, falling back to the
 * static /school-logo.png). Falls back to a GraduationCap icon if the image
 * fails to load. Used in the app shell sidebar, mobile header, and footer.
 */
export function SchoolLogo({ className = 'h-9 w-9' }: { className?: string }) {
  const [errored, setErrored] = useState(false)
  const { data: branding } = useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: () => api.get<Branding>('/api/branding'),
    staleTime: 5 * 60 * 1000,
  })

  const logoUrl = branding?.logoUrl ?? '/school-logo.png'

  if (errored) {
    return (
      <div className={`${className} rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0`}>
        <GraduationCap className="h-1/2 w-1/2" />
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt="School logo"
      className={`${className} rounded-full object-contain bg-white shrink-0`}
      onError={() => setErrored(true)}
    />
  )
}
