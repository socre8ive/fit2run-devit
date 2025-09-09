'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LineChart from '@/components/Charts/LineChart'
import DualAxisChart from '@/components/Charts/DualAxisChart'
import SortableTable from '@/components/UI/SortableTable'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'

interface PerformanceMetrics {
  totalOrders: number
  totalRevenue: number
  uniqueCustomers: number
  conversionRate: number | null
  avgOrderValue: number
  revenuePerVisitor: number | null
}

interface StorePerformance {
  location: string
  totalOrders: number
  totalRevenue: number
  uniqueCustomers: number
  avgOrderValue: number
  conversionRate: number | null
  revenuePerVisitor: number | null
  totalVisitors?: number | null
}

interface DailyPerformance {
  date: string
  orders: number
  revenue: number
  uniqueCustomers: number
  avgOrderValue: number
  conversionRate: number | null
  revenuePerVisitor: number | null
  totalVisitors?: number | null
}

export default function PerformanceDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState('all_stores')
  const [locations, setLocations] = useState<string[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([])
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance[]>([])
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load locations on mount
  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      setLocations(data.locations)
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchPerformanceData = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        location: selectedLocation,
      })

      const response = await fetch(`/api/performance?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setMetrics(data.metrics)
      setStorePerformance(data.storePerformance || [])
      setDailyPerformance(data.dailyPerformance || [])
      setChartData(data.chartData)
    } catch (error) {
      console.error('Error fetching performance data:', error)
      setError('Failed to load performance data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      // Auto-fetch data when both dates are selected
      setTimeout(() => fetchPerformanceData(), 100)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track visitor conversion rates and revenue across locations (conversion data only available for stores with door counters)
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateChange}
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Selection
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input-field w-full"
              >
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location === 'all_stores' ? 'All Stores' : 
                     location === 'ecom' ? 'Ecom' : 
                     location}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                All Stores data doesn't include Ecom, for Ecom data, select Ecom from the dropdown
              </p>
            </div>

            <div className="flex-shrink-0 lg:self-end">
              <button
                onClick={fetchPerformanceData}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full lg:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Metrics Grid */}
        {(metrics || loading) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            <MetricCard
              title="Total Orders"
              value={metrics?.totalOrders.toLocaleString() || '0'}
              icon="📦"
              loading={loading}
            />
            <MetricCard
              title="Total Revenue"
              value={metrics ? formatCurrency(metrics.totalRevenue) : '$0'}
              icon="💰"
              loading={loading}
            />
            <MetricCard
              title="Unique Customers"
              value={metrics?.uniqueCustomers.toLocaleString() || '0'}
              icon="👥"
              loading={loading}
            />
            <MetricCard
              title="Conversion Rate"
              value={metrics ? (metrics.conversionRate !== null ? `${metrics.conversionRate.toFixed(1)}%` : 'N/A') : '0%'}
              icon="📈"
              loading={loading}
            />
            <MetricCard
              title="Revenue per Visitor"
              value={metrics ? (metrics.revenuePerVisitor !== null ? formatCurrency(metrics.revenuePerVisitor) : 'N/A') : '$0'}
              icon="💡"
              loading={loading}
            />
            <MetricCard
              title="Avg Order Value"
              value={metrics ? formatCurrency(metrics.avgOrderValue) : '$0'}
              icon="💳"
              loading={loading}
            />
          </div>
        )}

        {/* Store Performance Summary */}
        {(storePerformance.length > 0 || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">🏬 Store Performance Summary</h2>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : (
              <SortableTable
                data={storePerformance}
                colorCodeColumn="totalRevenue"
                columns={[
                  { key: 'location', label: 'Location', align: 'left' },
                  { 
                    key: 'totalRevenue', 
                    label: 'Total Revenue', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value),
                    colorCode: true
                  },
                  { 
                    key: 'totalOrders', 
                    label: 'Orders', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                  { 
                    key: 'uniqueCustomers', 
                    label: 'Customers', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                  { 
                    key: 'conversionRate', 
                    label: 'Conversion Rate', 
                    align: 'right',
                    format: (value: number | null) => value !== null ? `${value.toFixed(1)}%` : 'N/A'
                  },
                  { 
                    key: 'revenuePerVisitor', 
                    label: 'Revenue/Visitor', 
                    align: 'right',
                    format: (value: number | null) => value !== null ? formatCurrency(value) : 'N/A'
                  },
                  { 
                    key: 'avgOrderValue', 
                    label: 'Avg Order Value', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value)
                  },
                ]}
              />
            )}
          </div>
        )}

        {/* Daily Performance Trends */}
        {(chartData || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Daily Performance Trends</h2>
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="card">
                    <LoadingSpinner size="lg" className="py-20" />
                  </div>
                ))}
              </div>
            ) : chartData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LineChart
                  data={chartData.conversionChart}
                  title="Conversion Rate"
                  height={350}
                />
                <LineChart
                  data={chartData.revenuePerVisitorChart}
                  title="Revenue per Customer"
                  height={350}
                />
                <DualAxisChart
                  data={chartData.visitorsVsSalesChart}
                  title="Customers vs Orders"
                  height={350}
                />
                <LineChart
                  data={chartData.revenueChart}
                  title="Daily Revenue"
                  height={350}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Daily Performance Data */}
        {(dailyPerformance.length > 0 || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Daily Performance Data</h2>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : (
              <SortableTable
                data={dailyPerformance}
                colorCodeColumn="revenue"
                columns={[
                  { key: 'date', label: 'Date', align: 'left', sortable: true },
                  { 
                    key: 'revenue', 
                    label: 'Revenue', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value),
                    colorCode: true
                  },
                  { 
                    key: 'orders', 
                    label: 'Orders', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                  { 
                    key: 'uniqueCustomers', 
                    label: 'Customers', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                  { 
                    key: 'conversionRate', 
                    label: 'Conversion Rate', 
                    align: 'right',
                    format: (value: number | null) => value !== null ? `${value.toFixed(1)}%` : 'N/A'
                  },
                  { 
                    key: 'revenuePerVisitor', 
                    label: 'Revenue/Visitor', 
                    align: 'right',
                    format: (value: number | null) => value !== null ? formatCurrency(value) : 'N/A'
                  },
                  { 
                    key: 'avgOrderValue', 
                    label: 'Avg Order Value', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value)
                  },
                ]}
              />
            )}
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to Get Started
              </h3>
              <p className="text-gray-600">
                Choose a start and end date to view performance analytics
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}