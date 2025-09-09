'use client'

import { useState } from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface Column {
  key: string
  label: string
  sortable?: boolean
  format?: (value: any) => string
  colorCode?: boolean
  align?: 'left' | 'center' | 'right'
}

interface SortableTableProps {
  data: any[]
  columns: Column[]
  colorCodeColumn?: string // Column to use for performance color coding
  className?: string
}

export default function SortableTable({ 
  data, 
  columns, 
  colorCodeColumn,
  className = '' 
}: SortableTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('desc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0
    
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    
    // Handle numeric values
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    // Handle string values
    const aStr = String(aVal || '').toLowerCase()
    const bStr = String(bVal || '').toLowerCase()
    
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr)
    } else {
      return bStr.localeCompare(aStr)
    }
  })

  const getPerformanceColor = (value: number, columnKey: string): string => {
    if (!colorCodeColumn || columnKey !== colorCodeColumn) return ''
    
    // Calculate percentile ranking for color coding
    const values = data.map(row => parseFloat(row[colorCodeColumn]) || 0).sort((a, b) => b - a)
    const rank = values.indexOf(value)
    const percentile = rank / Math.max(values.length - 1, 1)
    
    // Color scale from dark green (best) to yellow/orange (worst)
    if (percentile <= 0.2) return 'bg-green-800 text-white'      // Top 20% - Dark Green
    if (percentile <= 0.4) return 'bg-green-600 text-white'      // 20-40% - Green  
    if (percentile <= 0.6) return 'bg-green-400 text-gray-900'   // 40-60% - Light Green
    if (percentile <= 0.8) return 'bg-yellow-400 text-gray-900'  // 60-80% - Yellow
    return 'bg-orange-400 text-gray-900'                         // Bottom 20% - Orange
  }

  const getRowBackgroundColor = (row: any): string => {
    if (!colorCodeColumn) return ''
    
    const value = parseFloat(row[colorCodeColumn]) || 0
    const values = data.map(r => parseFloat(r[colorCodeColumn]) || 0).sort((a, b) => b - a)
    const rank = values.indexOf(value)
    const percentile = rank / Math.max(values.length - 1, 1)
    
    // Subtle row background colors
    if (percentile <= 0.2) return 'bg-green-50'      // Top performers
    if (percentile <= 0.4) return 'bg-green-25'      
    if (percentile <= 0.6) return 'bg-white'         // Average performers
    if (percentile <= 0.8) return 'bg-yellow-50'     
    return 'bg-orange-50'                            // Lower performers
  }

  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${
                    column.align === 'right' ? 'text-right' : 
                    column.align === 'center' ? 'text-center' : 
                    'text-left'
                  }`}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center justify-between">
                    <span>{column.label}</span>
                    {column.sortable !== false && (
                      <div className="flex flex-col">
                        <ChevronUpIcon 
                          className={`h-3 w-3 ${
                            sortColumn === column.key && sortDirection === 'asc' 
                              ? 'text-blue-600' 
                              : 'text-gray-400'
                          }`} 
                        />
                        <ChevronDownIcon 
                          className={`h-3 w-3 -mt-1 ${
                            sortColumn === column.key && sortDirection === 'desc' 
                              ? 'text-blue-600' 
                              : 'text-gray-400'
                          }`} 
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr 
                key={index} 
                className={`hover:bg-gray-50 transition-colors ${getRowBackgroundColor(row)}`}
              >
                {columns.map((column) => {
                  const value = row[column.key]
                  const formattedValue = column.format ? column.format(value) : String(value || '')
                  const cellColorClass = column.colorCode ? getPerformanceColor(value, column.key) : ''
                  
                  return (
                    <td
                      key={column.key}
                      className={`px-6 py-4 whitespace-nowrap text-sm ${
                        column.align === 'right' ? 'text-right' : 
                        column.align === 'center' ? 'text-center' : 
                        'text-left'
                      }`}
                    >
                      {cellColorClass ? (
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${cellColorClass}`}>
                          {formattedValue}
                        </span>
                      ) : (
                        <span className={column.key === colorCodeColumn ? 'font-semibold' : ''}>
                          {formattedValue}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}