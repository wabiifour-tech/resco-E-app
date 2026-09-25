import type { MetadataRoute } from 'next'

// PWA web manifest. Next.js auto-serves this at /manifest.webmanifest and
// auto-links it in <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RESCO eCard — Redeemer's Schools and College",
    short_name: 'RESCO eCard',
    description:
      "Electronic report-card and academic result management system for Redeemer's Schools and College, Owotoro.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
