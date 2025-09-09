'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { VideoCameraIcon, UsersIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface StoreTraffic {
  name: string
  traffic: number
  hourly_rate: number
  last_update: string | null
  status: 'active' | 'stale' | 'no_data'
}

interface TrafficData {
  timestamp: string
  date: string
  stores: StoreTraffic[]
  summary: {
    total_traffic: number
    active_stores: number
    total_stores: number
    avg_per_store: number
  }
}

export default function FootTrafficPage() {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchTrafficData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/foot-traffic')
      
      if (!response.ok) {
        throw new Error('Failed to fetch traffic data')
      }
      
      const data = await response.json()
      setTrafficData(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching traffic data:', err)
      setError('Failed to load traffic data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrafficData()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchTrafficData, 60000)
    
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'stale':
        return 'bg-yellow-100 text-yellow-800'
      case 'no_data':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      case 'stale':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
      case 'no_data':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <VideoCameraIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Foot Traffic Monitor</h1>
                <p className="text-sm text-gray-500">Real-time store visitor counts from SoLink cameras</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {lastUpdate && (
                <span className="text-sm text-gray-500">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchTrafficData}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={loading}
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {trafficData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Visitors Today</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {trafficData.summary.total_traffic.toLocaleString()}
                  </p>
                </div>
                <UsersIcon className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Stores</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {trafficData.summary.active_stores} / {trafficData.summary.total_stores}
                  </p>
                </div>
                <div className="flex flex-col space-y-1">
                  <div className="w-8 h-1 bg-green-500 rounded"></div>
                  <div className="w-8 h-1 bg-gray-300 rounded"></div>
                  <div className="w-8 h-1 bg-gray-300 rounded"></div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Average Per Store</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Math.round(trafficData.summary.avg_per_store)}
                  </p>
                </div>
                <div className="text-2xl">📊</div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Current Date</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Date(trafficData.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-2xl">📅</div>
              </div>
            </div>
          </div>
        )}

        {/* Store Traffic Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Store Traffic Details</h2>
          </div>
          
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center items-center h-64">
              <div className="text-red-600">{error}</div>
            </div>
          )}
          
          {!loading && !error && trafficData && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Store
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visitors
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Per Hour
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Update
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trafficData.stores
                    .filter(store => store.traffic > 0 || store.status === 'active')
                    .sort((a, b) => b.traffic - a.traffic)
                    .map((store) => (
                      <tr key={store.name} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIndicator(store.status)}
                            <span className="ml-3 text-sm font-medium text-gray-900">
                              {store.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(store.status)}`}>
                            {store.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-lg font-semibold text-gray-900">
                            {store.traffic.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-600">
                            {store.hourly_rate.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {store.last_update ? 
                            new Date(store.last_update).toLocaleTimeString() : 
                            'No data'
                          }
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ticker Strip */}
        {trafficData && (
          <div className="mt-6 bg-black rounded-lg overflow-hidden" style={{ height: '60px' }}>
            <div className="h-full relative">
              <div 
                className="absolute h-full flex items-center whitespace-nowrap"
                style={{
                  animation: 'scroll-left 60s linear infinite',
                }}
              >
                {[...trafficData.stores, ...trafficData.stores].map((store, index) => (
                  <div 
                    key={`${store.name}-${index}`} 
                    className="inline-flex items-center px-8 h-full border-r border-gray-800"
                  >
                    <span className="text-cyan-400 font-bold text-lg mr-4">
                      {store.name}
                    </span>
                    <span className="text-green-400 font-bold text-2xl mr-2">
                      {store.traffic}
                    </span>
                    <span className="text-gray-500 text-sm uppercase mr-4">
                      visitors
                    </span>
                    <span className="text-orange-400 text-sm">
                      {store.hourly_rate.toFixed(1)}/hr
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <style jsx>{`
              @keyframes scroll-left {
                0% {
                  transform: translateX(0);
                }
                100% {
                  transform: translateX(-50%);
                }
              }
            `}</style>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}