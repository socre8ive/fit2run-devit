'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import SortableTable from '@/components/UI/SortableTable'

interface LYComparisonData {
  upc: string
  productName: string
  vendor: string
  category: string
  thisYearSales: number
  lastYearSales: number
  percentageChange: number
  dollarChange: number
  thisYearUnits: number
  lastYearUnits: number
  percentOfTotal?: number
}

interface BrandSummary {
  brand: string
  category: string
  thisYearSales: number
  lastYearSales: number
  thisYearUnits: number
  lastYearUnits: number
  percentageChange: number
  dollarChange: number
  uniqueProducts: number
  totalPercentOfSales?: number
}

interface LYComparisonSummary {
  totalThisYear: number
  totalLastYear: number
  totalPercentageChange: number
  totalDollarChange: number
  totalUPCs: number
  positiveUPCs: number
  negativeUPCs: number
}

interface DateRanges {
  thisYearStart: string
  thisYearEnd: string
  lastYearStart: string
  lastYearEnd: string
}

interface LYComparisonResponse {
  data: LYComparisonData[]
  summary: LYComparisonSummary
  brandSummary: BrandSummary | null
  dateRanges: DateRanges
}

// Real store locations based on actual order data - sorted by order volume
const STORE_LOCATIONS = [
  'all_stores', 'disneysprings', 'tampa', 'ecom', 'utc', 'events', 'gardens', 'ellenton',
  'coconutpoint', 'bradenton', 'waterford', 'millenia', 'wellington', 'coastland',
  'keywest', 'oldstpete', 'celebration', 'altamonte', 'paddockmall', 'brandon',
  'wiregrass', 'pierpark', 'flamingo', 'sanjuan', 'countryside', 'mallofgeorgia',
  'melbourne', 'avenues', 'daniapointe', 'cordova', 'coconutcreek', 'barceloneta',
  'orangepark', 'destin', 'treasurecoast', 'plazadelcaribe', 'plazadelsol',
  'sarasota', 'mayaguez', 'aventura', 'tyrone', 'stpete', 'clearwater',
  'carolina', 'fajardo', 'ftmyersoutlet', 'palmbeachgardens', 'perimeter',
  'plazacarolina', '6laps', 'augusta'
]

export default function LYComparison() {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [singleDateMode, setSingleDateMode] = useState(true)
  const [selectedStore, setSelectedStore] = useState<string>('all_stores')
  const [selectedVendor, setSelectedVendor] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMatchType, setSelectedMatchType] = useState<string>('all')
  const [vendors, setVendors] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [data, setData] = useState<LYComparisonResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load vendors and categories on component mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [vendorsRes, categoriesRes] = await Promise.all([
          fetch('/api/ly-comparison/vendors'),
          fetch('/api/ly-comparison/categories')
        ])
        
        if (vendorsRes.ok) {
          const vendorData = await vendorsRes.json()
          setVendors(vendorData)
        }
        
        if (categoriesRes.ok) {
          const categoryData = await categoriesRes.json()
          setCategories(categoryData)
        }
      } catch (err) {
        console.error('Failed to load options:', err)
      }
    }

    loadOptions()
  }, [])

  const fetchData = async () => {
    if (!startDate) {
      setError('Please select a date')
      return
    }
    
    // For date range mode, ensure end date is set
    if (!singleDateMode && !endDate) {
      setError('Please select an end date for the range')
      return
    }
    
    try {
      // For single date mode, use same date for start and end if endDate is not set
      const effectiveEndDate = singleDateMode ? startDate : (endDate || startDate)
      
      // Validate dates
      if (effectiveEndDate < startDate) {
        setError('End date cannot be before start date')
        return
      }
      
      setLoading(true)
      setError('')
      setData(null)
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: effectiveEndDate.toISOString().split('T')[0],
        stores: selectedStore || 'all_stores',
        vendor: selectedVendor || 'all',
        category: selectedCategory || 'all',
        matchType: selectedMatchType || 'all'
      })
      
      console.log('Fetching LY comparison with params:', params.toString())
      
      const response = await fetch(`/api/ly-comparison?${params}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Response Error:', errorText)
        throw new Error(`API request failed with status ${response.status}: ${errorText}`)
      }
      
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      setData(result)
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // Remove auto-fetch on date change - only fetch when Compare button is clicked
  // This prevents errors when dates are partially entered
  /*
  useEffect(() => {
    if (startDate && (singleDateMode || endDate)) {
      const timeoutId = setTimeout(() => {
        fetchData()
      }, 500) // Debounce API calls
      
      return () => clearTimeout(timeoutId)
    }
  }, [startDate, endDate, singleDateMode, selectedStore, selectedVendor, selectedCategory, selectedMatchType])
  */

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US').format(num)

  const formatPercentage = (percent: number) => {
    if (percent === 0) return '0.0%'
    if (percent > 0) return `+${percent.toFixed(1)}%`
    return `${percent.toFixed(1)}%`
  }

  const columns = [
    { key: 'upc', label: 'UPC', sortable: true },
    { key: 'productName', label: 'Product Name', sortable: true },
    { key: 'vendor', label: 'Vendor', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'thisYearSales', label: 'This Year Sales', sortable: true, format: (value: number) => formatCurrency(value) },
    { key: 'lastYearSales', label: 'Last Year Sales', sortable: true, format: (value: number) => formatCurrency(value) },
    { key: 'percentageChange', label: '% Change', sortable: true, format: (value: number) => formatPercentage(value) },
    { key: 'dollarChange', label: '$ Change', sortable: true, format: (value: number) => formatCurrency(value) },
    { key: 'thisYearUnits', label: 'This Year Units', sortable: true },
    { key: 'lastYearUnits', label: 'Last Year Units', sortable: true },
    { key: 'percentOfTotal', label: '% of Total Sales', sortable: true, format: (value: number | undefined) => value ? `${value.toFixed(2)}%` : '0.00%' }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Last Year Comparison</h1>
          <p className="mt-1 text-sm text-gray-600">
            Compare product performance against the same period last year
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Source: Shopify order data with catalog information
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="space-y-4">
            {/* Date Selection Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Selection Mode
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={singleDateMode}
                    onChange={() => setSingleDateMode(true)}
                    className="mr-2"
                  />
                  Single Date
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!singleDateMode}
                    onChange={() => setSingleDateMode(false)}
                    className="mr-2"
                  />
                  Date Range
                </label>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {singleDateMode ? 'Date' : 'Date Range'}
                </label>
                {singleDateMode ? (
                  <input
                    type="date"
                    value={startDate ? startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={startDate ? startDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                      placeholder="Start Date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={endDate ? endDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                      placeholder="End Date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STORE_LOCATIONS.map(location => (
                    <option key={location} value={location}>
                      {location === 'all_stores' ? 'All Stores' : location.charAt(0).toUpperCase() + location.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Vendors</option>
                  {vendors.map(vendor => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category.toLowerCase()}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Match Type
                </label>
                <select
                  value={selectedMatchType}
                  onChange={(e) => setSelectedMatchType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Products</option>
                  <option value="matches">Only products sold in both years</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={fetchData}
                  disabled={!startDate || (!singleDateMode && !endDate) || loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Compare'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Date Ranges Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📅 Comparison Periods</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600">This Year Period</div>
                  <div className="text-lg font-semibold">
                    {new Date(data.dateRanges.thisYearStart).toLocaleDateString()} - {new Date(data.dateRanges.thisYearEnd).toLocaleDateString()}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600">Last Year Period</div>
                  <div className="text-lg font-semibold">
                    {new Date(data.dateRanges.lastYearStart).toLocaleDateString()} - {new Date(data.dateRanges.lastYearEnd).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Summary (when vendor is selected) */}
            {data.brandSummary && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">🏢 Brand Summary: {data.brandSummary.brand}</h3>
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-purple-600">This Year Sales</div>
                      <div className="text-xl font-bold text-purple-900">{formatCurrency(data.brandSummary.thisYearSales)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-purple-600">Last Year Sales</div>
                      <div className="text-xl font-bold text-purple-900">{formatCurrency(data.brandSummary.lastYearSales)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-purple-600">Growth</div>
                      <div className={`text-xl font-bold ${data.brandSummary.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(data.brandSummary.percentageChange)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-purple-600">Dollar Change</div>
                      <div className={`text-xl font-bold ${data.brandSummary.dollarChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.brandSummary.dollarChange)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-purple-600">% of Total Sales</div>
                      <div className="text-xl font-bold text-blue-600">
                        {data.brandSummary.totalPercentOfSales ? `${data.brandSummary.totalPercentOfSales.toFixed(2)}%` : '0.00%'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-sm text-purple-600">
                      Category: {data.brandSummary.category} • 
                      This Year Units: {formatNumber(data.brandSummary.thisYearUnits)} • 
                      Last Year Units: {formatNumber(data.brandSummary.lastYearUnits)} • 
                      Unique Products: {formatNumber(data.brandSummary.uniqueProducts)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Metrics - Only show when no vendor is selected */}
            {!data.brandSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="This Year Sales"
                  value={formatCurrency(data.summary.totalThisYear)}
                  icon="💰"
                  loading={loading}
                />
                <MetricCard
                  title="Last Year Sales"
                  value={formatCurrency(data.summary.totalLastYear)}
                  icon="📊"
                  loading={loading}
                />
                <MetricCard
                  title="Total Change"
                  value={formatPercentage(data.summary.totalPercentageChange)}
                  icon={data.summary.totalPercentageChange >= 0 ? "📈" : "📉"}
                  loading={loading}
                />
                <MetricCard
                  title="Dollar Change"
                  value={formatCurrency(data.summary.totalDollarChange)}
                  icon={data.summary.totalDollarChange >= 0 ? "💹" : "📉"}
                  loading={loading}
                />
              </div>
            )}


            {/* Product Data Table */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📋 Product Comparison Data</h3>
              <SortableTable
                data={data.data}
                columns={columns}
              />
            </div>
          </>
        )}

        {/* Empty State */}
        {!data && !loading && !error && (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Date and Filters to Compare
              </h3>
              <p className="text-gray-600">
                Choose your date period and filters to analyze year-over-year performance
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}