'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import BarChart from '@/components/Charts/BarChart'
import LineChart from '@/components/Charts/LineChart'
import SortableTable from '@/components/UI/SortableTable'

interface StoreSummary {
  location: string
  total_transactions: number
  total_employees: number
  days_active: number
  total_revenue: number
  avg_transaction_value: number
  min_transaction: number
  max_transaction: number
  unique_customers: number
  avg_transactions_per_employee: number
  avg_revenue_per_employee: number
}

interface HourlyData {
  hour: number
  hour_display: string
  transactions: number
  revenue: number
  avg_transaction_value: number
}

interface EmployeeData {
  employee: string
  total_transactions: number
  days_worked: number
  total_revenue: number
  avg_transaction_value: number
  unique_customers: number
  min_transaction: number
  max_transaction: number
  transactions_per_day: number
  revenue_per_day: number
  rank: number
}

interface DailyData {
  date: string
  transactions: number
  active_employees: number
  revenue: number
  avg_transaction_value: number
}

interface PeakHour {
  hour: number
  hour_display: string
  transactions: number
  revenue: number
}

interface StoreAnalyticsData {
  summary: StoreSummary | null
  hourlyDistribution: HourlyData[]
  employeePerformance: EmployeeData[]
  dailyBreakdown: DailyData[]
  peakHours: PeakHour[]
}

// Real store locations based on actual order data - sorted by order volume
const STORE_LOCATIONS = [
  'disneysprings', 'tampa', 'ecom', 'utc', 'events', 'gardens', 'ellenton',
  'coconutpoint', 'bradenton', 'waterford', 'millenia', 'wellington', 'coastland',
  'keywest', 'oldstpete', 'celebration', 'altamonte', 'paddockmall', 'brandon',
  'wiregrass', 'pierpark', 'flamingo', 'sanjuan', 'countryside', 'mallofgeorgia',
  'melbourne', 'avenues', 'daniapointe', 'cordova', 'coconutcreek', 'barceloneta',
  'orangepark', 'destin', 'treasurecoast', 'plazadelcaribe', 'plazadelsol',
  'sarasota', 'mayaguez', 'aventura', 'tyrone', 'stpete', 'clearwater',
  'carolina', 'fajardo', 'ftmyersoutlet', 'palmbeachgardens', 'perimeter',
  'plazacarolina', '6laps', 'augusta'
]

export default function StoreAnalytics() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [data, setData] = useState<StoreAnalyticsData>({
    summary: null,
    hourlyDistribution: [],
    employeePerformance: [],
    dailyBreakdown: [],
    peakHours: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async () => {
    if (!startDate || !endDate || !selectedLocation) return
    
    setLoading(true)
    setError('')
    
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        location: selectedLocation
      })
      
      const response = await fetch(`/api/store-analytics?${params}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data')
      }
      
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData({
        summary: null,
        hourlyDistribution: [],
        employeePerformance: [],
        dailyBreakdown: [],
        peakHours: []
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, selectedLocation])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US').format(num)

  const employeeColumns = [
    { key: 'rank', label: 'Rank', sortable: true },
    { key: 'employee', label: 'Employee', sortable: true },
    { key: 'total_transactions', label: 'Total Trans', sortable: true },
    { key: 'transactions_per_day', label: 'Trans/Day', sortable: true },
    { key: 'avg_transaction_value', label: 'Avg Transaction', sortable: true, format: (value: number) => formatCurrency(value) },
    { key: 'total_revenue', label: 'Total Revenue', sortable: true, format: (value: number) => formatCurrency(value) },
    { key: 'unique_customers', label: 'Customers', sortable: true }
  ]

  const dailyColumns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'transactions', label: 'Transactions', sortable: true },
    { key: 'active_employees', label: 'Active Staff', sortable: true },
    { key: 'revenue', label: 'Revenue', sortable: true, format: (value: number) => formatCurrency(value) },
    { key: 'avg_transaction_value', label: 'Avg Transaction', sortable: true, format: (value: number) => formatCurrency(value) }
  ]

  // Prepare chart data
  const hourlyChartData = {
    labels: data.hourlyDistribution.map(h => h.hour_display),
    datasets: [{
      label: 'Transactions per Hour',
      data: data.hourlyDistribution.map(h => h.transactions),
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1
    }]
  }

  const dailyChartData = {
    labels: data.dailyBreakdown.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [{
      label: 'Daily Transactions',
      data: data.dailyBreakdown.map(d => d.transactions),
      borderColor: 'rgba(16, 185, 129, 1)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4
    }]
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏪 Store Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Detailed store performance and employee analytics
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Source: Shopify order data only
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={({ startDate, endDate }) => {
                  setStartDate(startDate)
                  setEndDate(endDate)
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a store...</option>
                {STORE_LOCATIONS.map(location => (
                  <option key={location} value={location}>
                    {location.charAt(0).toUpperCase() + location.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchData}
                disabled={!startDate || !endDate || !selectedLocation || loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Analyze Store'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {data.summary && (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Transactions"
                value={formatNumber(data.summary.total_transactions)}
                icon="🛒"
                loading={loading}
              />
              <MetricCard
                title="Average Transaction"
                value={formatCurrency(data.summary.avg_transaction_value)}
                icon="💰"
                loading={loading}
              />
              <MetricCard
                title="Total Revenue"
                value={formatCurrency(data.summary.total_revenue)}
                icon="📈"
                loading={loading}
              />
              <MetricCard
                title="Active Employees"
                value={formatNumber(data.summary.total_employees)}
                icon="👥"
                loading={loading}
              />
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Avg Trans/Employee"
                value={formatNumber(data.summary.avg_transactions_per_employee)}
                icon="📊"
                loading={loading}
              />
              <MetricCard
                title="Unique Customers"
                value={formatNumber(data.summary.unique_customers)}
                icon="👤"
                loading={loading}
              />
              <MetricCard
                title="Max Transaction"
                value={formatCurrency(data.summary.max_transaction)}
                icon="📈"
                loading={loading}
              />
            </div>

            {/* Peak Hours Info */}
            {data.peakHours.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">⏰ Peak Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.peakHours.map((peak, index) => (
                    <div key={peak.hour} className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600">#{index + 1} Peak Hour</div>
                      <div className="text-lg font-semibold">{peak.hour_display}</div>
                      <div className="text-sm text-gray-600">
                        {peak.transactions} transactions • {formatCurrency(peak.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Hourly Transaction Distribution</h3>
                <BarChart data={hourlyChartData} height={300} />
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Daily Transaction Trend</h3>
                <LineChart data={dailyChartData} height={300} />
              </div>
            </div>

            {/* Employee Performance */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">👥 Employee Performance</h3>
              <SortableTable
                data={data.employeePerformance}
                columns={employeeColumns}
              />
            </div>

            {/* Daily Breakdown */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📅 Daily Breakdown</h3>
              <SortableTable
                data={data.dailyBreakdown}
                columns={dailyColumns}
              />
            </div>
          </>
        )}

        {/* Empty State */}
        {!data.summary && !loading && !error && (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🏪</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range and Store to Analyze
              </h3>
              <p className="text-gray-600">
                Choose a date range and specific store location to view detailed analytics
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}