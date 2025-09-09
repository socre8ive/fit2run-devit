'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import MetricCard from '@/components/UI/MetricCard'
import DateRangePicker from '@/components/UI/DateRangePicker'
import BarChart from '@/components/Charts/BarChart'
import LineChart from '@/components/Charts/LineChart'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import { ChartData } from 'chart.js'

interface InventorySummary {
  totalSKUs: number
  totalUnits: number
  totalValue: number
  avgPrice: number
}

interface InventoryItem {
  sku: string
  productName: string
  vendorName: string
  retailPrice: number
  currentStock: number
  mhDepartment: string
  totalValue: number
}

interface VendorSummary {
  vendor: string
  skus: number
  units: number
  totalValue: number
  avgPrice: number
}

interface DepartmentSummary {
  department: string
  skus: number
  units: number
  totalValue: number
}

export default function InventoryDashboard() {
  const [selectedLocation, setSelectedLocation] = useState('')
  const [availableLocations, setAvailableLocations] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState(0)
  const [minTotalValue, setMinTotalValue] = useState(0)
  const [activeTab, setActiveTab] = useState('highValue')
  const [sortBy, setSortBy] = useState('Total Value')
  
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [highValueItems, setHighValueItems] = useState<InventoryItem[]>([])
  const [vendorSummary, setVendorSummary] = useState<VendorSummary[]>([])
  const [departmentSummary, setDepartmentSummary] = useState<DepartmentSummary[]>([])
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load available locations on mount
  useEffect(() => {
    fetchAvailableLocations()
  }, [])

  const fetchAvailableLocations = async () => {
    try {
      const response = await fetch('/api/inventory?initialData=true')
      const data = await response.json()
      if (data.availableLocations && data.availableLocations.length > 0) {
        setAvailableLocations(data.availableLocations)
        setSelectedLocation(data.availableLocations[0]) // Select first location by default
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchInventoryData = async () => {
    if (!selectedLocation) {
      setError('Please select a location')
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        location: selectedLocation,
        minPrice: minPrice.toString(),
        minTotalValue: minTotalValue.toString(),
      })

      const response = await fetch(`/api/inventory?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data')
      }

      setSummary(data.summary)
      setHighValueItems(data.highValueItems || [])
      setVendorSummary(data.vendorSummary || [])
      setDepartmentSummary(data.departmentSummary || [])
      setAllInventory(data.allInventory || [])
    } catch (error) {
      console.error('Error fetching inventory data:', error)
      setError('Failed to load inventory data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when location or filters change
  useEffect(() => {
    if (selectedLocation) {
      fetchInventoryData()
    }
  }, [selectedLocation, minPrice, minTotalValue])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📦 Inventory Intelligence Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Current inventory snapshot and value analysis
          </p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏬 Select Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input-field w-full"
              >
                {availableLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Min Retail Price
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={minPrice}
                onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
                className="input-field w-full"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Min Total Item Value
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={minTotalValue}
                onChange={(e) => setMinTotalValue(parseFloat(e.target.value) || 0)}
                className="input-field w-full"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Inventory Overview */}
        {(summary || loading) && (
          <div>
            <h2 className="text-xl font-semibold mb-4">📊 Inventory Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total SKUs"
                value={summary?.totalSKUs.toLocaleString() || '0'}
                icon="📦"
                loading={loading}
              />
              <MetricCard
                title="Total Units"
                value={summary?.totalUnits.toLocaleString() || '0'}
                icon="📊"
                loading={loading}
              />
              <MetricCard
                title="Total Value"
                value={summary ? formatCurrency(summary.totalValue) : '$0'}
                icon="💰"
                loading={loading}
              />
              <MetricCard
                title="Avg Price"
                value={summary ? formatCurrency(summary.avgPrice) : '$0'}
                icon="💵"
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* Inventory Analysis Tabs */}
        {(selectedLocation && !loading) && (
          <div className="card">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('highValue')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'highValue'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  💰 High Value Items
                </button>
                <button
                  onClick={() => setActiveTab('vendor')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'vendor'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🏭 Vendor Breakdown
                </button>
                <button
                  onClick={() => setActiveTab('department')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'department'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🏪 Department Analysis
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'all'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📋 All Inventory
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="pt-6">
              {activeTab === 'highValue' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">💰 Highest Value Items</h3>
                  {loading ? (
                    <LoadingSpinner size="md" className="py-8" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retail Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {highValueItems.slice(0, 50).map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate" title={item.productName}>
                                {item.productName}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.vendorName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.currentStock.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(item.retailPrice)}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(item.totalValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'vendor' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">🏭 By Vendor</h3>
                  {loading ? (
                    <LoadingSpinner size="md" className="py-8" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKUs</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {vendorSummary.map((vendor, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{vendor.vendor}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{vendor.skus.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{vendor.units.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(vendor.totalValue)}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(vendor.avgPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'department' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">🏪 By Department</h3>
                  {loading ? (
                    <LoadingSpinner size="md" className="py-8" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKUs</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {departmentSummary.map((dept, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.department}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{dept.skus.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{dept.units.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(dept.totalValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'all' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">📋 Complete Inventory</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort by:</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="input-field"
                      >
                        <option value="Total Value">Total Value</option>
                        <option value="Retail Price">Retail Price</option>
                        <option value="Stock Quantity">Stock Quantity</option>
                        <option value="Product Name">Product Name</option>
                      </select>
                    </div>
                  </div>
                  {loading ? (
                    <LoadingSpinner size="md" className="py-8" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retail Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {allInventory
                            .sort((a, b) => {
                              switch (sortBy) {
                                case 'Total Value': return b.totalValue - a.totalValue
                                case 'Retail Price': return b.retailPrice - a.retailPrice
                                case 'Stock Quantity': return b.currentStock - a.currentStock
                                case 'Product Name': return a.productName.localeCompare(b.productName)
                                default: return b.totalValue - a.totalValue
                              }
                            })
                            .map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.sku}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate" title={item.productName}>
                                  {item.productName}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.vendorName}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.mhDepartment}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.currentStock.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(item.retailPrice)}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(item.totalValue)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!selectedLocation ? (
          <div className="card">
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Location to View Inventory Analytics
              </h3>
              <p className="text-gray-600">
                Choose a store location to analyze current inventory levels and values
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}