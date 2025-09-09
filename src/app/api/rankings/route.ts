import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minVisitors = parseInt(searchParams.get('minVisitors') || '100')
    const minOrders = parseInt(searchParams.get('minOrders') || '5')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Get visitor data from door_counts - exactly like display3.py
    const visitorsQuery = `
      SELECT 
        location,
        DATE(datetime) AS date,
        SUM(visitors) AS visitors
      FROM door_counts 
      WHERE DATE(datetime) BETWEEN ? AND ?
        AND location != 'Hq Warehouse (1)'
        AND location IS NOT NULL
      GROUP BY location, DATE(datetime)
    `

    const visitorData = await executeQuery(visitorsQuery, [startDate, endDate]) as any[]

    // Get sales data from shopify_orders - exactly like display3.py
    const salesQuery = `
      SELECT 
        so.location,
        DATE(so.created_at) AS date,
        COUNT(*) AS transactions,
        SUM(so.subtotal) AS revenue,
        AVG(so.subtotal) AS avg_transaction_value,
        COUNT(DISTINCT so.employee) AS employees_working,
        COUNT(DISTINCT so.email) AS unique_customers
      FROM shopify_orders so
      WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.financial_status = 'paid'
        AND so.location IS NOT NULL
        AND so.location != ''
        AND so.location != 'Hq Warehouse (1)'
      GROUP BY so.location, DATE(so.created_at)
    `

    const salesData = await executeQuery(salesQuery, [startDate, endDate]) as any[]

    // Merge visitor and sales data by location and date
    const mergedData = new Map()
    
    // Process visitor data
    visitorData.forEach(row => {
      const key = `${row.location}-${row.date}`
      if (!mergedData.has(key)) {
        mergedData.set(key, {
          location: row.location,
          date: row.date,
          visitors: 0,
          transactions: 0,
          revenue: 0,
          avg_transaction_value: 0,
          unique_customers: 0
        })
      }
      mergedData.get(key).visitors += parseInt(row.visitors) || 0
    })

    // Process sales data
    salesData.forEach(row => {
      const key = `${row.location}-${row.date}`
      if (!mergedData.has(key)) {
        mergedData.set(key, {
          location: row.location,
          date: row.date,
          visitors: 0,
          transactions: 0,
          revenue: 0,
          avg_transaction_value: 0,
          unique_customers: 0
        })
      }
      const record = mergedData.get(key)
      record.transactions += parseInt(row.transactions) || 0
      record.revenue += parseFloat(row.revenue) || 0
      record.avg_transaction_value = parseFloat(row.avg_transaction_value) || 0
      record.unique_customers += parseInt(row.unique_customers) || 0
    })

    // Aggregate by store location
    const storeAggregates = new Map()
    Array.from(mergedData.values()).forEach(record => {
      const location = record.location
      if (!storeAggregates.has(location)) {
        storeAggregates.set(location, {
          location,
          visitors: 0,
          transactions: 0,
          revenue: 0,
          unique_customers: 0,
          days_active: 0,
          total_avg_transaction: 0,
          transaction_count: 0
        })
      }
      const store = storeAggregates.get(location)
      store.visitors += record.visitors
      store.transactions += record.transactions
      store.revenue += record.revenue
      store.unique_customers += record.unique_customers
      if (record.transactions > 0 || record.visitors > 0) {
        store.days_active += 1
      }
      if (record.avg_transaction_value > 0) {
        store.total_avg_transaction += record.avg_transaction_value
        store.transaction_count += 1
      }
    })

    // Calculate metrics for each store - ONLY REAL DATA, NO ESTIMATES
    const stores = Array.from(storeAggregates.values())
      .filter(store => store.visitors > 0) // ONLY include stores with ACTUAL visitor data
      .map(store => ({
        location: store.location,
        visitors: store.visitors,
        transactions: store.transactions,
        revenue: store.revenue,
        unique_customers: store.unique_customers,
        days_active: store.days_active,
        avg_transaction_value: store.transaction_count > 0 ? store.total_avg_transaction / store.transaction_count : 0,
        conversion_rate: store.visitors > 0 ? store.transactions / store.visitors : 0,
        revenue_per_visitor: store.visitors > 0 ? store.revenue / store.visitors : 0,
        customers_per_day: store.days_active > 0 ? store.unique_customers / store.days_active : 0,
        revenue_per_day: store.days_active > 0 ? store.revenue / store.days_active : 0,
        transactions_per_day: store.days_active > 0 ? store.transactions / store.days_active : 0
      }))
      .filter(store => store.visitors >= minVisitors && store.transactions >= minOrders)

    if (stores.length === 0) {
      return NextResponse.json({
        rankings: [],
        chartData: { labels: [], datasets: [] },
        summary: {
          total_stores: 0,
          total_visitors: 0,
          total_revenue: 0,
          date_range_days: 0
        }
      })
    }

    // Calculate rankings for each metric
    const sortedByConversion = [...stores].sort((a, b) => b.conversion_rate - a.conversion_rate)
    const sortedByRevenuePerVisitor = [...stores].sort((a, b) => b.revenue_per_visitor - a.revenue_per_visitor)
    const sortedByTotalRevenue = [...stores].sort((a, b) => b.revenue - a.revenue)
    const sortedByAvgTransaction = [...stores].sort((a, b) => b.avg_transaction_value - a.avg_transaction_value)

    // Assign ranks (1-based) and calculate efficiency score
    const rankedStoresWithMetrics = stores.map(store => ({
      ...store,
      conversion_rank: sortedByConversion.findIndex(s => s.location === store.location) + 1,
      revenue_per_visitor_rank: sortedByRevenuePerVisitor.findIndex(s => s.location === store.location) + 1,
      total_revenue_rank: sortedByTotalRevenue.findIndex(s => s.location === store.location) + 1,
      avg_transaction_rank: sortedByAvgTransaction.findIndex(s => s.location === store.location) + 1
    })).map(store => ({
      ...store,
      efficiency_score: (
        store.conversion_rank + 
        store.revenue_per_visitor_rank + 
        store.total_revenue_rank + 
        store.avg_transaction_rank
      ) / 4
    }))

    // Sort by efficiency score (best performers first)
    const rankedStores = rankedStoresWithMetrics.sort((a, b) => a.efficiency_score - b.efficiency_score)

    // Calculate date range
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    const timeDiff = endDateObj.getTime() - startDateObj.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1

    // Prepare chart data (top 15 stores by efficiency score)
    const chartData = {
      labels: rankedStores.slice(0, 15).map(s => s.location),
      datasets: [
        {
          label: 'Efficiency Score (Lower = Better)',
          data: rankedStores.slice(0, 15).map(s => s.efficiency_score),
          backgroundColor: rankedStores.slice(0, 15).map((_, index) => {
            const ratio = index / 14 // 0 to 1
            const r = Math.floor(255 * ratio) // Red increases
            const g = Math.floor(255 * (1 - ratio)) // Green decreases
            return `rgba(${r}, ${g}, 0, 0.7)`
          })
        }
      ]
    }

    return NextResponse.json({
      rankings: rankedStores,
      chartData,
      summary: {
        total_stores: rankedStores.length,
        total_visitors: rankedStores.reduce((sum, store) => sum + store.visitors, 0),
        total_revenue: rankedStores.reduce((sum, store) => sum + store.revenue, 0),
        date_range_days: daysDiff
      }
    })
  } catch (error) {
    console.error('Store Rankings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}