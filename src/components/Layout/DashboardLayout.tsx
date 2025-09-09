'use client'

import Header from './Header'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Page content */}
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}