import { 
  ArrowUpIcon, 
  ArrowDownIcon 
} from '@heroicons/react/24/solid'

interface MetricCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: string
  loading?: boolean
}

export default function MetricCard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral',
  icon,
  loading = false 
}: MetricCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600'
      case 'negative':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return <ArrowUpIcon className="w-4 h-4" />
      case 'negative':
        return <ArrowDownIcon className="w-4 h-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {icon && (
              <span className="ml-2 text-2xl">{icon}</span>
            )}
          </div>
          {change && (
            <div className={`flex items-center mt-2 ${getChangeColor()}`}>
              {getChangeIcon()}
              <span className="ml-1 text-sm font-medium">{change}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}