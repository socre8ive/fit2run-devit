import { NextRequest, NextResponse } from 'next/server'
import { formatDateForChart } from '@/lib/dateUtils'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const location = searchParams.get('location') || 'all'

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Build location filter for SQL queries  
    let locationFilter = ''
    let params = [startDate, endDate]
    
    if (location !== 'all' && location !== 'all_stores' && location !== 'ecom') {
      locationFilter = 'AND so.location = ?'
      params.push(location)
    } else if (location === 'all_stores') {
      locationFilter = 'AND so.location != \'ecom\''
    } else if (location === 'ecom') {
      locationFilter = 'AND so.location = \'ecom\''
    }

    // Employee performance summary with name mapping
    const employeeSummaryQuery = `
      SELECT 
        so.employee,
        COALESCE(sm.staff_name, so.employee) as staff_name,
        so.location,
        COUNT(*) AS total_transactions,
        SUM(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS total_revenue,
        AVG(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS avg_transaction_value,
        MIN(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS min_transaction,
        MAX(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS max_transaction,
        COUNT(DISTINCT DATE(so.created_at)) AS days_worked,
        COUNT(DISTINCT so.email) AS unique_customers
      FROM shopify_orders so
      LEFT JOIN staff_member_mapping sm ON so.employee = sm.staff_id
      WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.financial_status = 'paid'
        AND so.employee IS NOT NULL 
        AND so.employee != ''
        ${locationFilter}
      GROUP BY so.employee, sm.staff_name, so.location
      HAVING COUNT(*) >= 1
      ORDER BY total_revenue DESC
    `

    const employeeData = await executeQuery(employeeSummaryQuery, params) as any[]

    if (!employeeData || employeeData.length === 0) {
      return NextResponse.json({ 
        summary: { totalEmployees: 0, totalRevenue: 0, totalTransactions: 0, totalCustomers: 0, avgRevenuePerEmployee: 0, avgTransactionsPerEmployee: 0, bestPerformer: { name: 'N/A', revenue: 0, location: 'N/A' } },
        performanceTabs: { revenueLeaders: [], transactionLeaders: [] },
        allEmployees: [],
        chartData: null
      })
    }

    // Calculate derived metrics
    const processedEmployees = employeeData.map((emp, index) => ({
      employee_id: emp.employee,
      name: emp.staff_name || emp.employee,
      location: emp.location,
      days_worked: parseInt(emp.days_worked),
      total_transactions: parseInt(emp.total_transactions),
      unique_customers: parseInt(emp.unique_customers),
      revenue: parseFloat(emp.total_revenue || 0),
      revenuePerDay: parseFloat(emp.total_revenue || 0) / parseInt(emp.days_worked),
      transactionsPerDay: parseInt(emp.total_transactions) / parseInt(emp.days_worked),
      customersPerDay: parseInt(emp.unique_customers) / parseInt(emp.days_worked),
      avgTransactionValue: parseFloat(emp.avg_transaction_value || 0),
      efficiencyScore: Math.round((parseFloat(emp.total_revenue || 0) / parseInt(emp.total_transactions)) * 10) / 10,
      rank: index + 1
    }))

    // Summary calculations
    const totalEmployees = processedEmployees.length
    const totalRevenue = processedEmployees.reduce((sum, emp) => sum + emp.revenue, 0)
    const totalTransactions = processedEmployees.reduce((sum, emp) => sum + emp.total_transactions, 0)
    const totalCustomers = processedEmployees.reduce((sum, emp) => sum + emp.unique_customers, 0)
    const bestPerformer = processedEmployees[0] || { name: 'N/A', revenue: 0, location: 'N/A' }

    // Performance tabs
    const revenueLeaders = processedEmployees.slice(0, 15)
    const transactionLeaders = [...processedEmployees].sort((a, b) => b.total_transactions - a.total_transactions).slice(0, 15)

    // Simple performance distribution chart data
    const performanceDistribution = {
      labels: ['Top 25%', 'Upper Mid 25%', 'Lower Mid 25%', 'Bottom 25%'],
      datasets: [{
        label: 'Employee Performance Distribution',
        data: [
          Math.ceil(totalEmployees * 0.25),
          Math.ceil(totalEmployees * 0.25), 
          Math.ceil(totalEmployees * 0.25),
          Math.floor(totalEmployees * 0.25)
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)', 
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ]
      }]
    }

    return NextResponse.json({
      summary: {
        totalEmployees,
        totalRevenue,
        totalTransactions,
        totalCustomers,
        avgRevenuePerEmployee: totalRevenue / totalEmployees,
        avgTransactionsPerEmployee: totalTransactions / totalEmployees,
        bestPerformer: {
          name: bestPerformer.name,
          revenue: bestPerformer.revenue,
          location: bestPerformer.location
        }
      },
      performanceTabs: {
        revenueLeaders,
        transactionLeaders
      },
      allEmployees: processedEmployees,
      chartData: {
        performanceDistribution
      }
    })

  } catch (error) {
    console.error('Employee API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}