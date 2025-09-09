'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface CustomerOrder {
  orderNumber: string
  orderDate: string
  orderValue: number
  employee: string
  itemCount: number
  brands: string
  itemsDetail: string
}

interface TopCustomer {
  rank: number
  email: string
  billingName: string
  totalOrders: number
  totalSpent: number
  avgOrderValue: number
  firstOrder: string
  lastOrder: string
  shoppingDays: number
  location: string
  orders: CustomerOrder[]
}

interface StoreData {
  customers: TopCustomer[]
  storeRevenue: number
  avgCustomerValue: number
  totalOrders: number
  customerCount: number
}

interface ApiResponse {
  summary: {
    totalCustomers: number
    totalRevenue: number
    avgCustomerValue: number
    totalOrders: number
  }
  storeData: { [storeName: string]: StoreData }
  availableStores: string[]
  selectedStores: string[]
}

export default function CustomerLocationsDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [availableStores, setAvailableStores] = useState<string[]>([])
  const [topN, setTopN] = useState(10)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('')
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())

  const fetchLocationCustomersData = async () => {
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
        topN: topN.toString()
      })

      const response = await fetch(`/api/location-customers?${params}`)
      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to fetch data')
      }

      setData(responseData)
      setAvailableStores(responseData.availableStores)
      
      // Set default selected stores if none selected
      if (selectedStores.length === 0) {
        setSelectedStores(responseData.availableStores)
      }
      
      // Set first store as active tab if no tab is active
      if (!activeTab && responseData.selectedStores.length > 0) {
        setActiveTab(responseData.selectedStores[0])
      }

    } catch (error) {
      console.error('Error fetching location customers data:', error)
      setError('Failed to load location customer data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchLocationCustomersData(), 100)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const toggleCustomerExpansion = (customerKey: string) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerKey)) {
      newExpanded.delete(customerKey)
    } else {
      newExpanded.add(customerKey)
    }
    setExpandedCustomers(newExpanded)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏪 Top Customers by Store Location</h1>
          <p className="mt-1 text-sm text-gray-600">
            Analyze your best customers at each store location and their purchasing patterns
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Analysis Period
              </label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏬 Store Selection
              </label>
              <select
                multiple
                value={selectedStores}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  setSelectedStores(values)
                }}
                className="input-field w-full h-20"
              >
                {availableStores.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔢 Top Customer Count
              </label>
              <select
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value))}
                className="input-field w-full"
              >
                <option value={5}>Top 5 customers per store</option>
                <option value={10}>Top 10 customers per store</option>
                <option value={15}>Top 15 customers per store</option>
                <option value={20}>Top 20 customers per store</option>
                <option value={25}>Top 25 customers per store</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchLocationCustomersData}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Analyze Customers'}
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
        {(data?.summary || loading) && (
          <div>
            <h2 className="text-xl font-semibold mb-4">📊 Top Customer Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Top Customers Analyzed"
                value={data?.summary.totalCustomers.toLocaleString() || '0'}
                icon="👥"
                loading={loading}
              />
              <MetricCard
                title="Combined Revenue"
                value={data?.summary ? formatCurrency(data.summary.totalRevenue) : '$0'}
                icon="💰"
                loading={loading}
              />
              <MetricCard
                title="Avg Customer Value"
                value={data?.summary ? formatCurrency(data.summary.avgCustomerValue) : '$0'}
                icon="📈"
                loading={loading}
              />
              <MetricCard
                title="Total Orders"
                value={data?.summary.totalOrders.toLocaleString() || '0'}
                icon="🛒"
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* Store Tabs */}
        {data?.storeData && Object.keys(data.storeData).length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">🏪 Top Customers by Store Location</h2>
            <p className="text-sm text-gray-600 mb-6">Click the ▶️ arrow to expand and see all orders for each customer</p>
            
            {/* Store Tab Navigation */}
            <div className="flex flex-wrap border-b border-gray-200 mb-6">
              {Object.keys(data.storeData).map((store) => (
                <button
                  key={store}
                  onClick={() => setActiveTab(store)}
                  className={`px-4 py-2 mr-2 mb-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === store 
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-gray-800 border-b-2 border-transparent hover:border-gray-300'
                  }`}
                >
                  🏬 {store}
                </button>
              ))}
            </div>

            {/* Active Store Content */}
            {activeTab && data.storeData[activeTab] && (
              <div>
                {/* Store Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(data.storeData[activeTab].storeRevenue)}
                    </div>
                    <div className="text-sm text-gray-600">Store Revenue (Top Customers)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(data.storeData[activeTab].avgCustomerValue)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Customer Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.storeData[activeTab].totalOrders.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Orders</div>
                  </div>
                </div>

                <hr className="my-6" />

                {/* Customer List */}
                <div className="space-y-4">
                  {data.storeData[activeTab].customers.map((customer) => {
                    const customerKey = `${activeTab}_${customer.email}_${customer.rank}`
                    const isExpanded = expandedCustomers.has(customerKey)

                    return (
                      <div key={customerKey} className="border border-gray-200 rounded-lg">
                        {/* Customer Summary Row */}
                        <div className="p-4 hover:bg-gray-50">
                          <div className="grid grid-cols-6 gap-4 items-center">
                            <div className="flex items-center">
                              <button
                                onClick={() => toggleCustomerExpansion(customerKey)}
                                className="mr-3 p-1 hover:bg-gray-200 rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </div>
                            
                            <div>
                              <div className="font-semibold text-gray-900">
                                {customer.billingName}
                              </div>
                              <div className="text-sm text-gray-500">
                                📧 {customer.email}
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600">
                                #{customer.rank}
                              </div>
                              <div className="text-xs text-gray-500">Rank</div>
                            </div>

                            <div className="text-center">
                              <div className="font-semibold">
                                {customer.totalOrders.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">Orders</div>
                            </div>

                            <div className="text-center">
                              <div className="font-semibold text-green-600">
                                {formatCurrency(customer.totalSpent)}
                              </div>
                              <div className="text-xs text-gray-500">Total Spent</div>
                            </div>

                            <div className="text-center">
                              <div className="font-semibold">
                                {formatCurrency(customer.avgOrderValue)}
                              </div>
                              <div className="text-xs text-gray-500">Avg Order</div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Order Details */}
                        {isExpanded && customer.orders && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                              📋 All Orders for {customer.billingName} at {activeTab}
                            </h4>
                            
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-white">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total ($)</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Brands</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {customer.orders.slice(0, 10).map((order, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm text-gray-900">{order.orderDate}</td>
                                      <td className="px-3 py-2 text-sm font-mono text-gray-600">{order.orderNumber}</td>
                                      <td className="px-3 py-2 text-sm font-semibold text-green-600">
                                        {formatCurrency(order.orderValue)}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-600">{order.employee}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600">{order.itemCount}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate" title={order.brands}>
                                        {order.brands}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              
                              {customer.orders.length > 10 && (
                                <div className="mt-3 text-sm text-gray-500 text-center">
                                  Showing 10 of {customer.orders.length} orders
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🏪</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to Analyze Top Customers by Store Location
              </h3>
              <p className="text-gray-600">
                Choose a start and end date to view your best customers at each store location
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}