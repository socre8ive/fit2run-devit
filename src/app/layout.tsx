import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fit2Run Analytics Dashboard',
  description: 'Professional analytics dashboard for Fit2Run',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}