'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LineChart from '@/components/Charts/LineChart'
import PieChart from '@/components/Charts/PieChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'
import { format, differenceInDays } from 'date-fns'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface Order {
  orderNumber: string
  orderDate: string
  total: number
  subtotal: number
  shipping: number
  taxes: number
  description: string
  upc: string
  status: string
  fulfillmentStatus: string
  discountCode: string | null
  discountAmount: number
  billingName: string
}

interface CustomerSummary {
  totalCustomers: number
  repeatCustomers: number
  retentionRate: number
  avgCustomerValue: number
  avgOrdersPerCustomer: number
}

interface TopCustomer {
  customerId: string
  email: string
  orderCount: number
  totalSpent: number
  avgOrderValue: number
  lifespanDays: number
  firstOrder: string
  lastOrder: string
  orders?: Order[]
}

interface CustomerSegment {
  segment: string
  customerCount: number
  avgTotalSpent: number
  segmentRevenue: number
}

interface ChartDatasets {
  retention: ChartData<'line'>
  segments: ChartData<'pie'>
}

export default function CustomersDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [locations, setLocations] = useState<string[]>([])
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [chartData, setChartData] = useState<ChartDatasets | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())

  // Load locations on mount
  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      setLocations(['all', ...data.locations])
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchCustomersData = async () => {
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

      const response = await fetch(`/api/customers?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setSummary(data.summary)
      setTopCustomers(data.topCustomers)
      setSegments(data.segments)
      setChartData(data.chartData)
    } catch (error) {
      console.error('Error fetching customers data:', error)
      setError('Failed to load customer data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchCustomersData(), 100)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'VIP (7+)': return 'text-purple-600 bg-purple-50'
      case 'Loyal (4-6)': return 'text-blue-600 bg-blue-50'
      case 'Repeat (2-3)': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const toggleCustomerExpansion = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedCustomers(newExpanded)
  }

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'paid': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'refunded': 'bg-red-100 text-red-800',
      'partially_refunded': 'bg-orange-100 text-orange-800',
      'authorized': 'bg-blue-100 text-blue-800',
      'voided': 'bg-gray-100 text-gray-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getFulfillmentBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'fulfilled': 'bg-green-100 text-green-800',
      'partial': 'bg-yellow-100 text-yellow-800',
      'unfulfilled': 'bg-red-100 text-red-800',
      'restocked': 'bg-blue-100 text-blue-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔄 Repeat Customer Analysis</h1>
          <p className="mt-1 text-sm text-gray-600">
            Customer loyalty and retention analytics
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
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input-field w-full"
              >
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location === 'all' ? 'All Locations' : location}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-shrink-0 lg:self-end">
              <button
                onClick={fetchCustomersData}
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

        {/* Summary Metrics */}
        {(summary || loading) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard
              title="Total Customers"
              value={summary?.totalCustomers.toLocaleString() || '0'}
              icon="👥"
              loading={loading}
            />
            <MetricCard
              title="Repeat Customers"
              value={summary?.repeatCustomers.toLocaleString() || '0'}
              icon="🔄"
              loading={loading}
            />
            <MetricCard
              title="Retention Rate"
              value={summary ? `${summary.retentionRate.toFixed(1)}%` : '0%'}
              icon="📈"
              changeType={summary && summary.retentionRate > 30 ? 'positive' : 'negative'}
              loading={loading}
            />
            <MetricCard
              title="Avg Customer Value"
              value={summary ? formatCurrency(summary.avgCustomerValue) : '$0'}
              icon="💰"
              loading={loading}
            />
            <MetricCard
              title="Avg Orders/Customer"
              value={summary?.avgOrdersPerCustomer.toFixed(1) || '0'}
              icon="📊"
              loading={loading}
            />
          </div>
        )}



        {/* Top Repeat Customers with Expandable Orders */}
        {(topCustomers.length > 0 || loading) && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Top Repeat Customers</h3>
            {loading ? (
              <LoadingSpinner size="md" className="py-8" />
            ) : (
              <div className="space-y-2">
                {topCustomers.slice(0, 15).map((customer) => (
                  <div key={customer.customerId} className="border border-gray-200 rounded-lg">
                    {/* Customer Summary Row */}
                    <div 
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleCustomerExpansion(customer.customerId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-5 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {customer.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {customer.customerId}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-gray-900">
                              {customer.orderCount}
                            </div>
                            <div className="text-xs text-gray-500">Orders</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(customer.totalSpent)}
                            </div>
                            <div className="text-xs text-gray-500">Total Spent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(customer.avgOrderValue)}
                            </div>
                            <div className="text-xs text-gray-500">Avg Order</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-900">
                              {format(new Date(customer.firstOrder), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              Customer for {customer.lifespanDays} days
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          {expandedCustomers.has(customer.customerId) ? (
                            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Orders Section */}
                    {expandedCustomers.has(customer.customerId) && customer.orders && (
                      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-gray-700">
                            Last {Math.min(25, customer.orders.length)} Orders
                          </h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Order #
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Date
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  UPC
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Product/Purchase
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Subtotal
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Discount
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {customer.orders.slice(0, 25).map((order, idx) => (
                                <tr key={`${order.orderNumber}-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    {order.orderNumber}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {format(new Date(order.orderDate), 'MMM dd, yyyy')}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-mono text-gray-600">
                                    {order.upc}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                                    {order.description}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900">
                                    {formatCurrency(order.subtotal)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {order.discountAmount > 0 ? (
                                      <div>
                                        -{formatCurrency(order.discountAmount)}
                                        {order.discountCode && (
                                          <div className="text-xs text-gray-500">{order.discountCode}</div>
                                        )}
                                      </div>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                                    {formatCurrency(order.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {customer.orders.length > 25 && (
                          <div className="mt-3 text-sm text-gray-500 text-center">
                            Showing 25 of {customer.orders.length} orders
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to Analyze Customer Retention
              </h3>
              <p className="text-gray-600">
                Choose a start and end date to analyze customer loyalty and repeat purchase behavior
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}