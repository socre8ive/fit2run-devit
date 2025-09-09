import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import { formatDateForChart } from '@/lib/dateUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const initialData = searchParams.get('initialData')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const selectedStores = searchParams.get('stores')?.split(',').filter(s => s.trim()) || []
    const selectedVendors = searchParams.get('vendors')?.split(',').filter(v => v.trim()) || []
    const analysisFocus = searchParams.get('analysisFocus') || 'Product Sales Overview'
    const minQuantity = parseInt(searchParams.get('minQuantity') || '1')

    // Handle initial data request (just return stores and vendors)
    if (initialData === 'true') {
      const availableStoresQuery = `
        SELECT DISTINCT so.location 
        FROM shopify_orders so 
        WHERE so.location IS NOT NULL 
          AND so.location != '' 
          AND so.location != 'Hq Warehouse (1)'
        ORDER BY so.location
        LIMIT 100
      `
      const availableStoresResult = await executeQuery(availableStoresQuery, []) as any[]
      const availableStores = availableStoresResult.map(s => s.location)

      const availableVendorsQuery = `
        SELECT DISTINCT soi.vendor 
        FROM shopify_order_items soi 
        WHERE soi.vendor IS NOT NULL 
          AND soi.vendor != ''
        ORDER BY soi.vendor
        LIMIT 100
      `
      const availableVendorsResult = await executeQuery(availableVendorsQuery, []) as any[]
      const availableVendors = availableVendorsResult.map(v => v.vendor)

      return NextResponse.json({
        availableStores,
        availableVendors
      })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Get available stores from shopify_orders
    const availableStoresQuery = `
      SELECT DISTINCT so.location 
      FROM shopify_orders so 
      WHERE so.location IS NOT NULL 
        AND so.location != '' 
        AND so.location != 'Hq Warehouse (1)'
      ORDER BY so.location
    `
    const availableStoresResult = await executeQuery(availableStoresQuery, []) as any[]
    const availableStores = availableStoresResult.map(s => s.location)

    // Get available vendors from shopify_order_items
    const availableVendorsQuery = `
      SELECT DISTINCT soi.vendor 
      FROM shopify_order_items soi 
      WHERE soi.vendor IS NOT NULL 
        AND soi.vendor != ''
      ORDER BY soi.vendor
    `
    const availableVendorsResult = await executeQuery(availableVendorsQuery, []) as any[]
    const availableVendors = availableVendorsResult.map(v => v.vendor)

    // Limit the number of stores and vendors to prevent timeouts
    const MAX_STORES = 10
    const MAX_VENDORS = 20
    
    // Use selected stores/vendors or limit to reasonable amounts
    let storesToAnalyze = selectedStores.length > 0 ? selectedStores.slice(0, MAX_STORES) : availableStores.slice(0, MAX_STORES)
    let vendorsToAnalyze = selectedVendors.length > 0 ? selectedVendors.slice(0, MAX_VENDORS) : availableVendors.slice(0, MAX_VENDORS)

    if (storesToAnalyze.length === 0 || vendorsToAnalyze.length === 0) {
      return NextResponse.json({ 
        summary: { totalProducts: 0, totalRevenue: 0, totalUnits: 0, avgProductRevenue: 0 },
        topProducts: [],
        brandPerformance: [],
        availableStores,
        availableVendors
      })
    }

    // Build filters
    const storeFilter = storesToAnalyze.map(() => '?').join(',')
    const vendorFilter = vendorsToAnalyze.map(() => '?').join(',')
    const params = [startDate, endDate, ...storesToAnalyze, ...vendorsToAnalyze, minQuantity]

    // Product performance query - optimized with LIMIT to prevent timeouts
    const productQuery = `
      SELECT 
        soi.lineitem_sku as sku, 
        soi.lineitem_name as product_name, 
        soi.vendor,
        COUNT(*) as order_count,
        SUM(soi.lineitem_quantity) as total_quantity,
        SUM(soi.lineitem_quantity * soi.lineitem_price) as total_revenue,
        AVG(soi.lineitem_price) as avg_price,
        MIN(soi.lineitem_price) as min_price,
        MAX(soi.lineitem_price) as max_price,
        COUNT(DISTINCT so.location) as store_count,
        COUNT(DISTINCT so.employee) as employee_count
      FROM shopify_order_items soi 
      JOIN shopify_orders so ON soi.order_id = so.id 
      WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.financial_status = 'paid' 
        AND soi.lineitem_sku IS NOT NULL 
        AND soi.lineitem_sku != ''
        AND so.location IN (${storeFilter})
        AND soi.vendor IN (${vendorFilter})
      GROUP BY soi.lineitem_sku, soi.lineitem_name, soi.vendor
      HAVING SUM(soi.lineitem_quantity) >= ?
      ORDER BY total_revenue DESC
      LIMIT 1000
    `

    const products = await executeQuery(productQuery, params) as any[]

    // Calculate summary metrics
    const totalProducts = products.length
    const totalRevenue = products.reduce((sum, p) => sum + (parseFloat(p.total_revenue) || 0), 0)
    const totalUnits = products.reduce((sum, p) => sum + (parseInt(p.total_quantity) || 0), 0)
    const avgProductRevenue = totalProducts > 0 ? totalRevenue / totalProducts : 0

    // Brand performance analysis - ALL brands regardless of vendor filter
    const allBrandsQuery = `
      SELECT 
        soi.vendor,
        COUNT(*) as order_count,
        SUM(soi.lineitem_quantity) as total_quantity,
        SUM(soi.lineitem_quantity * soi.lineitem_price) as total_revenue,
        COUNT(DISTINCT soi.lineitem_sku) as product_count
      FROM shopify_order_items soi 
      JOIN shopify_orders so ON soi.order_id = so.id 
      WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.financial_status = 'paid' 
        AND soi.lineitem_sku IS NOT NULL 
        AND soi.lineitem_sku != ''
        AND so.location IN (${storeFilter})
        AND soi.vendor IS NOT NULL 
        AND soi.vendor != ''
      GROUP BY soi.vendor
      HAVING SUM(soi.lineitem_quantity) >= ?
      ORDER BY total_revenue DESC
    `
    
    const allBrandsParams = [startDate, endDate, ...storesToAnalyze, minQuantity]
    const allBrands = await executeQuery(allBrandsQuery, allBrandsParams) as any[]
    
    // Calculate average prices for brands
    const brandPerformance = allBrands.map(brand => ({
      vendor: brand.vendor,
      totalQuantity: parseInt(brand.total_quantity) || 0,
      totalRevenue: parseFloat(brand.total_revenue) || 0,
      totalOrders: parseInt(brand.order_count) || 0,
      productCount: parseInt(brand.product_count) || 0,
      avgPrice: (parseInt(brand.total_quantity) || 0) > 0 ? (parseFloat(brand.total_revenue) || 0) / (parseInt(brand.total_quantity) || 0) : 0
    }))

    return NextResponse.json({
      summary: {
        totalProducts,
        totalRevenue,
        totalUnits,
        avgProductRevenue
      },
      topProducts: products.map(p => ({
        sku: p.sku,
        productName: p.product_name,
        vendor: p.vendor,
        totalQuantity: parseInt(p.total_quantity) || 0,
        totalRevenue: parseFloat(p.total_revenue) || 0,
        avgPrice: parseFloat(p.avg_price) || 0,
        orderCount: parseInt(p.order_count) || 0,
        storeCount: parseInt(p.store_count) || 0,
        employeeCount: parseInt(p.employee_count) || 0
      })),
      brandPerformance,
      availableStores,
      availableVendors,
      selectedStores: storesToAnalyze,
      selectedVendors: vendorsToAnalyze
    })

  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}