'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import LineChart from '@/components/Charts/LineChart'
import SortableTable from '@/components/UI/SortableTable'

interface EmployeeSummary {
  totalEmployees: number
  totalRevenue: number
  totalTransactions: number
  totalCustomers: number
  avgRevenuePerEmployee: number
  avgTransactionsPerEmployee: number
  bestPerformer: {
    name: string
    revenue: number
    location: string
  }
}

interface Employee {
  employee_id: string
  name: string
  location: string
  days_worked: number
  total_transactions: number
  unique_customers: number
  revenue: number
  revenuePerDay: number
  transactionsPerDay: number
  customersPerDay: number
  avgTransactionValue: number
  efficiencyScore: number
  rank: number
}

interface PerformanceTabs {
  revenueLeaders: Employee[]
  transactionLeaders: Employee[]
}


export default function EmployeesDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [location, setLocation] = useState('all')
  const [locations, setLocations] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('revenue')
  
  const [summary, setSummary] = useState<EmployeeSummary | null>(null)
  const [performanceTabs, setPerformanceTabs] = useState<PerformanceTabs | null>(null)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [chartData, setChartData] = useState<any>(null)

  // Load locations on component mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations')
        const data = await response.json()
        setLocations(data.locations || [])
      } catch (error) {
        console.error('Error fetching locations:', error)
      }
    }
    fetchLocations()
  }, [])

  const fetchEmployeeData = async () => {
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
        location
      })

      const response = await fetch(`/api/employees?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setSummary(data.summary)
      setPerformanceTabs(data.performanceTabs)
      setAllEmployees(data.allEmployees)
      setChartData(data.chartData)

    } catch (error: any) {
      console.error('Error fetching employee data:', error)
      setError('Failed to load employee data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const getTabData = () => {
    if (!performanceTabs) return []
    
    switch (activeTab) {
      case 'revenue':
        return performanceTabs.revenueLeaders
      case 'transactions':
        return performanceTabs.transactionLeaders
      default:
        return []
    }
  }

  const getTabColumns = () => {
    switch (activeTab) {
      case 'revenue':
        return [
          { key: 'rank', label: 'Rank', sortable: true },
          { key: 'name', label: 'Employee', sortable: true },
          { key: 'revenue', label: 'Total Revenue', sortable: true, format: formatCurrency },
          { key: 'revenuePerDay', label: 'Revenue/Day', sortable: true, format: formatCurrency },
          { key: 'days_worked', label: 'Days Worked', sortable: true }
        ]
      case 'transactions':
        return [
          { key: 'rank', label: 'Rank', sortable: true },
          { key: 'name', label: 'Employee', sortable: true },
          { key: 'total_transactions', label: 'Total Transactions', sortable: true },
          { key: 'transactionsPerDay', label: 'Trans/Day', sortable: true, format: (val: number) => val.toFixed(1) },
          { key: 'avgTransactionValue', label: 'Avg Transaction', sortable: true, format: formatCurrency }
        ]
      default:
        return []
    }
  }


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 Employee Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comprehensive employee performance and productivity insights
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={({ startDate, endDate }) => {
                  setStartDate(startDate)
                  setEndDate(endDate)
                  if (startDate && endDate) {
                    setTimeout(() => fetchEmployeeData(), 100)
                  }
                }}
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field w-full"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>
                    {loc === 'all' ? 'All Locations' : 
                     loc === 'all_stores' ? 'All Stores -Ecom' :
                     loc === 'ecom' ? 'Ecom' : loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-shrink-0 lg:self-end">
              <button
                onClick={fetchEmployeeData}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full lg:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        {(summary || loading) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Employees"
              value={summary?.totalEmployees.toLocaleString() || '0'}
              icon="👥"
              loading={loading}
            />
            <MetricCard
              title="Top Performer"
              value={summary?.bestPerformer.name || 'N/A'}
              icon="🏆"
              loading={loading}
            />
            <MetricCard
              title="Total Revenue"
              value={summary ? formatCurrency(summary.totalRevenue) : '$0'}
              icon="💰"
              loading={loading}
            />
            <MetricCard
              title="Avg Revenue/Employee"
              value={summary ? formatCurrency(summary.avgRevenuePerEmployee) : '$0'}
              icon="📈"
              loading={loading}
            />
          </div>
        )}


        {/* Performance Tabs */}
        {(performanceTabs || loading) && (
          <div className="card">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Employee Performance Rankings</h3>
              
              {/* Tab Navigation */}
              <div className="flex space-x-1 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('revenue')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                    activeTab === 'revenue' 
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  💰 Revenue Leaders
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                    activeTab === 'transactions' 
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📊 Transaction Volume
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner size="md" className="py-8" />
            ) : (
              <SortableTable
                data={getTabData()}
                columns={getTabColumns()}
                colorCodeColumn="rank"
              />
            )}
          </div>
        )}


        {/* All Employees Table */}
        {allEmployees.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">📋 Complete Employee Rankings (v2.1)</h3>
            <SortableTable
              data={allEmployees}
              columns={[
                { key: 'rank', label: 'Rank', sortable: true },
                { key: 'name', label: 'Employee', sortable: true },
                { key: 'revenue', label: 'Revenue', sortable: true, format: formatCurrency },
                { key: 'revenuePerDay', label: 'Revenue/Day', sortable: true, format: formatCurrency },
                { key: 'total_transactions', label: 'Transactions', sortable: true },
                { key: 'transactionsPerDay', label: 'Trans/Day', sortable: true, format: (val: number) => val.toFixed(1) },
                { key: 'unique_customers', label: 'Customers', sortable: true }
              ]}
              colorCodeColumn="rank"
            />
          </div>
        )}


        {/* Help Text */}
        {startDate && endDate ? null : (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to Analyze Employee Performance
              </h3>
              <p className="text-gray-600">
                Choose a start and end date to view comprehensive employee analytics and performance metrics
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}