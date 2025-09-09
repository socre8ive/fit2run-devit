export interface MetricData {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: string
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }[]
}

export interface SalesData {
  date: string
  location: string
  revenue: number
  orders: number
  customers: number
  conversion_rate?: number
}

export interface StoreRanking {
  location: string
  revenue: number
  orders: number
  rank: number
  change: number
}

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface User {
  id: string
  email: string
  name: string
}