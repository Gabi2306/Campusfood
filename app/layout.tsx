import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cafe Campus | Pedidos universitarios',
  description: 'Pide tu comida favorita antes de llegar a la cafeteria del campus.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f8f7f3',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}
