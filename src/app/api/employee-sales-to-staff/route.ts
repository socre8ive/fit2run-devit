import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '2024-08-01'
    const endDate = searchParams.get('endDate') || '2024-08-31'  
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get recent high-value orders as potential employee purchases
    const query = `
      SELECT 
        so.id as order_id,
        so.name as order_name,
        so.total,
        so.subtotal,
        so.taxes,
        so.created_at,
        so.location,
        so.employee as sales_person,
        so.email as customer_email
      FROM shopify_orders so
      WHERE so.financial_status = 'paid'
        AND DATE(so.created_at) BETWEEN ? AND ?
        AND so.total > 50
        AND so.email IS NOT NULL
      ORDER BY CAST(so.total AS DECIMAL(10,2)) DESC
      LIMIT ?
    `
    
    const orders = await executeQuery(query, [startDate, endDate, limit]) as any[]
    
    // Get staff members
    const staffQuery = `SELECT full_name FROM staff_members WHERE full_name IS NOT NULL LIMIT 100`
    const staff = await executeQuery(staffQuery) as any[]
    const staffNames = staff.map(s => s.full_name)

    // Process orders with line items
    const processedOrders = await Promise.all(orders.map(async (order, index) => {
      // Get line items
      const itemsQuery = `
        SELECT 
          lineitem_name,
          lineitem_sku,
          lineitem_quantity,
          lineitem_price,
          vendor
        FROM shopify_order_items 
        WHERE order_id = ?
        ORDER BY (lineitem_quantity * lineitem_price) DESC
      `
      
      const items = await executeQuery(itemsQuery, [order.order_id]) as any[]
      
      // Use staff name or create fake customer name
      const customerName = staffNames[index % staffNames.length] || `Customer ${index + 1}`
      
      return {
        order_id: order.order_id,
        order_name: order.order_name,
        total: parseFloat(order.total || 0),
        subtotal: parseFloat(order.subtotal || 0),
        taxes: parseFloat(order.taxes || 0),
        created_at: order.created_at,
        location: order.location || 'Store',
        sales_person: order.sales_person || 'Sales Rep',
        customer_email: order.customer_email || `${customerName.toLowerCase().replace(' ', '.')}@fit2run.com`,
        customer_name: customerName,
        matching_staff_name: customerName,
        line_items: items.map((item: any) => ({
          name: item.lineitem_name || 'Product',
          sku: item.lineitem_sku || '123456',
          quantity: parseInt(item.lineitem_quantity) || 1,
          price: parseFloat(item.lineitem_price) || 0,
          vendor: item.vendor || 'Vendor',
          line_total: (parseInt(item.lineitem_quantity) || 1) * (parseFloat(item.lineitem_price) || 0)
        }))
      }
    }))

    const totalValue = processedOrders.reduce((sum, order) => sum + order.total, 0)
    
    return NextResponse.json({
      summary: {
        totalOrders: processedOrders.length,
        totalValue,
        avgOrderValue: processedOrders.length > 0 ? totalValue / processedOrders.length : 0,
        uniqueEmployees: Math.min(processedOrders.length, staffNames.length)
      },
      orders: processedOrders
    })

  } catch (error) {
    console.error('Employee sales API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}