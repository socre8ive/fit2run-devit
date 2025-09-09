import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    // Use yesterday if no date specified
    const targetDate = date || 'DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    const dateCondition = date ? 'DATE(datetime) = ?' : 'DATE(datetime) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    const orderDateCondition = date ? 'DATE(created_at) = ?' : 'DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    
    const query = `
      SELECT 
        dc.location as store_name,
        DATE_FORMAT(DATE(dc.datetime), '%Y-%m-%d') as report_date,
        dc.total_visitors,
        COALESCE(so.total_sales, 0) as total_sales,
        COALESCE(so.transaction_count, 0) as transaction_count,
        CASE 
          WHEN dc.total_visitors > 0 
          THEN ROUND((COALESCE(so.transaction_count, 0) / dc.total_visitors * 100), 2)
          ELSE 0 
        END as conversion_rate_percentage
      FROM (
        SELECT 
          location, 
          MIN(datetime) as datetime,
          SUM(visitors) as total_visitors 
        FROM door_counts 
        WHERE ${dateCondition}
        GROUP BY location
      ) dc
      LEFT JOIN (
        SELECT 
          CASE 
            WHEN location = 'mallofgeorgia' THEN 'mallgeorgia'
            WHEN location = 'oldstpete' THEN 'stpete'
            WHEN location = 'fortmyers' THEN 'fortmyers'
            ELSE location
          END as mapped_location,
          SUM(total) as total_sales,
          COUNT(*) as transaction_count
        FROM shopify_orders 
        WHERE ${orderDateCondition}
          AND financial_status IN ('paid', 'authorized')
          AND location IS NOT NULL
        GROUP BY mapped_location
      ) so ON dc.location = so.mapped_location
      WHERE dc.location != 'warehouse'
      ORDER BY dc.location
    `
    
    const params = date ? [date, date] : []
    const results = await executeQuery(query, params) as any[]
    
    // Format results for CSV export
    const formattedResults = results.map(row => ({
      store_name: row.store_name,
      report_date: row.report_date,
      total_visitors: parseInt(row.total_visitors),
      total_sales: parseFloat(row.total_sales).toFixed(2),
      transaction_count: parseInt(row.transaction_count),
      conversion_rate: `${row.conversion_rate_percentage}%`
    }))
    
    // Create CSV content
    const csvHeaders = ['Store Name', 'Date', 'Total Visitors', 'Total Sales', 'Transactions', 'Conversion Rate']
    const csvRows = formattedResults.map(row => [
      row.store_name,
      row.report_date,
      row.total_visitors,
      row.total_sales,
      row.transaction_count,
      row.conversion_rate
    ])
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n')
    
    // Return both JSON and CSV format
    return NextResponse.json({
      data: formattedResults,
      csv: csvContent,
      summary: {
        total_stores: results.length,
        total_visitors: results.reduce((sum, row) => sum + parseInt(row.total_visitors), 0),
        total_sales: results.reduce((sum, row) => sum + parseFloat(row.total_sales), 0).toFixed(2),
        total_transactions: results.reduce((sum, row) => sum + parseInt(row.transaction_count), 0),
        avg_conversion_rate: (results.reduce((sum, row) => sum + parseFloat(row.conversion_rate_percentage), 0) / results.length).toFixed(2)
      }
    })
    
  } catch (error) {
    console.error('Conversion report API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0