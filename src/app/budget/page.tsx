'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import LineChart from '@/components/Charts/LineChart'
import BarChart from '@/components/Charts/BarChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'

interface BudgetSummary {
  totalBudget: number
  totalActual: number
  total2024Sales: number
  variance: number
  variancePercent: number
  yearOverYearGrowth: number
}

interface LocationData {
  location: string
  budget: number
  actual: number
  variancePercent: number
}

export default function BudgetDashboard() {
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('last4weeks')
  const [locations, setLocations] = useState<string[]>([])
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [chartData, setChartData] = useState<ChartData<'line'> | null>(null)
  const [locationData, setLocationData] = useState<LocationData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLocations()
    fetchBudgetData()
  }, [])

  useEffect(() => {
    fetchBudgetData()
  }, [selectedLocation, selectedPeriod])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      setLocations(['all', ...data.locations])
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchBudgetData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        location: selectedLocation,
        period: selectedPeriod,
      })

      const response = await fetch(`/api/budget?${params}`)
      const data = await response.json()

      setSummary(data.summary)
      setChartData(data.chartData)
      setLocationData(data.locationData)
    } catch (error) {
      console.error('Error fetching budget data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getVarianceType = (variance: number): 'positive' | 'negative' | 'neutral' => {
    if (variance > 0) return 'positive'
    if (variance < 0) return 'negative'
    return 'neutral'
  }

  // Prepare location chart data
  const locationChartData: ChartData<'bar'> = {
    labels: locationData.map(l => l.location),
    datasets: [
      {
        label: '2025 Plan',
        data: locationData.map(l => l.budget),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
      },
      {
        label: '2025 Actual',
        data: locationData.map(l => l.actual),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
      }
    ]
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💰 Fit2Run Budget</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track budget vs actual performance across all locations
            </p>
          </div>

          {/* Filters */}
          <div className="flex space-x-4">
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-700 mb-1">Time Period</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="input-field w-full text-sm"
              >
                <option value="lastweek">Last Week (Sun-Mon)</option>
                <option value="last4weeks">Last 4 Weeks</option>
                <option value="lastmonth">Last Month (1-31)</option>
              </select>
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input-field w-full text-sm"
              >
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location === 'all' ? 'All Locations' : location}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <MetricCard
            title="2024 Sales"
            value={summary ? formatCurrency(summary.total2024Sales) : '$0'}
            icon="📅"
            loading={loading}
          />
          <MetricCard
            title="2025 Plan"
            value={summary ? formatCurrency(summary.totalBudget) : '$0'}
            icon="🎯"
            loading={loading}
          />
          <MetricCard
            title="2025 Actual"
            value={summary ? formatCurrency(summary.totalActual) : '$0'}
            icon="📊"
            loading={loading}
          />
          <MetricCard
            title="Plan Variance"
            value={summary ? formatCurrency(Math.abs(summary.variance)) : '$0'}
            change={summary ? `${summary.variancePercent}%` : '0%'}
            changeType={summary ? getVarianceType(summary.variance) : 'neutral'}
            icon={summary && summary.variance >= 0 ? '📈' : '📉'}
            loading={loading}
          />
          <MetricCard
            title="YoY Growth"
            value={summary && summary.total2024Sales > 0 
              ? `${summary.yearOverYearGrowth.toFixed(1)}%`
              : '0%'
            }
            changeType={summary && summary.yearOverYearGrowth > 0 ? 'positive' : 'negative'}
            icon="⚡"
            loading={loading}
          />
        </div>

        {/* Budget vs Actual Trend */}
        {(chartData || loading) && (
          <div>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : chartData ? (
              <LineChart
                data={chartData}
                title="2024 Sales vs 2025 Plan vs 2025 Actual Trend"
                height={400}
              />
            ) : null}
          </div>
        )}

        {/* Location Performance */}
        {locationData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChart
              data={locationChartData}
              title="2025 Plan vs Actual by Location"
              height={350}
            />
            
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Location Performance</h3>
              <div className="space-y-3">
                {locationData.slice(0, 10).map((location, index) => (
                  <div key={location.location} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-6">
                        #{index + 1}
                      </span>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {location.location}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {formatCurrency(location.actual)}
                      </span>
                      <span className={`
                        text-sm font-medium px-2 py-1 rounded-full
                        ${location.variancePercent >= 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                        }
                      `}>
                        {location.variancePercent >= 0 ? '+' : ''}{location.variancePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}