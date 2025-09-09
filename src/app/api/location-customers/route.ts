import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import { formatDateForChart } from '@/lib/dateUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const selectedStores = searchParams.get('stores')?.split(',') || []
    const topN = parseInt(searchParams.get('topN') || '10')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Get available stores from the database
    const availableStoresQuery = `
      SELECT DISTINCT location 
      FROM shopify_orders 
      WHERE location IS NOT NULL 
        AND location != '' 
        AND location != 'Hq Warehouse (1)'
        AND financial_status = 'paid' 
      ORDER BY location
    `
    const availableStores = await executeQuery(availableStoresQuery, []) as any[]
    const storeList = availableStores.map(s => s.location)

    // Use all stores if none specifically selected
    const storesToAnalyze = selectedStores.length > 0 ? selectedStores : storeList

    if (storesToAnalyze.length === 0) {
      return NextResponse.json({ 
        summary: { totalCustomers: 0, totalRevenue: 0, avgCustomerValue: 0, totalOrders: 0 },
        storeData: {},
        availableStores: []
      })
    }

    // Create store filter for SQL
    const storeFilter = storesToAnalyze.map(() => '?').join(',')
    const params = [startDate, endDate, ...storesToAnalyze]

    // Get top customers by location - USING SUBTOTAL exactly like display3.py
    const topCustomersQuery = `
      SELECT 
        location,
        email,
        billing_name,
        COUNT(*) as total_orders,
        SUM(subtotal) as total_spent,
        AVG(subtotal) as avg_order_value,
        MIN(created_at) as first_order,
        MAX(created_at) as last_order,
        COUNT(DISTINCT DATE(created_at)) as shopping_days
      FROM shopify_orders 
      WHERE created_at BETWEEN ? AND ?
        AND location IN (${storeFilter})
        AND email IS NOT NULL 
        AND email != ''
        AND financial_status = 'paid'
      GROUP BY location, email, billing_name
      ORDER BY location, total_spent DESC
    `

    const allTopCustomers = await executeQuery(topCustomersQuery, params) as any[]

    // Get top N customers per store
    const storeData: { [key: string]: any } = {}
    
    for (const store of storesToAnalyze) {
      const storeCustomers = allTopCustomers
        .filter(c => c.location === store)
        .slice(0, topN)
        .map((customer, index) => ({
          rank: index + 1,
          email: customer.email,
          billingName: customer.billing_name || 'No Name',
          totalOrders: parseInt(customer.total_orders) || 0,
          totalSpent: parseFloat(customer.total_spent) || 0,
          avgOrderValue: parseFloat(customer.avg_order_value) || 0,
          firstOrder: customer.first_order,
          lastOrder: customer.last_order,
          shoppingDays: parseInt(customer.shopping_days) || 0,
          location: customer.location,
          orders: [] as any[]
        }))

      // Get detailed orders for these top customers at this store
      if (storeCustomers.length > 0) {
        const customerEmails = storeCustomers.map(c => c.email)
        const emailFilter = customerEmails.map(() => '?').join(',')
        const orderParams = [startDate, endDate, store, ...customerEmails]

        const customerOrdersQuery = `
          SELECT 
            so.email,
            so.billing_name,
            so.id as order_id,
            so.name as order_number,
            DATE(so.created_at) as order_date,
            so.subtotal as order_value,
            so.employee,
            COUNT(soi.id) as item_count,
            GROUP_CONCAT(DISTINCT soi.vendor ORDER BY soi.vendor SEPARATOR ', ') as brands,
            GROUP_CONCAT(CONCAT(soi.lineitem_name, ' (', soi.lineitem_quantity, ')') SEPARATOR '; ') as items_detail
          FROM shopify_orders so
          LEFT JOIN shopify_order_items soi ON so.id = soi.order_id
          WHERE so.created_at BETWEEN ? AND ?
            AND so.location = ?
            AND so.email IN (${emailFilter})
            AND so.financial_status = 'paid'
          GROUP BY so.email, so.billing_name, so.id, so.name, DATE(so.created_at), so.subtotal, so.employee
          ORDER BY so.email, so.created_at DESC
        `

        const customerOrders = await executeQuery(customerOrdersQuery, orderParams) as any[]

        // Attach orders to each customer
        storeCustomers.forEach(customer => {
          customer.orders = customerOrders
            .filter(order => order.email === customer.email)
            .map(order => ({
              orderNumber: order.order_number,
              orderDate: formatDateForChart(order.order_date),
              orderValue: parseFloat(order.order_value) || 0,
              employee: order.employee || '',
              itemCount: parseInt(order.item_count) || 0,
              brands: order.brands || '',
              itemsDetail: order.items_detail || 'No items'
            }))
        })
      }

      // Calculate store summary metrics
      const storeRevenue = storeCustomers.reduce((sum, c) => sum + c.totalSpent, 0)
      const storeOrders = storeCustomers.reduce((sum, c) => sum + c.totalOrders, 0)
      const avgCustomerValue = storeCustomers.length > 0 ? storeRevenue / storeCustomers.length : 0

      storeData[store] = {
        customers: storeCustomers,
        storeRevenue,
        avgCustomerValue,
        totalOrders: storeOrders,
        customerCount: storeCustomers.length
      }
    }

    // Get product preferences for these customers by location (like display3.py)
    const allCustomerEmails = Object.values(storeData)
      .flatMap((store: any) => store.customers.map((c: any) => c.email))
    
    let productPreferences: { [key: string]: any[] } = {}
    
    if (allCustomerEmails.length > 0) {
      const emailFilter = allCustomerEmails.map(() => '?').join(',')
      const prefParams = [startDate, endDate, ...storesToAnalyze, ...allCustomerEmails]
      const storeFilterForPrefs = storesToAnalyze.map(() => '?').join(',')

      const productPreferencesQuery = `
        SELECT 
          so.location,
          soi.vendor as brand,
          soi.lineitem_name as product_name,
          soi.lineitem_sku as sku,
          COUNT(*) as order_frequency,
          SUM(soi.lineitem_quantity) as total_quantity,
          SUM(soi.lineitem_quantity * soi.lineitem_price) as total_revenue,
          AVG(soi.lineitem_price) as avg_price,
          COUNT(DISTINCT so.email) as unique_customers
        FROM shopify_orders so
        JOIN shopify_order_items soi ON so.id = soi.order_id
        WHERE so.created_at BETWEEN ? AND ?
          AND so.location IN (${storeFilterForPrefs})
          AND so.email IN (${emailFilter})
          AND so.financial_status = 'paid'
          AND soi.lineitem_sku IS NOT NULL
          AND soi.lineitem_sku != ''
        GROUP BY so.location, soi.vendor, soi.lineitem_name, soi.lineitem_sku
        ORDER BY so.location, total_revenue DESC
      `

      const prefResults = await executeQuery(productPreferencesQuery, prefParams) as any[]
      
      // Group by store location
      for (const pref of prefResults) {
        if (!productPreferences[pref.location]) {
          productPreferences[pref.location] = []
        }
        productPreferences[pref.location].push({
          brand: pref.brand,
          productName: pref.product_name,
          sku: pref.sku,
          orderFrequency: parseInt(pref.order_frequency),
          totalQuantity: parseInt(pref.total_quantity),
          totalRevenue: parseFloat(pref.total_revenue) || 0,
          avgPrice: parseFloat(pref.avg_price) || 0,
          uniqueCustomers: parseInt(pref.unique_customers)
        })
      }
    }

    // Calculate overall summary
    const allCustomers = Object.values(storeData).flatMap((store: any) => store.customers)
    const totalRevenue = allCustomers.reduce((sum, c: any) => sum + c.totalSpent, 0)
    const totalOrders = allCustomers.reduce((sum, c: any) => sum + c.totalOrders, 0)

    return NextResponse.json({
      summary: {
        totalCustomers: allCustomers.length,
        totalRevenue,
        avgCustomerValue: allCustomers.length > 0 ? totalRevenue / allCustomers.length : 0,
        totalOrders
      },
      storeData,
      productPreferences,
      availableStores: storeList,
      selectedStores: storesToAnalyze
    })

  } catch (error) {
    console.error('Location customers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}