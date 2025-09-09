'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import BarChart from '@/components/Charts/BarChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'
import { TrophyIcon } from '@heroicons/react/24/solid'

interface StoreRanking {
  location: string
  visitors: number
  transactions: number
  revenue: number
  unique_customers: number
  days_active: number
  avg_transaction_value: number
  conversion_rate: number
  revenue_per_visitor: number
  customers_per_day: number
  revenue_per_day: number
  transactions_per_day: number
  conversion_rank: number
  revenue_per_visitor_rank: number
  total_revenue_rank: number
  avg_transaction_rank: number
  efficiency_score: number
}

interface Summary {
  total_stores: number
  total_visitors: number
  total_revenue: number
  date_range_days: number
}

export default function RankingsDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [minVisitors, setMinVisitors] = useState(100)
  const [minOrders, setMinOrders] = useState(5)
  const [rankings, setRankings] = useState<StoreRanking[]>([])
  const [chartData, setChartData] = useState<ChartData<'bar'> | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchRankingsData = async () => {
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
        minVisitors: minVisitors.toString(),
        minOrders: minOrders.toString(),
      })

      const response = await fetch(`/api/rankings?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setRankings(data.rankings)
      setChartData(data.chartData)
      setSummary(data.summary)
    } catch (error) {
      console.error('Error fetching rankings data:', error)
      setError('Failed to load rankings data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchRankingsData(), 100)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <TrophyIcon className="w-6 h-6 text-yellow-500" />
      case 2:
        return <span className="text-lg font-bold text-silver-500">🥈</span>
      case 3:
        return <span className="text-lg font-bold text-orange-600">🥉</span>
      default:
        return <span className="text-lg font-bold text-gray-600">#{rank}</span>
    }
  }


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏆 Store Rankings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Compare store performance and track rankings over time
          </p>
          <p className="mt-2 text-sm text-blue-600 font-medium">
            Store rankings are only included for stores where SoLink cameras are installed to get conversion data
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Date Range
              </label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👥 Min Total Visitors
              </label>
              <input
                type="number"
                min="0"
                value={minVisitors}
                onChange={(e) => setMinVisitors(parseInt(e.target.value) || 100)}
                className="input-field w-full"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📦 Min Total Orders
              </label>
              <input
                type="number"
                min="0"
                value={minOrders}
                onChange={(e) => setMinOrders(parseInt(e.target.value) || 5)}
                className="input-field w-full"
                placeholder="5"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchRankingsData}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Analyze Performance'}
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

        {/* Summary Metrics */}
        {(summary || loading) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Stores Analyzed"
              value={summary?.total_stores.toString() || '0'}
              icon="🏪"
              loading={loading}
            />
            <MetricCard
              title="Date Range"
              value={summary ? `${summary.date_range_days} days` : '0 days'}
              icon="📅"
              loading={loading}
            />
            <MetricCard
              title="Total Visitors"
              value={summary?.total_visitors.toLocaleString() || '0'}
              icon="👥"
              loading={loading}
            />
            <MetricCard
              title="Total Revenue"
              value={summary ? formatCurrency(summary.total_revenue) : '$0'}
              icon="💰"
              loading={loading}
            />
          </div>
        )}

        {/* Top Stores Chart */}
        {(chartData || loading) && (
          <div>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : chartData ? (
              <BarChart
                data={chartData}
                title="Store Efficiency Ranking (Lower Score = Better Performance)"
                height={400}
              />
            ) : null}
          </div>
        )}

        {/* Store Performance Rankings */}
        {rankings.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">🏆 Overall Store Rankings (by Efficiency Score)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Efficiency Score</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visitors</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversion Rate</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue/Visitor</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rankings.map((store, index) => (
                    <tr key={store.location} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {getRankIcon(index + 1)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {store.location}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">
                          {store.efficiency_score.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {store.visitors.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {store.transactions.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(store.conversion_rate * 100).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(store.revenue_per_visitor)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(store.revenue)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Metrics Table */}
        {rankings.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">📊 Detailed Performance Metrics</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Transaction</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customers/Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue/Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions/Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conv Rank</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rev/Vis Rank</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Rev Rank</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Trans Rank</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rankings.map((store) => (
                    <tr key={store.location} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {store.location}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(store.avg_transaction_value)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {store.customers_per_day.toFixed(1)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(store.revenue_per_day)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {store.transactions_per_day.toFixed(1)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">
                          #{store.conversion_rank}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-green-600">
                          #{store.revenue_per_visitor_rank}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-purple-600">
                          #{store.total_revenue_rank}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-orange-600">
                          #{store.avg_transaction_rank}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to Analyze Store Performance
              </h3>
              <p className="text-gray-600">
                Compare store efficiency using visitor conversion, revenue per visitor, and overall performance metrics
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}