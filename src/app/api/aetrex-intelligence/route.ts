import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const stores = searchParams.get('stores')?.split(',') || ['all_stores']

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'fit2run',
      password: 'Fit2Run1!',
      database: 'sales_data',
    })

    // Build store filter
    let storeFilter = ''
    if (!stores.includes('all_stores')) {
      const storeList = stores.map(s => `'${s.replace(/'/g, "''")}'`).join(',')
      storeFilter = `AND o.location IN (${storeList})`
    }

    // Get overall metrics
    const [metricsRows]: any = await connection.execute(`
      SELECT 
        -- Aetrex sales
        COALESCE(SUM(CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') 
          THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END), 0) as totalAetrexSales,
        -- Non-Aetrex sales
        COALESCE(SUM(CASE WHEN oi.vendor NOT IN ('Aetrex', 'Aetrex Worldwide') OR oi.vendor IS NULL
          THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END), 0) as totalNonAetrexSales,
        -- Total sales
        COALESCE(SUM(oi.lineitem_price * oi.lineitem_quantity), 0) as totalSales,
        -- Count of Aetrex items
        COUNT(CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') THEN 1 END) as aetrexOrderCount,
        -- Total order count
        COUNT(DISTINCT o.id) as totalOrderCount,
        -- Orders containing at least one Aetrex item
        COUNT(DISTINCT CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') THEN o.id END) as ordersWithAetrex
      FROM shopify_orders o
      LEFT JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) BETWEEN ? AND ?
      ${storeFilter}
    `, [startDate, endDate])

    const metrics = metricsRows[0]
    metrics.aetrexPercentage = metrics.totalSales > 0 
      ? (metrics.totalAetrexSales / metrics.totalSales) * 100 
      : 0
    metrics.percentOrdersWithAetrex = metrics.totalOrderCount > 0
      ? (metrics.ordersWithAetrex / metrics.totalOrderCount) * 100
      : 0

    // Get daily breakdown
    const [dailyRows]: any = await connection.execute(`
      SELECT 
        DATE(o.created_at) as date,
        COALESCE(SUM(CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') 
          THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END), 0) as aetrexSales,
        COALESCE(SUM(CASE WHEN oi.vendor NOT IN ('Aetrex', 'Aetrex Worldwide') OR oi.vendor IS NULL
          THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END), 0) as nonAetrexSales,
        COALESCE(SUM(oi.lineitem_price * oi.lineitem_quantity), 0) as totalSales,
        COUNT(DISTINCT o.id) as totalOrders,
        COUNT(DISTINCT CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') THEN o.id END) as ordersWithAetrex
      FROM shopify_orders o
      LEFT JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) BETWEEN ? AND ?
      ${storeFilter}
      GROUP BY DATE(o.created_at)
      ORDER BY date
    `, [startDate, endDate])

    const dailyData = dailyRows.map((row: any) => ({
      ...row,
      date: row.date.toISOString().split('T')[0],
      aetrexPercentage: row.totalSales > 0 ? (row.aetrexSales / row.totalSales) * 100 : 0,
      percentOrdersWithAetrex: row.totalOrders > 0 ? (row.ordersWithAetrex / row.totalOrders) * 100 : 0
    }))

    // Get store breakdown
    const [storeRows]: any = await connection.execute(`
      SELECT 
        o.location as store,
        COALESCE(SUM(CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') 
          THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END), 0) as aetrexSales,
        COALESCE(SUM(CASE WHEN oi.vendor NOT IN ('Aetrex', 'Aetrex Worldwide') OR oi.vendor IS NULL
          THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END), 0) as nonAetrexSales,
        COALESCE(SUM(oi.lineitem_price * oi.lineitem_quantity), 0) as totalSales,
        COUNT(DISTINCT o.id) as totalOrders,
        COUNT(DISTINCT CASE WHEN oi.vendor IN ('Aetrex', 'Aetrex Worldwide') THEN o.id END) as ordersWithAetrex
      FROM shopify_orders o
      LEFT JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) BETWEEN ? AND ?
      ${storeFilter}
      GROUP BY o.location
      HAVING totalSales > 0
      ORDER BY aetrexSales DESC
    `, [startDate, endDate])

    const storeData = storeRows.map((row: any) => ({
      ...row,
      aetrexPercentage: row.totalSales > 0 ? (row.aetrexSales / row.totalSales) * 100 : 0
    }))

    // Create chart data
    const chartData = {
      salesComparisonChart: {
        labels: dailyData.map((d: any) => d.date),
        datasets: [
          {
            label: 'Aetrex Sales',
            data: dailyData.map((d: any) => d.aetrexSales),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          },
          {
            label: 'Other Product Sales',
            data: dailyData.map((d: any) => d.nonAetrexSales),
            backgroundColor: 'rgba(156, 163, 175, 0.8)',
            borderColor: 'rgb(156, 163, 175)',
            borderWidth: 1
          }
        ]
      },
      percentageChart: {
        labels: dailyData.map((d: any) => d.date),
        datasets: [
          {
            label: 'Aetrex % of Sales',
            data: dailyData.map((d: any) => d.aetrexPercentage),
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            tension: 0.1
          }
        ]
      },
      ordersChart: {
        labels: dailyData.map((d: any) => d.date),
        datasets: [
          {
            label: '% Orders with Aetrex',
            data: dailyData.map((d: any) => d.percentOrdersWithAetrex),
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            borderColor: 'rgb(168, 85, 247)',
            borderWidth: 2,
            tension: 0.1
          }
        ]
      }
    }

    await connection.end()

    return NextResponse.json({
      metrics,
      dailyData,
      storeData,
      chartData
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json({ error: 'Failed to fetch Aetrex data' }, { status: 500 })
  }
}