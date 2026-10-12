import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthSessionProvider from '@/components/session-provider'

export const metadata: Metadata = {
  title: 'Cafe Campus | Pedidos universitarios',
  description: 'Pide tu comida favorita antes de llegar a la cafeteria del campus.',
  applicationName: 'Café Campus',
  appleWebApp: { capable: true, title: 'Café Campus', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f8f7f3',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  )
}
