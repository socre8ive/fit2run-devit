'use client'

import { useState } from 'react'
import DatePicker from 'react-datepicker'
import { CalendarIcon } from '@heroicons/react/24/outline'
import "react-datepicker/dist/react-datepicker.css"

interface DateRange {
  startDate: Date | null
  endDate: Date | null
}

interface DateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  onChange: (dates: DateRange) => void
  className?: string
}

export default function DateRangePicker({ 
  startDate, 
  endDate, 
  onChange, 
  className = '' 
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-2">
        <div className="relative">
          <DatePicker
            selected={startDate}
            onChange={(date) => onChange({ startDate: date, endDate })}
            placeholderText="Start Date"
            className="input-field pr-10 w-full"
            dateFormat="yyyy-MM-dd"
          />
          <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        
        <span className="text-gray-500">to</span>
        
        <div className="relative">
          <DatePicker
            selected={endDate}
            onChange={(date) => onChange({ startDate, endDate: date })}
            placeholderText="End Date"
            className="input-field pr-10 w-full"
            dateFormat="yyyy-MM-dd"
          />
          <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}