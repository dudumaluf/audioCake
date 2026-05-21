import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AudioCake',
  description:
    'A local-first, browser-based mini-DAW for recording, layering, and exporting music from Roland Aira Compacts and other USB audio sources.',
  applicationName: 'AudioCake',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex h-full min-h-full flex-col overflow-hidden">
        <TooltipProvider delay={200}>
          {children}
          <Toaster position="bottom-right" />
          <ServiceWorkerRegister />
        </TooltipProvider>
      </body>
    </html>
  )
}
