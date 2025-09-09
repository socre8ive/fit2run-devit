import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Simple test query to show some employee purchase matches
    const query = `
      SELECT 
        'Kirsten Jackson' as customer_name,
        'John Doe' as sales_person,
        '$125.50' as total,
        '2024-08-15' as date,
        'Store A' as location,
        'Sample order for testing' as description
      UNION ALL
      SELECT 
        'Brooke McGowan' as customer_name,
        'Jane Smith' as sales_person,
        '$89.99' as total,
        '2024-08-14' as date,
        'Store B' as location,
        'Another sample order'
      ORDER BY total DESC
      LIMIT 10
    `

    const orders = await executeQuery(query, []) as any[]

    return NextResponse.json({
      summary: {
        totalOrders: orders.length,
        totalValue: 215.49,
        avgOrderValue: 107.75,
        uniqueEmployees: 2
      },
      orders: orders.map(order => ({
        order_id: Math.floor(Math.random() * 1000000),
        order_name: `#${Math.floor(Math.random() * 1000000)}`,
        customer_name: order.customer_name,
        sales_person: order.sales_person,
        total: parseFloat(order.total.replace('$', '')),
        location: order.location,
        created_at: order.date,
        customer_email: `${order.customer_name.toLowerCase().replace(' ', '.')}@example.com`,
        matching_staff_name: order.customer_name,
        line_items: [
          {
            name: 'Sample Product',
            sku: '123456',
            quantity: 1,
            price: parseFloat(order.total.replace('$', '')),
            vendor: 'Test Vendor',
            line_total: parseFloat(order.total.replace('$', ''))
          }
        ]
      }))
    })

  } catch (error) {
    console.error('Employee purchases API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}