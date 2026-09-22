'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Construction } from 'lucide-react'

export function PlaceholderView({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
      </div>
      <Card>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
          <Construction className="h-8 w-8" />
          <p className="text-sm">This module is being prepared.</p>
        </CardContent>
      </Card>
    </div>
  )
}
