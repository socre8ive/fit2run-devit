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

    // Build location filter
    let locationFilter = ''
    let params = [startDate, endDate]
    if (location !== 'all') {
      locationFilter = 'AND billing_city = ?'
      params.push(location)
    }

    // Get customer retention metrics
    const retentionQuery = `
      SELECT 
        email as customer_id,
        email,
        COUNT(*) as order_count,
        MIN(created_at) as first_order,
        MAX(created_at) as last_order,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_spent,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_order_value,
        DATEDIFF(MAX(created_at), MIN(created_at)) as customer_lifespan_days
      FROM shopify_orders
      WHERE created_at BETWEEN ? AND ? 
        AND email IS NOT NULL 
        AND email != '' ${locationFilter}
      GROUP BY email
      HAVING order_count > 1
      ORDER BY total_spent DESC
      LIMIT 50
    `

    const topRepeatCustomers = await executeQuery(retentionQuery, params) as any[]

    // Get customer segments
    const segmentQuery = `
      SELECT 
        CASE 
          WHEN order_count = 1 THEN 'One-time'
          WHEN order_count BETWEEN 2 AND 3 THEN 'Repeat (2-3)'
          WHEN order_count BETWEEN 4 AND 6 THEN 'Loyal (4-6)'
          ELSE 'VIP (7+)'
        END as segment,
        COUNT(*) as customer_count,
        AVG(total_spent) as avg_total_spent,
        SUM(total_spent) as segment_revenue
      FROM (
        SELECT 
          email as customer_id,
          COUNT(*) as order_count,
          SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_spent
        FROM shopify_orders
        WHERE created_at BETWEEN ? AND ?
          AND email IS NOT NULL 
          AND email != '' ${locationFilter}
        GROUP BY email
      ) customer_stats
      GROUP BY segment
      ORDER BY segment_revenue DESC
    `

    const segments = await executeQuery(segmentQuery, params) as any[]

    // Get monthly retention trend
    const trendQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(DISTINCT email) as unique_customers,
        COUNT(*) as total_orders,
        0 as repeat_orders
      FROM shopify_orders o1
      WHERE created_at BETWEEN ? AND ?
        AND email IS NOT NULL 
        AND email != '' ${locationFilter}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `

    const monthlyTrend = await executeQuery(trendQuery, params) as any[]

    // Calculate summary metrics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT email) as total_customers,
        COUNT(DISTINCT CASE WHEN repeat_customer = 1 THEN email END) as repeat_customers,
        AVG(total_spent) as avg_customer_value,
        AVG(order_count) as avg_orders_per_customer
      FROM (
        SELECT 
          email,
          COUNT(*) as order_count,
          CASE WHEN COUNT(*) > 1 THEN 1 ELSE 0 END as repeat_customer,
          SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_spent
        FROM shopify_orders
        WHERE created_at BETWEEN ? AND ?
          AND email IS NOT NULL 
          AND email != '' ${locationFilter}
        GROUP BY email
      ) customer_metrics
    `

    const summary = await executeQuery(summaryQuery, params) as any[]

    // Get detailed orders for top repeat customers with actual product data
    const customerEmails = topRepeatCustomers.slice(0, 20).map(c => c.email)
    let orderDetails: any[] = []
    
    if (customerEmails.length > 0) {
      const placeholders = customerEmails.map(() => '?').join(',')
      const orderDetailsQuery = `
        SELECT 
          so.id,
          so.name as order_number,
          so.email,
          so.created_at as order_date,
          so.subtotal,
          so.total,
          so.shipping,
          so.taxes,
          so.billing_name,
          so.financial_status,
          so.fulfillment_status,
          so.discount_code,
          so.discount_amount,
          soi.lineitem_name as product_name,
          soi.lineitem_sku as sku,
          soi.lineitem_quantity as quantity,
          soi.lineitem_price as unit_price,
          (soi.lineitem_quantity * soi.lineitem_price) as item_total
        FROM shopify_orders so
        LEFT JOIN shopify_order_items soi ON so.id = soi.order_id
        WHERE so.email IN (${placeholders})
          AND so.created_at BETWEEN ? AND ? ${locationFilter}
        ORDER BY so.email, so.created_at DESC, soi.lineitem_name
      `
      
      const detailParams = [...customerEmails, ...params]
      orderDetails = await executeQuery(orderDetailsQuery, detailParams) as any[]
    }

    const totalCustomers = parseInt(summary[0]?.total_customers) || 0
    const repeatCustomers = parseInt(summary[0]?.repeat_customers) || 0
    const retentionRate = totalCustomers > 0 ? ((repeatCustomers / totalCustomers) * 100).toFixed(2) : '0'

    return NextResponse.json({
      summary: {
        totalCustomers,
        repeatCustomers,
        retentionRate: parseFloat(retentionRate),
        avgCustomerValue: parseFloat(summary[0]?.avg_customer_value) || 0,
        avgOrdersPerCustomer: parseFloat(summary[0]?.avg_orders_per_customer) || 0
      },
      topCustomers: topRepeatCustomers.slice(0, 20).map(c => {
        // Group order details by order number to combine products within same order
        const customerOrderDetails = orderDetails.filter(order => order.email === c.email)
        const orderMap = new Map()
        
        customerOrderDetails.forEach(detail => {
          const orderKey = detail.order_number
          if (!orderMap.has(orderKey)) {
            orderMap.set(orderKey, {
              orderNumber: detail.order_number,
              orderDate: formatDateForChart(detail.order_date),
              total: parseFloat(detail.total || 0),
              subtotal: parseFloat(detail.subtotal || 0),
              shipping: parseFloat(detail.shipping || 0),
              taxes: parseFloat(detail.taxes || 0),
              status: detail.financial_status,
              fulfillmentStatus: detail.fulfillment_status,
              discountCode: detail.discount_code,
              discountAmount: parseFloat(detail.discount_amount || 0),
              billingName: detail.billing_name,
              products: []
            })
          }
          
          // Add product to this order if it exists
          if (detail.product_name && detail.product_name.trim() !== '') {
            orderMap.get(orderKey).products.push({
              name: detail.product_name,
              sku: detail.sku || '',
              quantity: parseInt(detail.quantity || 0),
              unitPrice: parseFloat(detail.unit_price || 0),
              itemTotal: parseFloat(detail.item_total || 0)
            })
          }
        })
        
        // Convert map to array and create product descriptions
        const customerOrders = Array.from(orderMap.values()).map(order => ({
          ...order,
          description: order.products.length > 0 
            ? order.products.map((p: any) => `${p.name}${p.quantity > 1 ? ` (${p.quantity})` : ''}`).join(', ')
            : `Order #${order.orderNumber}`,
          upc: order.products.length > 0 && order.products[0].sku 
            ? order.products[0].sku 
            : `ORD-${order.orderNumber.slice(-5)}`
        }))

        return {
          customerId: c.customer_id,
          email: c.email,
          orderCount: parseInt(c.order_count),
          totalSpent: parseFloat(c.total_spent),
          avgOrderValue: parseFloat(c.avg_order_value),
          lifespanDays: parseInt(c.customer_lifespan_days),
          firstOrder: c.first_order,
          lastOrder: c.last_order,
          orders: customerOrders
        }
      }),
      segments: segments.map(s => ({
        segment: s.segment,
        customerCount: parseInt(s.customer_count),
        avgTotalSpent: parseFloat(s.avg_total_spent),
        segmentRevenue: parseFloat(s.segment_revenue)
      })),
      chartData: {
        retention: {
          labels: monthlyTrend.map(t => formatDateForChart(t.month + '-01')),
          datasets: [
            {
              label: 'Repeat Orders',
              data: monthlyTrend.map(t => parseInt(t.repeat_orders)),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
            },
            {
              label: 'Total Orders',
              data: monthlyTrend.map(t => parseInt(t.total_orders)),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
            }
          ]
        },
        segments: {
          labels: segments.map(s => s.segment),
          datasets: [{
            label: 'Revenue by Segment',
            data: segments.map(s => parseFloat(s.segment_revenue)),
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(16, 185, 129, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(239, 68, 68, 0.8)'
            ]
          }]
        }
      }
    })

  } catch (error) {
    console.error('Customers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}