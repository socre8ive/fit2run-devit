'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import LineChart from '@/components/Charts/LineChart'
import BarChart from '@/components/Charts/BarChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'

interface ProductSummary {
  totalProducts: number
  totalRevenue: number
  totalUnits: number
  avgProductRevenue: number
}

interface Product {
  sku: string
  productName: string
  vendor: string
  totalQuantity: number
  totalRevenue: number
  avgPrice: number
  orderCount: number
  storeCount: number
  employeeCount: number
}

interface BrandPerformance {
  vendor: string
  totalQuantity: number
  totalRevenue: number
  totalOrders: number
  productCount: number
  avgPrice: number
}

export default function ProductsDashboard() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [availableStores, setAvailableStores] = useState<string[]>([])
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [availableVendors, setAvailableVendors] = useState<string[]>([])
  const [analysisFocus, setAnalysisFocus] = useState('Product Sales Overview')
  const [minQuantity, setMinQuantity] = useState(1)
  const [summary, setSummary] = useState<ProductSummary | null>(null)
  const [topProducts, setTopProducts] = useState<Product[]>([])
  const [brandPerformance, setBrandPerformance] = useState<BrandPerformance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [brandSortField, setBrandSortField] = useState<keyof BrandPerformance>('totalRevenue')
  const [brandSortDirection, setBrandSortDirection] = useState<'asc' | 'desc'>('desc')

  // Load initial data (stores and vendors) on mount
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      // Fetch just stores and vendors without full analysis
      const response = await fetch('/api/products?initialData=true')
      const data = await response.json()
      
      if (data.availableStores) {
        setAvailableStores(data.availableStores)
        setSelectedStores(data.availableStores) // Select all by default
      }
      if (data.availableVendors) {
        setAvailableVendors(data.availableVendors)
        setSelectedVendors(data.availableVendors) // Select all by default
      }
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const fetchProductsData = async () => {
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
        vendors: selectedVendors.join(','),
        analysisFocus: analysisFocus,
        minQuantity: minQuantity.toString()
      })

      const response = await fetch(`/api/products?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setSummary(data.summary)
      setTopProducts(data.topProducts)
      setBrandPerformance(data.brandPerformance || [])
      setAvailableStores(data.availableStores || [])
      setAvailableVendors(data.availableVendors || [])
      
      // Set defaults if not already set
      if (selectedStores.length === 0) {
        setSelectedStores(data.availableStores || [])
      }
      if (selectedVendors.length === 0) {
        setSelectedVendors(data.availableVendors || [])
      }
    } catch (error) {
      console.error('Error fetching products data:', error)
      setError('Failed to load products data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = ({ startDate: start, endDate: end }: { startDate: Date | null, endDate: Date | null }) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setTimeout(() => fetchProductsData(), 100)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handleBrandSort = (field: keyof BrandPerformance) => {
    if (brandSortField === field) {
      setBrandSortDirection(brandSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setBrandSortField(field)
      setBrandSortDirection('desc')
    }
  }

  const getSortedBrandPerformance = () => {
    return [...brandPerformance].sort((a, b) => {
      const aValue = a[brandSortField]
      const bValue = b[brandSortField]
      
      if (brandSortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }

  const getSortIcon = (field: keyof BrandPerformance) => {
    if (brandSortField !== field) return '↕️'
    return brandSortDirection === 'asc' ? '↑' : '↓'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📦 Product Performance Intelligence</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comprehensive product analysis with store and brand filtering
          </p>
        </div>

        {/* Main Filters */}
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
                🏬 Stores
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
                🏷️ Brands/Vendors
              </label>
              <select
                multiple
                value={selectedVendors}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  setSelectedVendors(values)
                }}
                className="input-field w-full h-20"
              >
                {availableVendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchProductsData}
                disabled={!startDate || !endDate || loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Analyze Products'}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Filters */}
        <div className="card">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎯 Analysis Focus
              </label>
              <select
                value={analysisFocus}
                onChange={(e) => setAnalysisFocus(e.target.value)}
                className="input-field w-full"
              >
                <option value="Product Sales Overview">Product Sales Overview</option>
                <option value="Brand Performance">Brand Performance</option>
                <option value="Employee Product Expertise">Employee Product Expertise</option>
                <option value="Store Product Mix">Store Product Mix</option>
                <option value="Price Analysis">Price Analysis</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Minimum Quantity Sold
              </label>
              <input
                type="number"
                min="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(parseInt(e.target.value) || 1)}
                className="input-field w-full"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchProductsData}
                disabled={!startDate || !endDate || loading}
                className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update Analysis
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
              title="Total Products"
              value={summary?.totalProducts.toLocaleString() || '0'}
              icon="📦"
              loading={loading}
            />
            <MetricCard
              title="Total Revenue"
              value={summary?.totalRevenue ? formatCurrency(summary.totalRevenue) : '$0'}
              icon="💰"
              loading={loading}
            />
            <MetricCard
              title="Total Units Sold"
              value={summary?.totalUnits.toLocaleString() || '0'}
              icon="📊"
              loading={loading}
            />
            <MetricCard
              title="Avg Product Revenue"
              value={summary?.avgProductRevenue ? formatCurrency(summary.avgProductRevenue) : '$0'}
              icon="📈"
              loading={loading}
            />
          </div>
        )}

        {/* Analysis Results Based on Focus */}
        {analysisFocus === 'Product Sales Overview' && (summary || loading) && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">📊 Product Sales Overview</h2>
            
            {/* Top Products by Revenue */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">🏆 Top 50 Products by Revenue</h3>
              {loading ? (
                <LoadingSpinner size="md" className="py-8" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">UPC/SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {topProducts.slice(0, 50).map((product, index) => (
                        <tr key={product.sku} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 max-w-xs truncate" title={product.productName}>
                            {product.productName}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 font-mono">{product.sku}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">{product.vendor}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-green-600">
                            {formatCurrency(product.totalRevenue)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">{product.totalQuantity.toLocaleString()}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">{formatCurrency(product.avgPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Products by Quantity */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📈 Top 50 Products by Quantity</h3>
              {loading ? (
                <LoadingSpinner size="md" className="py-8" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">UPC/SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...topProducts]
                        .sort((a, b) => b.totalQuantity - a.totalQuantity)
                        .slice(0, 50)
                        .map((product, index) => (
                          <tr key={product.sku} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 max-w-xs truncate" title={product.productName}>
                              {product.productName}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 font-mono">{product.sku}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{product.vendor}</td>
                            <td className="px-3 py-2 text-sm font-semibold text-blue-600">{product.totalQuantity.toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{formatCurrency(product.totalRevenue)}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{formatCurrency(product.avgPrice)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Brand Performance Analysis */}
        {analysisFocus === 'Brand Performance' && (brandPerformance.length > 0 || loading) && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">🏷️ Brand/Vendor Performance Analysis</h2>
            
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📊 Brand Performance Summary (All Brands)</h3>
              {loading ? (
                <LoadingSpinner size="md" className="py-8" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          onClick={() => handleBrandSort('vendor')}
                        >
                          Brand {getSortIcon('vendor')}
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          onClick={() => handleBrandSort('totalRevenue')}
                        >
                          Total Revenue {getSortIcon('totalRevenue')}
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          onClick={() => handleBrandSort('totalQuantity')}
                        >
                          Total Quantity {getSortIcon('totalQuantity')}
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          onClick={() => handleBrandSort('totalOrders')}
                        >
                          Total Orders {getSortIcon('totalOrders')}
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          onClick={() => handleBrandSort('productCount')}
                        >
                          Product Count {getSortIcon('productCount')}
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                          onClick={() => handleBrandSort('avgPrice')}
                        >
                          Avg Price {getSortIcon('avgPrice')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedBrandPerformance().map((brand, index) => (
                        <tr key={brand.vendor} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{brand.vendor}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            {formatCurrency(brand.totalRevenue)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{brand.totalQuantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{brand.totalOrders.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{brand.productCount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(brand.avgPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!startDate || !endDate ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date Range to View Product Analytics
              </h3>
              <p className="text-gray-600">
                Choose a start and end date to analyze product performance and sales patterns
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}