import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import { formatDateForChart } from '@/lib/dateUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location') || 'all'
    const period = searchParams.get('period') || 'last4weeks'
    
    console.log("BUDGET API - Using JOIN between forecast (actual sales) and forecast_budget (plan data)")
    console.log("Period:", period, "Location:", location)

    // Build location filter
    let locationFilter = ''
    let locationParams: string[] = []
    if (location !== 'all') {
      locationFilter = 'AND location_name = ?'
      locationParams = [location]
    }

    // Build date filter based on period
    let dateFilter = ''
    let dateParams: string[] = []
    
    switch (period) {
      case 'lastweek':
        // Last week (Sunday to Monday)
        dateFilter = 'AND f.forecast_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) + 1 DAY), INTERVAL 7 DAY) AND f.forecast_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) + 1 DAY)'
        break
      case 'last4weeks':
        // Last 4 weeks
        dateFilter = 'AND f.forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND f.forecast_date <= CURDATE()'
        break
      case 'lastmonth':
        // Last month (1st to last day of previous month)
        dateFilter = 'AND f.forecast_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), \'%Y-%m-01\') AND f.forecast_date < DATE_FORMAT(CURDATE(), \'%Y-%m-01\')'
        break
      default:
        // Default to last 4 weeks
        dateFilter = 'AND f.forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND f.forecast_date <= CURDATE()'
    }

    // Get current year budget and actual data
    const budgetQuery = `
      SELECT 
        fb.forecast_date,
        COALESCE(SUM(fb.plan_2025), 0) as budget_2025,
        COALESCE(SUM(f.net_sales), 0) as actual_2025
      FROM forecast_budget_readonly fb
      LEFT JOIN forecast f ON fb.forecast_date = f.forecast_date AND fb.location_name = f.location_name
      WHERE 1=1 ${dateFilter.replace(/f\.forecast_date/g, 'fb.forecast_date')} ${locationFilter.replace(/location_name/g, 'fb.location_name')}
      GROUP BY fb.forecast_date
      ORDER BY fb.forecast_date ASC
    `
    
    // Get the 2024 sales data from forecast_budget (the correct imported data)
    const sales2024Query = `
      SELECT 
        forecast_date,
        SUM(2024_Sales) as daily_2024_sales
      FROM forecast_budget_readonly
      WHERE 1=1 ${dateFilter.replace(/f\.forecast_date/g, 'forecast_date')} ${locationFilter.replace(/location_name/g, 'location_name')}
      GROUP BY forecast_date
      ORDER BY forecast_date ASC
    `
    
    const params = [...dateParams, ...locationParams]
    const budgetData = await executeQuery(budgetQuery, params) as any[]
    const sales2024Data = await executeQuery(sales2024Query, params) as any[]
    
    // Create map of 2024 sales by date 
    const sales2024Map = new Map()
    sales2024Data.forEach(row => {
      const dateKey = new Date(row.forecast_date).toISOString().split('T')[0]
      sales2024Map.set(dateKey, parseFloat(row.daily_2024_sales) || 0)
    })
    
    // Merge the data
    const mergedData = budgetData.map(row => {
      const dateKey = new Date(row.forecast_date).toISOString().split('T')[0]
      const sales2024 = sales2024Map.get(dateKey) || 0
      return {
        ...row,
        budget_2024: sales2024
      }
    })

    // Calculate totals from merged data
    const total2024Sales = mergedData.reduce((sum, row) => sum + (parseFloat(row.budget_2024) || 0), 0)
    const totalBudget2025 = mergedData.reduce((sum, row) => sum + (parseFloat(row.budget_2025) || 0), 0)
    const totalActual2025 = mergedData.reduce((sum, row) => sum + (parseFloat(row.actual_2025) || 0), 0)
    const variance = totalActual2025 - totalBudget2025
    const variancePercent = totalBudget2025 > 0 ? ((variance / totalBudget2025) * 100).toFixed(2) : '0'
    const yearOverYearGrowth = total2024Sales > 0 ? ((totalActual2025 - total2024Sales) / total2024Sales * 100) : 0

    // Get performance by location (using same date filter)
    const locationQuery = `
      SELECT 
        fb.location_name,
        COALESCE(SUM(fb.plan_2025), 0) as budget,
        COALESCE(SUM(f.net_sales), 0) as actual,
        CASE 
          WHEN SUM(fb.plan_2025) > 0 THEN ((SUM(f.net_sales) - SUM(fb.plan_2025)) / SUM(fb.plan_2025) * 100)
          ELSE 0 
        END as variance_percent
      FROM forecast_budget_readonly fb
      LEFT JOIN forecast f ON fb.forecast_date = f.forecast_date AND fb.location_name = f.location_name
      WHERE 1=1 ${dateFilter.replace(/f\.forecast_date/g, 'fb.forecast_date')} ${location === 'all' ? '' : 'AND fb.location_name = ?'}
      GROUP BY fb.location_name
      ORDER BY COALESCE(SUM(f.net_sales), 0) DESC
    `

    const locationQueryParams = location === 'all' ? [...dateParams] : [...dateParams, location]
    const locationData = await executeQuery(locationQuery, locationQueryParams) as any[]

    return NextResponse.json({
      summary: {
        totalBudget: totalBudget2025,
        totalActual: totalActual2025,
        total2024Sales,
        variance,
        variancePercent: parseFloat(variancePercent),
        yearOverYearGrowth
      },
      chartData: {
        labels: mergedData.map(d => formatDateForChart(d.forecast_date)),
        datasets: [
          {
            label: '2024 Sales',
            data: mergedData.map(d => parseFloat(d.budget_2024) || 0),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
          },
          {
            label: '2025 Plan',
            data: mergedData.map(d => parseFloat(d.budget_2025) || 0),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
          },
          {
            label: '2025 Actual',
            data: mergedData.map(d => parseFloat(d.actual_2025) || 0),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
          }
        ]
      },
      locationData: locationData.map(l => ({
        location: l.location_name,
        budget: parseFloat(l.budget) || 0,
        actual: parseFloat(l.actual) || 0,
        variancePercent: parseFloat(l.variance_percent) || 0
      }))
    })
  } catch (error) {
    console.error('Budget API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}