'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import SortableTable from '@/components/UI/SortableTable'

interface SoLinkStats {
  total_cameras: number
  line_crossing_cameras: number
  active_locations: number
}

interface StoreLineEvents {
  store_name: string
  today: number
  yesterday: number
  week: number
  month: number
}

export default function SoLinkDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SoLinkStats | null>(null)
  const [storeEvents, setStoreEvents] = useState<StoreLineEvents[]>([])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/solink-stats')
      const data = await response.json()
      setStats(data.stats)
      setStoreEvents(data.storeEvents)
    } catch (error) {
      console.error('Error fetching SoLink data:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'store_name', label: 'Store', sortable: true },
    { key: 'today', label: 'Today', sortable: true, format: (value: any) => value.toLocaleString() },
    { key: 'yesterday', label: 'Yesterday', sortable: true, format: (value: any) => value.toLocaleString() },
    { key: 'week', label: 'This Week', sortable: true, format: (value: any) => value.toLocaleString() },
    { key: 'month', label: 'This Month', sortable: true, format: (value: any) => value.toLocaleString() },
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-screen">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">SoLink Camera Analytics</h1>
        
        {/* Live Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Cameras"
            value={stats?.total_cameras || 0}
          />
          <MetricCard
            title="Line-Crossing Cameras"
            value={stats?.line_crossing_cameras || 0}
          />
          <MetricCard
            title="Active Locations"
            value={stats?.active_locations || 0}
          />
        </div>

        {/* Store Events Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Line-In Events by Store</h2>
          <SortableTable
            columns={columns}
            data={storeEvents}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}