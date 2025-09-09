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
      locationFilter = 'AND location = ?'
      params.push(location)
    }


    // Get overall metrics with unique products count
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as total_revenue,
        COUNT(DISTINCT email) as unique_customers,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_order_value,
        COUNT(*) as total_items,
        COUNT(DISTINCT name) as unique_products
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ? ${locationFilter}
    `

    const metrics = await executeQuery(metricsQuery, params) as any[]

    // Get daily sales trend with more detail
    const dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as revenue,
        COUNT(*) as items_sold
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ? ${locationFilter}
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    const dailyData = await executeQuery(dailyQuery, params) as any[]

    // Enhanced location sales with average order value
    const locationQuery = `
      SELECT 
        COALESCE(location, billing_city, 'ecom') as location,
        COUNT(*) as orders,
        SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as revenue,
        COUNT(*) as items_sold,
        AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as avg_order_value
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ?
        AND (location IS NOT NULL OR billing_city IS NOT NULL)
      GROUP BY COALESCE(location, billing_city, 'ecom')
      ORDER BY revenue DESC
      LIMIT 20
    `

    const locationSales = await executeQuery(locationQuery, [startDate, endDate]) as any[]

    // Get detailed order data using shopify_order_items for accurate product info
    const orderDetailsQuery = `
      SELECT 
        o.id,
        o.name as order_number,
        DATE(o.created_at) as order_date,
        COALESCE(o.location, o.billing_city, 'ecom') as location,
        o.employee,
        COALESCE(i.lineitem_name, CONCAT('Order #', o.name)) as product_name,
        COALESCE(i.lineitem_sku, CONCAT('SKU-', LPAD(o.id % 100000, 5, '0'))) as sku,
        COALESCE(i.vendor, 'Unknown Brand') as vendor,
        COALESCE(i.lineitem_quantity, 1) as quantity,
        COALESCE(i.lineitem_price, o.subtotal) as unit_price,
        COALESCE(i.item_total, i.lineitem_price * i.lineitem_quantity, o.subtotal) as line_total,
        o.subtotal,
        o.financial_status
      FROM shopify_orders o
      LEFT JOIN shopify_order_items i ON o.id = i.order_id
      WHERE o.created_at BETWEEN ? AND ? ${locationFilter}
      ORDER BY o.created_at DESC, o.id DESC
    `

    const orderDetails = await executeQuery(orderDetailsQuery, params) as any[]

    // Get real brand sales data from shopify_order_items
    const brandSalesQuery = `
      SELECT 
        COALESCE(i.vendor, 'Unknown Brand') as brand,
        COUNT(DISTINCT o.id) as orders,
        SUM(COALESCE(i.item_total, i.lineitem_price * i.lineitem_quantity, 0)) as revenue,
        SUM(COALESCE(i.lineitem_quantity, 0)) as items_sold,
        COUNT(DISTINCT i.lineitem_sku) as unique_skus
      FROM shopify_orders o
      LEFT JOIN shopify_order_items i ON o.id = i.order_id
      WHERE o.created_at BETWEEN ? AND ? ${locationFilter}
        AND i.vendor IS NOT NULL AND i.vendor != '' AND i.vendor != 'NULL'
      GROUP BY i.vendor
      ORDER BY SUM(COALESCE(i.item_total, i.lineitem_price * i.lineitem_quantity, 0)) DESC
      LIMIT 20
    `
    
    const brandSales = await executeQuery(brandSalesQuery, params) as any[]

    // Get real top products from shopify_order_items
    const topProductsQuery = `
      SELECT 
        i.lineitem_sku as sku,
        COALESCE(i.lineitem_name, 'Unknown Product') as product_name,
        COALESCE(i.vendor, 'Unknown Brand') as brand,
        COUNT(DISTINCT o.id) as orders,
        SUM(COALESCE(i.item_total, i.lineitem_price * i.lineitem_quantity, 0)) as revenue,
        SUM(COALESCE(i.lineitem_quantity, 0)) as quantity_sold,
        AVG(COALESCE(i.lineitem_price, 0)) as avg_price
      FROM shopify_orders o
      LEFT JOIN shopify_order_items i ON o.id = i.order_id
      WHERE o.created_at BETWEEN ? AND ? ${locationFilter}
        AND i.lineitem_sku IS NOT NULL AND i.lineitem_sku != ''
      GROUP BY i.lineitem_sku, i.lineitem_name, i.vendor
      ORDER BY SUM(COALESCE(i.item_total, i.lineitem_price * i.lineitem_quantity, 0)) DESC
      LIMIT 50
    `
    
    const topProductsData = await executeQuery(topProductsQuery, params) as any[]
    const topProducts = topProductsData.map(p => ({
      sku: p.sku,
      productName: p.product_name,
      brand: p.brand,
      orders: parseInt(p.orders) || 0,
      revenue: parseFloat(p.revenue) || 0,
      quantitySold: parseInt(p.quantity_sold) || 0,
      avgPrice: parseFloat(p.avg_price) || 0
    }))

    // Prepare chart data
    const chartData = {
      daily: {
        labels: dailyData.map(d => formatDateForChart(d.date)),
        datasets: [
          {
            label: 'Orders',
            data: dailyData.map(d => parseInt(d.orders) || 0),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Revenue',
            data: dailyData.map(d => parseFloat(d.revenue) || 0),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            yAxisID: 'y1'
          },
          {
            label: 'Items',
            data: dailyData.map(d => parseInt(d.items_sold) || 0),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            yAxisID: 'y',
            hidden: true
          }
        ]
      },
      locations: {
        labels: locationSales.slice(0, 10).map(l => l.location),
        datasets: [{
          label: 'Revenue by Location',
          data: locationSales.slice(0, 10).map(l => parseFloat(l.revenue) || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      brands: brandSales.length > 0 ? {
        labels: brandSales.slice(0, 8).map(b => b.brand),
        datasets: [{
          label: 'Revenue by Brand',
          data: brandSales.slice(0, 8).map(b => parseFloat(b.revenue) || 0),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(168, 85, 247, 0.8)'
          ]
        }]
      } : null
    }


    return NextResponse.json({
      metrics: {
        totalOrders: parseInt(metrics[0]?.total_orders) || 0,
        totalRevenue: parseFloat(metrics[0]?.total_revenue) || 0,
        uniqueCustomers: parseInt(metrics[0]?.unique_customers) || 0,
        avgOrderValue: parseFloat(metrics[0]?.avg_order_value) || 0,
        totalItems: parseInt(metrics[0]?.total_items) || 0,
        uniqueProducts: parseInt(metrics[0]?.unique_products) || 0
      },
      chartData,
      locationSales: locationSales.map(l => ({
        location: l.location,
        orders: parseInt(l.orders) || 0,
        revenue: parseFloat(l.revenue) || 0,
        avgOrderValue: parseFloat(l.avg_order_value) || 0,
        itemsSold: parseInt(l.items_sold) || 0
      })),
      brandSales: brandSales.map(b => ({
        brand: b.brand,
        orders: parseInt(b.orders) || 0,
        revenue: parseFloat(b.revenue) || 0,
        itemsSold: parseInt(b.items_sold) || 0,
        uniqueSkus: parseInt(b.unique_skus) || 0
      })),
      topProducts,
      orderDetails: orderDetails.map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        orderDate: o.order_date, // Keep raw date string for proper parsing
        location: o.location,
        employee: o.employee || '',
        productName: o.product_name,
        sku: o.sku,
        vendor: o.vendor,
        quantity: parseInt(o.quantity) || 1,
        unitPrice: parseFloat(o.unit_price) || 0,
        lineTotal: parseFloat(o.line_total) || 0,
        subtotal: parseFloat(o.subtotal) || 0,
        financialStatus: o.financial_status
      }))
    })

  } catch (error) {
    console.error('Shopify API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}