import type { Metadata, Viewport } from 'next'
import './globals.css'
import GlobalParkingCapture from '@/components/GlobalParkingCapture'

export const metadata: Metadata = {
  metadataBase: new URL('https://notelyapp.com'),
  title: 'Notely — Just Write',
  description: 'Personal note taking. Just write.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Notely' },
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg', apple: '/icon.svg' },
  other: { 'mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f0e8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: "try { const t = localStorage.getItem('notely-theme'); const colors = { warm:'#f5f0e8', mono:'#ffffff', midnight:'#171820', sage:'#edf1e8', rose:'#f7edf0', ocean:'#eaf2f4' }; if (t && colors[t]) { document.documentElement.dataset.theme = t; document.querySelector('meta[name=theme-color]')?.setAttribute('content', colors[t]) } } catch {}" }} />
        {children}
        <GlobalParkingCapture />
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator) { window.addEventListener('load', async () => { try { await navigator.serviceWorker.register('/sw.js'); const cacheAssets = () => { const urls = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => { try { const url = new URL(name); return url.origin === location.origin && url.pathname.startsWith('/_next/static/') } catch { return false } }); navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_APP_ASSETS', urls }) }; if (navigator.serviceWorker.controller) cacheAssets(); else navigator.serviceWorker.addEventListener('controllerchange', cacheAssets, { once: true }) } catch {} }) }" }} />
      </body>
    </html>
  )
}
