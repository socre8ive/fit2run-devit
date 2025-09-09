import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: 'sales_data',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Get current day of week (0 = Sunday, 6 = Saturday)
  const currentDayOfWeek = today.getDay()
  
  // Calculate days since Monday (Monday = 1)
  const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1
  
  // Get the most recent Monday
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysSinceMonday)
  
  // Get last Monday (7 days before this Monday)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  
  // Get the first day of current month
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  
  // Get the first day of last month
  const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  
  // Get the last day of last month
  const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)

  switch (period) {
    case 'this_week':
      return {
        startDate: thisMonday.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }
    
    case 'last_week':
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(thisMonday.getDate() - 1)
      return {
        startDate: lastMonday.toISOString().split('T')[0],
        endDate: lastSunday.toISOString().split('T')[0]
      }
    
    case 'this_month':
      return {
        startDate: firstDayOfMonth.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }
    
    case 'last_month':
      return {
        startDate: firstDayOfLastMonth.toISOString().split('T')[0],
        endDate: lastDayOfLastMonth.toISOString().split('T')[0]
      }
    
    case 'last_3_months':
      const threeMonthsAgo = new Date(today)
      threeMonthsAgo.setMonth(today.getMonth() - 3)
      return {
        startDate: threeMonthsAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }
    
    case 'last_6_months':
      const sixMonthsAgo = new Date(today)
      sixMonthsAgo.setMonth(today.getMonth() - 6)
      return {
        startDate: sixMonthsAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }
    
    default:
      // Default to this week
      return {
        startDate: thisMonday.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const period = searchParams.get('period') || 'this_week'

  let connection
  try {
    connection = await mysql.createConnection(dbConfig)
    
    const { startDate, endDate } = getDateRange(period)
    
    // Query to get employee sales data - use location instead of fulfillment_location_name
    const query = `
      SELECT 
        o.employee as employee_name,
        COALESCE(o.location, 'Unknown Location') as location_name,
        COUNT(DISTINCT o.id) as total_transactions,
        COALESCE(SUM(o.total), 0) as total_sales
      FROM shopify_orders o
      WHERE DATE(o.created_at) >= ? 
        AND DATE(o.created_at) <= ?
        AND o.financial_status = 'paid'
        AND o.employee IS NOT NULL
        AND o.employee != ''
      GROUP BY o.employee, o.location
      ORDER BY total_sales DESC
    `
    
    const [rows] = await connection.execute(query, [startDate, endDate])
    
    // Format the results
    const formattedData = (rows as any[]).map(row => ({
      employee_name: row.employee_name,
      location_name: row.location_name,
      total_transactions: parseInt(row.total_transactions),
      total_sales: parseFloat(row.total_sales)
    }))

    return NextResponse.json({
      success: true,
      period,
      dateRange: { startDate, endDate },
      data: formattedData
    })
  } catch (error) {
    console.error('Error fetching employee sales:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch employee sales data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}