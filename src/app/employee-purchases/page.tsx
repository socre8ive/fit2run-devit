'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface LineItem {
  name: string
  sku: string
  quantity: number
  price: number
  vendor: string
  line_total: number
}

interface EmployeePurchase {
  order_id: number
  order_name: string
  total: number
  subtotal: number
  taxes: number
  discount_code: string
  discount_amount: number
  discount_percentage: number
  created_at: string
  location: string
  sales_person: string
  customer_name: string
  matching_staff_name: string
  staff_id: number
  customer_email: string
  line_items: LineItem[]
}

interface Summary {
  totalOrders: number
  totalValue: number
  totalDiscounts: number
  avgOrderValue: number
  avgDiscountPercentage: number
  uniqueEmployees: number
}

type SortField = 'customer_name' | 'sales_person' | 'total' | 'created_at'
type SortDirection = 'asc' | 'desc'

export default function EmployeePurchasesDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [orders, setOrders] = useState<EmployeePurchase[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [sortField, setSortField] = useState<SortField>('total')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const fetchEmployeePurchases = async () => {
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
        limit: '200'
      })

      const response = await fetch(`/api/employee-purchases?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setSummary(data.summary)
      setOrders(data.orders)
      
    } catch (error) {
      console.error('Error fetching employee purchases:', error)
      setError('Failed to load employee purchases. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchEmployeePurchases(), 100)
    }
  }

  const toggleOrderExpansion = (orderId: number) => {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedOrders(newExpanded)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'total' ? 'desc' : 'asc')
    }
  }

  const sortedOrders = [...orders].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'customer_name':
        aValue = a.customer_name.toLowerCase()
        bValue = b.customer_name.toLowerCase()
        break
      case 'sales_person':
        aValue = (a.sales_person || '').toLowerCase()
        bValue = (b.sales_person || '').toLowerCase()
        break
      case 'total':
        aValue = a.total
        bValue = b.total
        break
      case 'created_at':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      default:
        return 0
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1
    }
    return 0
  })

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUpIcon className="h-4 w-4 text-gray-300" />
    }
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="h-4 w-4 text-blue-500" /> : 
      <ChevronDownIcon className="h-4 w-4 text-blue-500" />
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 Employee Purchase Tracking</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track sales made to employees (customers who match staff member names)
          </p>
        </div>

        {/* Date Filter */}
        <div className="card">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            
            <div className="flex items-end">
              <button
                onClick={fetchEmployeePurchases}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Employee Purchases'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <MetricCard
              title="Total Orders"
              value={summary?.totalOrders.toLocaleString() || '0'}
              icon="📋"
              loading={loading}
            />
            <MetricCard
              title="Total Value"
              value={summary?.totalValue ? formatCurrency(summary.totalValue) : '$0'}
              icon="💰"
              loading={loading}
            />
            <MetricCard
              title="Total Discounts"
              value={summary?.totalDiscounts ? formatCurrency(summary.totalDiscounts) : '$0'}
              icon="🏷️"
              loading={loading}
            />
            <MetricCard
              title="Avg Order Value"
              value={summary?.avgOrderValue ? formatCurrency(summary.avgOrderValue) : '$0'}
              icon="📊"
              loading={loading}
            />
            <MetricCard
              title="Avg Discount %"
              value={summary?.avgDiscountPercentage ? `${summary.avgDiscountPercentage.toFixed(1)}%` : '0%'}
              icon="💸"
              loading={loading}
            />
            <MetricCard
              title="Unique Employees"
              value={summary?.uniqueEmployees.toLocaleString() || '0'}
              icon="👥"
              loading={loading}
            />
          </div>
        )}

        {/* Orders Table */}
        {(orders.length > 0 || loading) && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">📋 Employee Purchase Orders ({orders.length} orders)</h3>
            {loading ? (
              <LoadingSpinner size="md" className="py-8" />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('customer_name')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Employee Customer</span>
                          {getSortIcon('customer_name')}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('total')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Total</span>
                          {getSortIcon('total')}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount %</th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('sales_person')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Sales Person</span>
                          {getSortIcon('sales_person')}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Date</span>
                          {getSortIcon('created_at')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedOrders.map((order) => (
                      <>
                        <tr key={order.order_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleOrderExpansion(order.order_id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {expandedOrders.has(order.order_id) ? (
                                <ChevronDownIcon className="h-5 w-5" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">
                            {order.order_name}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-900">{order.customer_name}</div>
                            <div className="text-gray-500 text-xs">{order.customer_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.discount_amount > 0 ? (
                              <div>
                                <div className="font-medium text-orange-600">{formatCurrency(order.discount_amount)}</div>
                                {order.discount_code && (
                                  <div className="text-xs text-gray-500">{order.discount_code}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.discount_percentage > 0 ? (
                              <span className="font-medium text-orange-600">{order.discount_percentage.toFixed(1)}%</span>
                            ) : (
                              <span className="text-gray-400">0%</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.sales_person || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.location || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(order.created_at)}
                          </td>
                        </tr>
                        
                        {/* Expandable Order Details */}
                        {expandedOrders.has(order.order_id) && (
                          <tr>
                            <td colSpan={9} className="px-4 py-3 bg-gray-50">
                              <div className="space-y-3">
                                <h4 className="font-medium text-gray-900">Order Details</h4>
                                
                                {/* Order Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Subtotal:</span>
                                    <span className="ml-2 font-medium">{formatCurrency(order.subtotal)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Discount:</span>
                                    <span className="ml-2 font-medium text-orange-600">
                                      {order.discount_amount > 0 ? `-${formatCurrency(order.discount_amount)}` : '$0.00'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Discount %:</span>
                                    <span className="ml-2 font-medium text-orange-600">
                                      {order.discount_percentage > 0 ? `${order.discount_percentage.toFixed(1)}%` : '0%'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Taxes:</span>
                                    <span className="ml-2 font-medium">{formatCurrency(order.taxes)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total:</span>
                                    <span className="ml-2 font-medium text-green-600">{formatCurrency(order.total)}</span>
                                  </div>
                                </div>

                                {/* Line Items */}
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-2">Items Purchased</h5>
                                  <div className="bg-white rounded border">
                                    <table className="min-w-full">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">UPC/SKU</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vendor</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {order.line_items.map((item, idx) => (
                                          <tr key={idx}>
                                            <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title={item.name}>
                                              {item.name}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600 font-mono">
                                              {item.sku}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600">
                                              {item.vendor}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600">
                                              {item.quantity}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600">
                                              {formatCurrency(item.price)}
                                            </td>
                                            <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                              {formatCurrency(item.line_total)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to View Employee Purchases
              </h3>
              <p className="text-gray-600">
                This dashboard shows orders where customers match staff member names - tracking sales TO employees
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}