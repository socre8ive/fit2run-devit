import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '2024-01-01'
    const endDate = searchParams.get('endDate') || '2025-12-31'  
    const limit = parseInt(searchParams.get('limit') || '100')

    // Step 1: Get all staff names
    const staffQuery = `SELECT id, full_name FROM staff_members WHERE full_name IS NOT NULL`
    const staffMembers = await executeQuery(staffQuery) as any[]
    
    if (staffMembers.length === 0) {
      return NextResponse.json({
        summary: { totalOrders: 0, totalValue: 0, avgOrderValue: 0, uniqueEmployees: 0 },
        orders: []
      })
    }

    // Step 2: Get massive dataset to ensure we capture all employee orders
    const orderQuery = `
      SELECT DISTINCT
        so.id as order_id,
        so.name as order_name, 
        so.total,
        so.subtotal,
        so.taxes,
        so.discount_code,
        so.discount_amount,
        so.created_at,
        so.location,
        so.employee as sales_person,
        so.email as customer_email,
        so.billing_name,
        so.shipping_name
      FROM shopify_orders so
      WHERE so.financial_status = 'paid'
        AND so.created_at >= '${startDate}'
        AND so.created_at <= '${endDate}'
        AND (so.billing_name IS NOT NULL OR so.shipping_name IS NOT NULL)
      ORDER BY so.created_at DESC
      LIMIT ${limit * 1000}
    `
    
    const orders = await executeQuery(orderQuery) as any[]

    // Step 3: Filter for employee orders with case-insensitive matching
    const employeeOrders = orders.filter(order => {
      const billingName = order.billing_name?.trim().toLowerCase() || ''
      const shippingName = order.shipping_name?.trim().toLowerCase() || ''
      
      return staffMembers.some(staff => {
        const staffName = staff.full_name.trim().toLowerCase()
        return billingName === staffName || shippingName === staffName
      })
    })

    // Get line items for employee orders
    const ordersWithItems = await Promise.all(employeeOrders.map(async (order) => {
      const itemsQuery = `
        SELECT 
          lineitem_name,
          lineitem_sku,
          lineitem_quantity,
          lineitem_price,
          vendor
        FROM shopify_order_items 
        WHERE order_id = ${order.order_id}
        ORDER BY (lineitem_quantity * lineitem_price) DESC
      `
      
      const items = await executeQuery(itemsQuery) as any[]
      
      // Find matching staff member by name - CASE-INSENSITIVE
      const billingName = order.billing_name?.trim() || ''
      const shippingName = order.shipping_name?.trim() || ''
      const matchingStaff = staffMembers.find(staff => {
        const staffName = staff.full_name.trim()
        return billingName.toLowerCase() === staffName.toLowerCase() || 
               shippingName.toLowerCase() === staffName.toLowerCase()
      })
      
      const total = parseFloat(order.total || 0)
      const discountAmount = parseFloat(order.discount_amount || 0)
      const originalTotal = total + discountAmount
      const discountPercentage = originalTotal > 0 ? (discountAmount / originalTotal) * 100 : 0
      
      return {
        order_id: order.order_id,
        order_name: order.order_name,
        total: total,
        subtotal: parseFloat(order.subtotal || 0),
        taxes: parseFloat(order.taxes || 0),
        discount_code: order.discount_code || '',
        discount_amount: discountAmount,
        discount_percentage: discountPercentage,
        created_at: order.created_at,
        location: order.location,
        sales_person: order.sales_person || 'N/A',
        customer_email: order.customer_email,
        customer_name: billingName || shippingName || 'Unknown Customer',
        matching_staff_name: matchingStaff?.full_name || 'Employee',
        line_items: items.map((item: any) => ({
          name: item.lineitem_name,
          sku: item.lineitem_sku,
          quantity: parseInt(item.lineitem_quantity) || 0,
          price: parseFloat(item.lineitem_price) || 0,
          vendor: item.vendor,
          line_total: (parseInt(item.lineitem_quantity) || 0) * (parseFloat(item.lineitem_price) || 0)
        }))
      }
    }))

    // Calculate summary stats
    const totalOrders = ordersWithItems.length
    const totalValue = ordersWithItems.reduce((sum, order) => sum + order.total, 0)
    const totalDiscounts = ordersWithItems.reduce((sum, order) => sum + order.discount_amount, 0)
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0
    const avgDiscountPercentage = totalOrders > 0 
      ? ordersWithItems.reduce((sum, order) => sum + order.discount_percentage, 0) / totalOrders
      : 0
    const uniqueEmployees = Array.from(new Set(ordersWithItems.map(o => o.matching_staff_name))).length

    // Sort final results by total value DESC for dashboard display
    const sortedOrders = ordersWithItems.sort((a, b) => b.total - a.total)

    return NextResponse.json({
      summary: {
        totalOrders,
        totalValue,
        totalDiscounts,
        avgOrderValue,
        avgDiscountPercentage,
        uniqueEmployees
      },
      orders: sortedOrders
    })

  } catch (error) {
    console.error('Employee purchases API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}