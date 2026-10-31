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
        {children}
        <GlobalParkingCapture />
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }) }" }} />
      </body>
    </html>
  )
}
