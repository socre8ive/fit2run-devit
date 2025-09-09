'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import LoadingSpinner from '@/components/UI/LoadingSpinner'

interface ConversionData {
  store_name: string
  report_date: string
  total_visitors: number
  total_sales: string
  transaction_count: number
  conversion_rate: string
}

export default function ConversionReport() {
  const [data, setData] = useState<ConversionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    fetchConversionData()
  }, [selectedDate])

  const fetchConversionData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const url = selectedDate 
        ? `/api/conversion-report?date=${selectedDate}`
        : '/api/conversion-report'
        
      const response = await fetch(url)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch conversion data')
      }
      
      setData(result.data)
      setSummary(result.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const url = selectedDate 
        ? `/api/conversion-report?date=${selectedDate}`
        : '/api/conversion-report'
        
      const response = await fetch(url)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch conversion data')
      }
      
      // Create and download CSV file
      const blob = new Blob([result.csv], { type: 'text/csv' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      
      const dateStr = selectedDate || new Date(Date.now() - 86400000).toISOString().split('T')[0]
      link.download = `conversion_report_${dateStr}.csv`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data')
    }
  }

  const getYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Store Conversion Report</h1>
          
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Report Date
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate || getYesterday()}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={getYesterday()}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleExport}
                disabled={loading || !data.length}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Export to CSV
              </button>
            </div>
          </div>
          
          {summary && (
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Total Stores</p>
                <p className="text-2xl font-bold">{summary.total_stores}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Total Visitors</p>
                <p className="text-2xl font-bold">{summary.total_visitors.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">${parseFloat(summary.total_sales).toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold">{summary.total_transactions.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-600">Avg Conversion Rate</p>
                <p className="text-2xl font-bold">{summary.avg_conversion_rate}%</p>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
            No conversion data available for the selected date. Note: Only stores with door count sensors are included.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Store Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visitors
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conversion Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.store_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.report_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {row.total_visitors.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${parseFloat(row.total_sales).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {row.transaction_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {row.conversion_rate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}