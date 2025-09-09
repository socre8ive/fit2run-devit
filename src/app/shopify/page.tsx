'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LineChart from '@/components/Charts/LineChart'
import BarChart from '@/components/Charts/BarChart'
import PieChart from '@/components/Charts/PieChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'
import { format } from 'date-fns'
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface ShopifyMetrics {
  totalOrders: number
  totalRevenue: number
  uniqueCustomers: number
  avgOrderValue: number
  totalItems: number
  uniqueProducts: number
}

interface LocationSales {
  location: string
  orders: number
  revenue: number
  avgOrderValue: number
  itemsSold: number
}

interface BrandSales {
  brand: string
  orders: number
  revenue: number
  itemsSold: number
  uniqueSkus: number
}

interface TopProduct {
  sku: string
  productName: string
  brand: string
  orders: number
  revenue: number
  quantitySold: number
  avgPrice: number
}

interface OrderDetail {
  id: string
  orderNumber: string
  orderDate: string
  location: string
  employee: string
  productName: string
  sku: string
  vendor: string
  quantity: number
  unitPrice: number
  lineTotal: number
  subtotal: number
  financialStatus: string
}

interface ChartDatasets {
  daily: ChartData<'line'>
  locations: ChartData<'bar'>
  brands: ChartData<'pie'>
}

export default function ShopifyDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [locations, setLocations] = useState<string[]>([])
  const [metrics, setMetrics] = useState<ShopifyMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartDatasets | null>(null)
  const [locationSales, setLocationSales] = useState<LocationSales[]>([])
  const [brandSales, setBrandSales] = useState<BrandSales[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

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

  const fetchShopifyData = async () => {
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

      const response = await fetch(`/api/shopify?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setMetrics(data.metrics)
      setChartData(data.chartData)
      setLocationSales(data.locationSales)
      setBrandSales(data.brandSales || [])
      setTopProducts(data.topProducts || [])
      setOrderDetails(data.orderDetails || [])
    } catch (error) {
      console.error('Error fetching Shopify data:', error)
      setError('Failed to load Shopify data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchShopifyData(), 100)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const filteredOrderDetails = searchTerm
    ? orderDetails.filter(order =>
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendor?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : orderDetails

  const downloadCSV = () => {
    if (orderDetails.length === 0) return

    const headers = [
      'Order Number', 'Date', 'Location', 'Employee', 'Product Name', 
      'SKU', 'Brand', 'Quantity', 'Unit Price', 'Line Total', 'Status'
    ]
    
    // Use all order details for CSV download (no filtering by search term for complete export)
    const rows = orderDetails.map(order => [
      order.orderNumber,
      (() => {
        try {
          const date = new Date(order.orderDate)
          return isNaN(date.getTime()) ? order.orderDate : format(date, 'yyyy-MM-dd')
        } catch {
          return order.orderDate
        }
      })(),
      order.location || '',
      order.employee || '',
      order.productName || '',
      order.sku || '',
      order.vendor || '',
      order.quantity,
      order.unitPrice,
      order.lineTotal,
      order.financialStatus
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shopify_sales_${startDate?.toISOString().split('T')[0]}_to_${endDate?.toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const tabs = ['Quick Summary', 'By Location', 'By Brand', 'Top Products', 'Raw Data']

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopify Sales Report</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comprehensive sales analysis with product details
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
                onClick={fetchShopifyData}
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
              title="Avg Order Value"
              value={metrics ? formatCurrency(metrics.avgOrderValue) : '$0'}
              icon="📊"
              loading={loading}
            />
            <MetricCard
              title="Total Items"
              value={metrics?.totalItems.toLocaleString() || '0'}
              icon="🛍️"
              loading={loading}
            />
            <MetricCard
              title="Unique Products"
              value={metrics?.uniqueProducts?.toLocaleString() || '0'}
              icon="📋"
              loading={loading}
            />
          </div>
        )}

        {/* Tabs */}
        {metrics && !loading && (
          <div>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab, index) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(index)}
                    className={`
                      py-2 px-1 border-b-2 font-medium text-sm
                      ${activeTab === index
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-6">
              {/* Quick Summary Tab */}
              {activeTab === 0 && (
                <div className="space-y-6">
                  {chartData?.daily && (
                    <LineChart
                      data={chartData.daily}
                      title="Daily Revenue Trend"
                      height={350}
                    />
                  )}
                  
                  {/* Daily Summary Table */}
                  <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Daily Performance</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {chartData?.daily.labels?.map((date, idx) => (
                            <tr key={idx}>
                              <td className="px-6 py-4 text-sm text-gray-900">{String(date)}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {(chartData.daily.datasets[0].data[idx] as number).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {formatCurrency(chartData.daily.datasets[1]?.data[idx] as number || 0)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {(chartData.daily.datasets[2]?.data[idx] as number || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* By Location Tab */}
              {activeTab === 1 && (
                <div className="space-y-6">
                  {chartData?.locations && (
                    <BarChart
                      data={chartData.locations}
                      title="Top Locations by Revenue"
                      height={350}
                    />
                  )}
                  
                  <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Sales by Location</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items Sold</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Order</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {locationSales.map((location) => (
                            <tr key={location.location}>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{location.location}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{location.orders.toLocaleString()}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(location.revenue)}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{location.itemsSold?.toLocaleString() || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(location.avgOrderValue || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* By Brand Tab */}
              {activeTab === 2 && (
                <div className="space-y-6">
                  {chartData?.brands && (
                    <PieChart
                      data={chartData.brands}
                      title="Top Brands by Revenue"
                      height={350}
                    />
                  )}
                  
                  <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Brand Performance</h3>
                    {brandSales.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items Sold</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique SKUs</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {brandSales.map((brand) => (
                              <tr key={brand.brand}>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{brand.brand || 'Unknown Brand'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{brand.orders.toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(brand.revenue)}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{brand.itemsSold.toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{brand.uniqueSkus?.toLocaleString() || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500">No brand data available. This requires vendor information in the database.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Top Products Tab */}
              {activeTab === 3 && (
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Top Selling Products</h3>
                  {topProducts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Sold</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {topProducts.map((product) => (
                            <tr key={product.sku}>
                              <td className="px-6 py-4 text-sm font-mono text-gray-900">{product.sku}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{product.productName}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{product.brand || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{product.orders.toLocaleString()}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(product.revenue)}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{product.quantitySold.toLocaleString()}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(product.avgPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No product details available. This requires detailed order item data.</p>
                  )}
                </div>
              )}

              {/* Raw Data Tab */}
              {activeTab === 4 && (
                <div className="card">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Raw Sales Data</h3>
                    <div className="flex space-x-4">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search by SKU, Product, Order..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <button
                        onClick={downloadCSV}
                        disabled={orderDetails.length === 0}
                        className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                        Download CSV (All {orderDetails.length.toLocaleString()} records)
                      </button>
                    </div>
                  </div>

                  {orderDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredOrderDetails.slice(0, 100).map((order, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-sm text-gray-900">{order.orderNumber}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {(() => {
                                  try {
                                    const date = new Date(order.orderDate)
                                    return isNaN(date.getTime()) ? order.orderDate : format(date, 'MMM dd, yyyy')
                                  } catch {
                                    return order.orderDate
                                  }
                                })()}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">{order.location || '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{order.productName || '-'}</td>
                              <td className="px-4 py-2 text-sm font-mono text-gray-600">{order.sku || '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{order.vendor || '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{order.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(order.unitPrice)}</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatCurrency(order.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No detailed order data available. Select a date range to load data.</p>
                  )}
                  
                  {filteredOrderDetails.length > 100 && (
                    <p className="mt-4 text-sm text-gray-500 text-center">
                      Showing first 100 of {filteredOrderDetails.length} records. Download CSV for complete data.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🛍️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to View Shopify Sales
              </h3>
              <p className="text-gray-600">
                Choose a start and end date to analyze sales performance and product details
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}