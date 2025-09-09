'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LineChart from '@/components/Charts/LineChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'

interface HourlyData {
  hour: number
  total_entries: number
}

export default function SoLinkDoorCounts() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState('all_stores')
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [hourlyChartData, setHourlyChartData] = useState<ChartData<'line'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const locations = [
    'all_stores', 'tampa', 'utc', 'tyrone', 'perimeter', 'wellington', 
    'mallofgeorgia', 'plazacarolina', 'augusta', 'bradenton', 'clearwater',
    'stpete', '6laps', 'avenues', 'celebration', 'warehouse', 'pierpark'
  ]

  // Set default to last 7 days
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    setStartDate(start)
    setEndDate(end)
  }, [])

  // Auto-fetch data when dates or location changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchDoorCountData()
    }
  }, [startDate, endDate, selectedLocation])

  const fetchDoorCountData = async () => {
    if (!startDate || !endDate) {
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

      const response = await fetch(`/api/solink-door-counts?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch door count data')
      }

      setHourlyData(data.hourlyData || [])
      
      // Create chart data for hourly entries
      if (data.hourlyData && data.hourlyData.length > 0) {
        const chartData: ChartData<'line'> = {
          labels: data.hourlyData.map((item: HourlyData) => {
            const hour = item.hour
            if (hour === 0) return '12 AM'
            if (hour < 12) return `${hour} AM`
            if (hour === 12) return '12 PM'
            return `${hour - 12} PM`
          }),
          datasets: [
            {
              label: 'People Entries',
              data: data.hourlyData.map((item: HourlyData) => item.total_entries),
              borderColor: 'rgba(59, 130, 246, 1)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        }
        setHourlyChartData(chartData)
      }

    } catch (error) {
      console.error('Error fetching door count data:', error)
      setError('Failed to load door count data. Please try again.')
      setHourlyData([])
      setHourlyChartData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
  }

  const formatLocationName = (location: string) => {
    if (location === 'all_stores') return 'All Stores'
    if (location === 'utc') return 'UTC (Sarasota)'
    if (location === '6laps') return '6 Laps'
    if (location === 'stpete') return 'St. Pete'
    if (location === 'mallofgeorgia') return 'Mall of Georgia'
    if (location === 'plazacarolina') return 'Plaza Carolina'
    if (location === 'pierpark') return 'Panama City - Pier Park'
    return location.charAt(0).toUpperCase() + location.slice(1)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚪 SoLink Door Counts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Hourly foot traffic analysis from AI door counting cameras
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
                    {formatLocationName(location)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-shrink-0 lg:self-end">
              <button
                onClick={fetchDoorCountData}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full lg:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Refresh Data'}
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

        {/* Hourly Traffic Chart */}
        {(hourlyChartData || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              📈 Hourly Traffic Pattern - {formatLocationName(selectedLocation)}
            </h2>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : hourlyChartData ? (
              <LineChart
                data={hourlyChartData}
                height={400}
              />
            ) : null}
          </div>
        )}

        {/* Hourly Data Table */}
        {(hourlyData.length > 0 || loading) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Hourly Entry Data</h2>
            {loading ? (
              <div className="card">
                <LoadingSpinner size="lg" className="py-20" />
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hour
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Entries
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hourlyData.map((item) => {
                      const hour = item.hour
                      let displayHour = ''
                      if (hour === 0) displayHour = '12:00 AM'
                      else if (hour < 12) displayHour = `${hour}:00 AM`
                      else if (hour === 12) displayHour = '12:00 PM'
                      else displayHour = `${hour - 12}:00 PM`

                      return (
                        <tr key={item.hour} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {displayHour}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                            {item.total_entries.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!loading && hourlyData.length === 0 && !error && (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🚪</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Door Count Data Available
              </h3>
              <p className="text-gray-600">
                Try selecting a different date range or store location
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}