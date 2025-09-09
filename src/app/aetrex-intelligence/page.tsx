'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/UI/DateRangePicker'
import MetricCard from '@/components/UI/MetricCard'
import LineChart from '@/components/Charts/LineChart'
import BarChart from '@/components/Charts/BarChart'
import SortableTable from '@/components/UI/SortableTable'
import LoadingSpinner from '@/components/UI/LoadingSpinner'

interface AetrexMetrics {
  totalAetrexSales: number
  totalNonAetrexSales: number
  totalSales: number
  aetrexPercentage: number
  aetrexOrderCount: number
  totalOrderCount: number
  ordersWithAetrex: number
  percentOrdersWithAetrex: number
}

interface DailyAetrexData {
  date: string
  aetrexSales: number
  nonAetrexSales: number
  totalSales: number
  aetrexPercentage: number
  ordersWithAetrex: number
  totalOrders: number
  percentOrdersWithAetrex: number
}

interface StoreAetrexData {
  store: string
  aetrexSales: number
  nonAetrexSales: number
  totalSales: number
  aetrexPercentage: number
  ordersWithAetrex: number
  totalOrders: number
}

export default function AetrexIntelligence() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedStores, setSelectedStores] = useState<string[]>(['all_stores'])
  const [locations, setLocations] = useState<string[]>([])
  const [metrics, setMetrics] = useState<AetrexMetrics | null>(null)
  const [dailyData, setDailyData] = useState<DailyAetrexData[]>([])
  const [storeData, setStoreData] = useState<StoreAetrexData[]>([])
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLocations()
    // Set default date range to last 30 days
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start)
    setEndDate(end)
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

  const fetchAetrexData = async () => {
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
        stores: selectedStores.join(','),
      })

      const response = await fetch(`/api/aetrex-intelligence?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setMetrics(data.metrics)
      setDailyData(data.dailyData || [])
      setStoreData(data.storeData || [])
      setChartData(data.chartData)
    } catch (error) {
      console.error('Error fetching Aetrex data:', error)
      setError('Failed to load Aetrex data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchAetrexData(), 100)
    }
  }

  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'all_stores') {
      setSelectedStores(['all_stores'])
    } else {
      const options = Array.from(e.target.selectedOptions, option => option.value)
      setSelectedStores(options.length > 0 ? options : ['all_stores'])
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aetrex Intelligence</h1>
          <p className="mt-1 text-sm text-gray-600">
            Analyze Aetrex product sales performance and penetration across stores
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
                multiple={selectedStores[0] !== 'all_stores'}
                value={selectedStores}
                onChange={handleStoreChange}
                className="input-field w-full min-h-[42px]"
                size={selectedStores[0] !== 'all_stores' ? 5 : 1}
              >
                <option value="all_stores">All Stores</option>
                {locations.filter(loc => loc !== 'all_stores').map((location) => (
                  <option key={location} value={location}>
                    {location === 'ecom' ? 'E-Commerce' : location}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Hold Ctrl/Cmd to select multiple stores
              </p>
            </div>

            <div className="flex-shrink-0 lg:self-end">
              <button
                onClick={fetchAetrexData}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Aetrex Sales"
              value={metrics ? formatCurrency(metrics.totalAetrexSales) : '$0'}
              icon="👟"
              loading={loading}
            />
            <MetricCard
              title="Aetrex % of Total Sales"
              value={metrics ? formatPercentage(metrics.aetrexPercentage) : '0%'}
              icon="📊"
              loading={loading}
            />
            <MetricCard
              title="Orders with Aetrex"
              value={metrics ? `${metrics.ordersWithAetrex.toLocaleString()} / ${metrics.totalOrderCount.toLocaleString()}` : '0'}
              icon="📦"
              loading={loading}
            />
            <MetricCard
              title="% Orders with Aetrex"
              value={metrics ? formatPercentage(metrics.percentOrdersWithAetrex) : '0%'}
              icon="✨"
              loading={loading}
            />
          </div>
        )}

        {/* Store Performance */}
        {(storeData.length > 0 || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">🏬 Store Aetrex Performance</h2>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : (
              <SortableTable
                data={storeData}
                colorCodeColumn="aetrexSales"
                columns={[
                  { key: 'store', label: 'Store', align: 'left' },
                  { 
                    key: 'aetrexSales', 
                    label: 'Aetrex Sales', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value),
                    colorCode: true
                  },
                  { 
                    key: 'nonAetrexSales', 
                    label: 'Other Sales', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value)
                  },
                  { 
                    key: 'totalSales', 
                    label: 'Total Sales', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value)
                  },
                  { 
                    key: 'aetrexPercentage', 
                    label: 'Aetrex %', 
                    align: 'right',
                    format: (value: number) => formatPercentage(value)
                  },
                  { 
                    key: 'ordersWithAetrex', 
                    label: 'Orders w/ Aetrex', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                  { 
                    key: 'totalOrders', 
                    label: 'Total Orders', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                ]}
              />
            )}
          </div>
        )}

        {/* Charts */}
        {(chartData || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Daily Trends</h2>
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
                <BarChart
                  data={chartData.salesComparisonChart}
                  title="Daily Sales: Aetrex vs Other Products"
                  height={350}
                />
                <LineChart
                  data={chartData.percentageChart}
                  title="Aetrex % of Daily Sales"
                  height={350}
                />
                <LineChart
                  data={chartData.ordersChart}
                  title="% of Orders Including Aetrex"
                  height={350}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Daily Data Table */}
        {(dailyData.length > 0 || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Daily Aetrex Data</h2>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : (
              <SortableTable
                data={dailyData}
                colorCodeColumn="aetrexSales"
                columns={[
                  { key: 'date', label: 'Date', align: 'left', sortable: true },
                  { 
                    key: 'aetrexSales', 
                    label: 'Aetrex Sales', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value),
                    colorCode: true
                  },
                  { 
                    key: 'nonAetrexSales', 
                    label: 'Other Sales', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value)
                  },
                  { 
                    key: 'totalSales', 
                    label: 'Total Sales', 
                    align: 'right',
                    format: (value: number) => formatCurrency(value)
                  },
                  { 
                    key: 'aetrexPercentage', 
                    label: 'Aetrex %', 
                    align: 'right',
                    format: (value: number) => formatPercentage(value)
                  },
                  { 
                    key: 'ordersWithAetrex', 
                    label: 'Orders w/ Aetrex', 
                    align: 'right',
                    format: (value: number) => value.toLocaleString()
                  },
                  { 
                    key: 'percentOrdersWithAetrex', 
                    label: '% Orders w/ Aetrex', 
                    align: 'right',
                    format: (value: number) => formatPercentage(value)
                  },
                ]}
              />
            )}
          </div>
        )}

        {/* Additional Insights */}
        {metrics && !loading && (
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Key Insights</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• Aetrex products account for {formatPercentage(metrics.aetrexPercentage)} of total sales revenue</p>
              <p>• {formatPercentage(metrics.percentOrdersWithAetrex)} of all orders include at least one Aetrex product</p>
              <p>• Average Aetrex sale per order: {formatCurrency(metrics.totalAetrexSales / metrics.ordersWithAetrex)}</p>
              <p>• Total Aetrex revenue for selected period: {formatCurrency(metrics.totalAetrexSales)}</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👟</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Analyze Aetrex Performance
              </h3>
              <p className="text-gray-600">
                Select a date range and stores to view Aetrex sales analytics
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}