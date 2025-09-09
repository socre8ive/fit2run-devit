'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  UserIcon, 
  BellIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
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
  VideoCameraIcon,
} from '@heroicons/react/24/outline'

const navigationGroups = [
  {
    name: 'Dashboard',
    items: [
      { name: 'Performance Dashboard', href: '/', icon: ChartBarIcon },
    ]
  },
  {
    name: 'Sales & Revenue',
    items: [
      { name: 'Recent Orders', href: '/recent-orders', icon: ShoppingBagIcon },
      { name: 'Shopify Sales Report', href: '/shopify', icon: ShoppingBagIcon },
      { name: 'Fit2Run Budget', href: '/budget', icon: CurrencyDollarIcon },
      { name: 'Store Rankings', href: '/rankings', icon: TrophyIcon },
      { name: 'Store Analytics', href: '/store-analytics', icon: BuildingStorefrontIcon },
      { name: 'Conversion Report', href: '/conversion-report', icon: ChartPieIcon },
    ]
  },
  {
    name: 'Products & Inventory',
    items: [
      { name: 'Product Intelligence', href: '/products', icon: CubeIcon },
      { name: 'Inventory Intelligence', href: '/inventory', icon: BuildingStorefrontIcon },
      { name: 'Last Year Comparison', href: '/ly-comparison', icon: ChartBarIcon },
      { name: 'Vendor Sales', href: '/vendor-sales', icon: ChartPieIcon },
    ]
  },
  {
    name: 'Customers',
    items: [
      { name: 'Repeat Customer Analysis', href: '/customers', icon: ArrowPathIcon },
      { name: 'Top Customers by Location', href: '/customer-locations', icon: MapPinIcon },
    ]
  },
  {
    name: 'Team',
    items: [
      { name: 'Employee Analytics', href: '/employees', icon: UsersIcon },
      { name: 'Employee Sales Over Time', href: '/employee-sales', icon: ChartBarIcon },
      { name: 'Employee Purchase Tracking', href: '/employee-purchases', icon: ShoppingBagIcon },
    ]
  },
  {
    name: 'Operations',
    items: [
      { name: 'SoLink Camera Analytics', href: '/solink', icon: VideoCameraIcon },
      { name: 'Foot Traffic Monitor', href: '/foot-traffic', icon: UsersIcon },
    ]
  }
]

export default function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleMouseEnter = (groupName: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setActiveDropdown(groupName)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null)
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Left side - Logo and Navigation */}
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <h1 className="text-lg font-semibold text-gray-900">
                  🏃‍♂️ Fit2Run Analytics
                </h1>
              </div>

              {/* Desktop Navigation Menu */}
              <nav className="hidden lg:flex items-center space-x-1">
              {navigationGroups.map((group) => {
                const isActive = group.items.some(item => item.href === pathname)
                
                return (
                  <div
                    key={group.name}
                    className="relative"
                    onMouseEnter={() => handleMouseEnter(group.name)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                        isActive 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {group.name}
                      <ChevronDownIcon className="ml-1 h-4 w-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeDropdown === group.name && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                        {group.items.map((item) => {
                          const Icon = item.icon
                          const isItemActive = pathname === item.href
                          
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={`flex items-center px-4 py-3 text-sm transition-colors duration-150 ${
                                isItemActive
                                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              onClick={() => setActiveDropdown(null)}
                            >
                              <Icon className={`mr-3 h-5 w-5 ${
                                isItemActive ? 'text-blue-600' : 'text-gray-400'
                              }`} />
                              {item.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-5 h-5" />
              ) : (
                <Bars3Icon className="w-5 h-5" />
              )}
            </button>

            <button className="hidden sm:block p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150">
              <BellIcon className="w-5 h-5" />
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="hidden sm:block p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
              
              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <Link
                      href="/user-management"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                      onClick={() => setShowSettingsMenu(false)}
                    >
                      <UsersIcon className="w-4 h-4 mr-3" />
                      User Management
                    </Link>
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center text-sm rounded-md p-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 transition-colors duration-150"
              >
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                </div>
                <ChevronDownIcon className="ml-1 h-4 w-4 text-gray-400" />
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <div className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium">Dashboard User</div>
                      <div className="text-gray-500">Fit2Run Analytics</div>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                      <ArrowRightOnRectangleIcon className="w-4 h-4 mr-3" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 py-3 space-y-1">
            {navigationGroups.map((group) => (
              <div key={group.name} className="space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {group.name}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-150 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon className={`mr-3 h-5 w-5 ${
                        isActive ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}