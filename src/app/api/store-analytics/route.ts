import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const location = searchParams.get('location')

    if (!startDate || !endDate || !location || location === 'all') {
      return NextResponse.json({ error: 'Start date, end date, and specific location are required' }, { status: 400 })
    }

    // Get store summary metrics
    const storeSummaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT employee) as total_employees,
        COUNT(DISTINCT DATE(created_at)) as days_active,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_revenue,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_transaction_value,
        MIN(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as min_transaction,
        MAX(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as max_transaction,
        COUNT(DISTINCT email) as unique_customers
      FROM shopify_orders 
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND location = ?
        AND financial_status = 'paid'
        AND employee IS NOT NULL 
        AND employee != ''
    `

    const storeSummary = await executeQuery(storeSummaryQuery, [startDate, endDate, location]) as any[]
    
    if (!storeSummary || storeSummary.length === 0) {
      return NextResponse.json({ 
        error: 'No data found for the specified date range and location',
        summary: null,
        hourlyDistribution: [],
        employeePerformance: [],
        dailyBreakdown: []
      })
    }

    const summary = storeSummary[0]

    // Get hourly distribution
    const hourlyQuery = `
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as transactions,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as revenue,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_transaction_value
      FROM shopify_orders 
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND location = ?
        AND financial_status = 'paid'
        AND employee IS NOT NULL 
        AND employee != ''
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `

    const hourlyData = await executeQuery(hourlyQuery, [startDate, endDate, location]) as any[]

    // Get employee performance
    const employeeQuery = `
      SELECT 
        employee,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT DATE(created_at)) as days_worked,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_revenue,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_transaction_value,
        COUNT(DISTINCT email) as unique_customers,
        MIN(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as min_transaction,
        MAX(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as max_transaction
      FROM shopify_orders 
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND location = ?
        AND financial_status = 'paid'
        AND employee IS NOT NULL 
        AND employee != ''
      GROUP BY employee
      ORDER BY total_transactions DESC
    `

    const employeeData = await executeQuery(employeeQuery, [startDate, endDate, location]) as any[]

    // Get daily breakdown
    const dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        COUNT(DISTINCT employee) as active_employees,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as revenue,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_transaction_value
      FROM shopify_orders 
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND location = ?
        AND financial_status = 'paid'
        AND employee IS NOT NULL 
        AND employee != ''
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    const dailyData = await executeQuery(dailyQuery, [startDate, endDate, location]) as any[]

    // Calculate additional metrics
    const processedEmployees = employeeData.map((emp, index) => ({
      employee: emp.employee,
      total_transactions: parseInt(emp.total_transactions),
      days_worked: parseInt(emp.days_worked),
      total_revenue: parseFloat(emp.total_revenue || 0),
      avg_transaction_value: parseFloat(emp.avg_transaction_value || 0),
      unique_customers: parseInt(emp.unique_customers),
      min_transaction: parseFloat(emp.min_transaction || 0),
      max_transaction: parseFloat(emp.max_transaction || 0),
      transactions_per_day: parseFloat((parseInt(emp.total_transactions) / parseInt(emp.days_worked)).toFixed(2)),
      revenue_per_day: parseFloat((parseFloat(emp.total_revenue || 0) / parseInt(emp.days_worked)).toFixed(2)),
      rank: index + 1
    }))

    // Calculate store averages for comparison
    const avgTransactionsPerEmployee = summary.total_employees > 0 
      ? parseFloat((summary.total_transactions / summary.total_employees).toFixed(2))
      : 0

    const avgRevenuePerEmployee = summary.total_employees > 0
      ? parseFloat((summary.total_revenue / summary.total_employees).toFixed(2))
      : 0

    // Process hourly data
    const processedHourlyData = hourlyData.map(hour => ({
      hour: parseInt(hour.hour),
      hour_display: `${hour.hour}:00`,
      transactions: parseInt(hour.transactions),
      revenue: parseFloat(hour.revenue || 0),
      avg_transaction_value: parseFloat(hour.avg_transaction_value || 0)
    }))

    // Process daily data
    const processedDailyData = dailyData.map(day => ({
      date: day.date,
      transactions: parseInt(day.transactions),
      active_employees: parseInt(day.active_employees),
      revenue: parseFloat(day.revenue || 0),
      avg_transaction_value: parseFloat(day.avg_transaction_value || 0)
    }))

    // Find peak hours
    const peakHours = [...processedHourlyData]
      .sort((a, b) => b.transactions - a.transactions)
      .slice(0, 3)

    return NextResponse.json({
      summary: {
        location: location,
        total_transactions: parseInt(summary.total_transactions),
        total_employees: parseInt(summary.total_employees),
        days_active: parseInt(summary.days_active),
        total_revenue: parseFloat(summary.total_revenue || 0),
        avg_transaction_value: parseFloat(summary.avg_transaction_value || 0),
        min_transaction: parseFloat(summary.min_transaction || 0),
        max_transaction: parseFloat(summary.max_transaction || 0),
        unique_customers: parseInt(summary.unique_customers),
        avg_transactions_per_employee: avgTransactionsPerEmployee,
        avg_revenue_per_employee: avgRevenuePerEmployee
      },
      hourlyDistribution: processedHourlyData,
      employeePerformance: processedEmployees,
      dailyBreakdown: processedDailyData,
      peakHours: peakHours
    })

  } catch (error) {
    console.error('Store analytics API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0