'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChartBarIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  UsersIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  MapPinIcon,
  ChartPieIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: 'Performance Dashboard', href: '/', icon: ChartBarIcon },
  { name: 'Shopify Sales Report', href: '/shopify', icon: ShoppingBagIcon },
  { name: 'Fit2Run Budget', href: '/budget', icon: CurrencyDollarIcon },
  { name: 'Store Rankings', href: '/rankings', icon: TrophyIcon },
  { name: 'Employee Analytics', href: '/employees', icon: UsersIcon },
  { name: 'Product Intelligence', href: '/products', icon: CubeIcon },
  { name: 'Inventory Intelligence', href: '/inventory', icon: BuildingStorefrontIcon },
  { name: 'Repeat Customer Analysis', href: '/customers', icon: ArrowPathIcon },
  { name: 'Top Customers by Location', href: '/customer-locations', icon: MapPinIcon },
  { name: 'Conversion Report', href: '/conversion-report', icon: ChartPieIcon },
  { name: 'SoLink Door Counts', href: '/solink-door-counts', icon: UserGroupIcon },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                    ${isActive 
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`
                    mr-3 h-5 w-5 flex-shrink-0
                    ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}
                  `} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}