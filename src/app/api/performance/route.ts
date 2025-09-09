import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import { formatDateForChart } from '@/lib/dateUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const location = searchParams.get('location') || 'all'

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Build location filter based on selection
    let locationFilter = ''
    let locationParams: string[] = []
    
    if (location === 'all_stores') {
      // Exclude Ecom data - only show physical stores
      locationFilter = `AND location IS NOT NULL AND location != '' 
                       AND LOWER(location) NOT LIKE '%ecom%' 
                       AND LOWER(location) NOT LIKE '%online%' 
                       AND LOWER(location) NOT LIKE '%web%'`
    } else if (location === 'ecom') {
      // Only show Ecom data
      locationFilter = `AND (LOWER(location) LIKE '%ecom%' 
                        OR LOWER(location) LIKE '%online%' 
                        OR LOWER(location) LIKE '%web%')`
    } else if (location !== 'all') {
      // Specific store selected
      locationFilter = 'AND location = ?'
      locationParams = [location]
    }

    const baseParams = [startDate, endDate, ...locationParams]

    // Get overall performance metrics
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_revenue,
        COUNT(DISTINCT email) as unique_customers,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_order_value
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ? ${locationFilter}
    `

    const metrics = await executeQuery(metricsQuery, baseParams) as any[]
    
    // Get door count data for conversion rate calculation (only for stores with door counts)
    const doorCountQuery = `
      SELECT 
        SUM(visitors) as total_visitors
      FROM door_counts
      WHERE DATE(datetime) BETWEEN DATE(?) AND DATE(?)
        ${location !== 'all' && location !== 'all_stores' && location !== 'ecom' ? 'AND location = ?' : ''}
    `
    const doorCountParams = location !== 'all' && location !== 'all_stores' && location !== 'ecom' 
      ? [startDate, endDate, location] 
      : [startDate, endDate]
    
    const doorCountData = await executeQuery(doorCountQuery, doorCountParams) as any[]
    const totalVisitors = doorCountData[0]?.total_visitors || null
    
    // Only calculate conversion rate if we have door count data
    const conversionRate = totalVisitors && totalVisitors > 0 
      ? parseFloat((metrics[0].total_orders / totalVisitors * 100).toFixed(2))
      : null
    
    const revenuePerVisitor = totalVisitors && totalVisitors > 0
      ? parseFloat((metrics[0].total_revenue / totalVisitors).toFixed(2))
      : null

    // Get store performance summary
    let storeLocationFilter = ''
    if (location === 'all_stores') {
      // Only physical stores for summary
      storeLocationFilter = `AND location IS NOT NULL AND location != '' 
                            AND LOWER(location) NOT LIKE '%ecom%' 
                            AND LOWER(location) NOT LIKE '%online%' 
                            AND LOWER(location) NOT LIKE '%web%'`
    } else if (location === 'ecom') {
      // Only Ecom for summary
      storeLocationFilter = `AND (LOWER(location) LIKE '%ecom%' 
                            OR LOWER(location) LIKE '%online%' 
                            OR LOWER(location) LIKE '%web%')`
    } else {
      // All locations for individual store selection
      storeLocationFilter = 'AND location IS NOT NULL AND location != \'\''
    }
    
    const storeQuery = `
      SELECT 
        location,
        COUNT(*) as total_orders,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_revenue,
        COUNT(DISTINCT email) as unique_customers,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_order_value
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ? 
        ${storeLocationFilter}
      GROUP BY location
      ORDER BY total_revenue DESC
    `

    const storeData = await executeQuery(storeQuery, [startDate, endDate]) as any[]
    
    // Get door count data for each store
    const doorCountByStoreQuery = `
      SELECT 
        location,
        SUM(visitors) as total_visitors
      FROM door_counts
      WHERE DATE(datetime) BETWEEN DATE(?) AND DATE(?)
      GROUP BY location
    `
    const doorCountByStore = await executeQuery(doorCountByStoreQuery, [startDate, endDate]) as any[]
    
    // Create a map of door count data by location
    const doorCountMap = new Map()
    doorCountByStore.forEach(dc => {
      // Map store names (handle variations)
      let mappedLocation = dc.location
      if (dc.location === 'mallgeorgia') mappedLocation = 'mallofgeorgia'
      if (dc.location === 'stpete') mappedLocation = 'oldstpete'
      doorCountMap.set(mappedLocation, dc.total_visitors)
      // Also set the original location name
      doorCountMap.set(dc.location, dc.total_visitors)
    })
    
    // Calculate store metrics with conversion rates and revenue per visitor
    const storePerformance = storeData.map(store => {
      const visitors = doorCountMap.get(store.location) || null
      const conversionRate = visitors && visitors > 0 
        ? parseFloat((store.total_orders / visitors * 100).toFixed(2))
        : null
      const revenuePerVisitor = visitors && visitors > 0 
        ? parseFloat((store.total_revenue / visitors).toFixed(2))
        : null
      
      return {
        location: store.location,
        totalOrders: parseInt(store.total_orders),
        totalRevenue: parseFloat(store.total_revenue || 0),
        uniqueCustomers: parseInt(store.unique_customers),
        avgOrderValue: parseFloat(store.avg_order_value || 0),
        conversionRate: conversionRate,
        revenuePerVisitor: revenuePerVisitor,
        totalVisitors: visitors
      }
    })

    // Get daily performance data for trend charts
    const dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as revenue,
        COUNT(DISTINCT email) as unique_customers,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_order_value
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ? ${locationFilter}
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    const dailyData = await executeQuery(dailyQuery, baseParams) as any[]

    // Get daily door count data if available
    const dailyDoorCountQuery = `
      SELECT 
        DATE(datetime) as date,
        SUM(visitors) as total_visitors
      FROM door_counts
      WHERE DATE(datetime) BETWEEN DATE(?) AND DATE(?)
        ${location !== 'all' && location !== 'all_stores' && location !== 'ecom' ? 'AND location = ?' : ''}
      GROUP BY DATE(datetime)
    `
    const dailyDoorCountData = await executeQuery(dailyDoorCountQuery, doorCountParams) as any[]
    
    // Create a map of daily visitor counts
    const dailyVisitorMap = new Map()
    dailyDoorCountData.forEach(dv => {
      dailyVisitorMap.set(dv.date.toISOString().split('T')[0], dv.total_visitors)
    })

    // Prepare daily data with calculated metrics
    const dailyPerformance = dailyData.map(day => {
      const dateStr = day.date.toISOString().split('T')[0]
      const visitors = dailyVisitorMap.get(dateStr) || null
      
      return {
        date: formatDateForChart(day.date),
        orders: parseInt(day.orders),
        revenue: parseFloat(day.revenue || 0),
        uniqueCustomers: parseInt(day.unique_customers),
        avgOrderValue: parseFloat(day.avg_order_value || 0),
        conversionRate: visitors && visitors > 0 
          ? parseFloat((day.orders / visitors * 100).toFixed(2))
          : null,
        revenuePerVisitor: visitors && visitors > 0 
          ? parseFloat((day.revenue / visitors).toFixed(2))
          : null,
        totalVisitors: visitors
      }
    })

    // Chart data for trends
    const formattedLabels = dailyPerformance.map(d => d.date)
    
    const chartData = {
      // Daily Revenue Chart
      revenueChart: {
        labels: formattedLabels,
        datasets: [
          {
            label: 'Daily Revenue',
            data: dailyPerformance.map(d => d.revenue),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
          }
        ]
      },
      // Conversion Rate Chart (only show if we have door count data)
      conversionChart: {
        labels: formattedLabels,
        datasets: [
          {
            label: 'Conversion Rate (%)',
            data: dailyPerformance.map(d => d.conversionRate),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            spanGaps: true,
          }
        ]
      },
      // Revenue per Visitor Chart (only show if we have door count data)
      revenuePerVisitorChart: {
        labels: formattedLabels,
        datasets: [
          {
            label: 'Revenue per Visitor ($)',
            data: dailyPerformance.map(d => d.revenuePerVisitor),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            spanGaps: true,
          }
        ]
      },
      // Visitors vs Sales Chart
      visitorsVsSalesChart: {
        labels: formattedLabels,
        datasets: [
          {
            label: 'Visitors',
            data: dailyPerformance.map(d => d.totalVisitors),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            yAxisID: 'y',
            spanGaps: true,
          },
          {
            label: 'Orders',
            data: dailyPerformance.map(d => d.orders),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 3,
            yAxisID: 'y1',
          }
        ]
      }
    }

    return NextResponse.json({
      metrics: {
        totalOrders: metrics[0].total_orders,
        totalRevenue: parseFloat(metrics[0].total_revenue || 0),
        uniqueCustomers: metrics[0].unique_customers,
        conversionRate: conversionRate,
        avgOrderValue: parseFloat(metrics[0].avg_order_value || 0),
        revenuePerVisitor: revenuePerVisitor
      },
      storePerformance,
      dailyPerformance,
      chartData
    })
  } catch (error) {
    console.error('Performance API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}