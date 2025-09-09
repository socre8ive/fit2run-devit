import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

// Database connection pool
const connection = mysql.createPool({
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: 'sales_data',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

interface LYComparisonData {
  upc: string
  productName: string
  vendor: string
  category: string
  thisYearSales: number
  lastYearSales: number
  percentageChange: number
  dollarChange: number
  thisYearUnits: number
  lastYearUnits: number
  percentOfTotal?: number
}

interface BrandSummary {
  brand: string
  category: string
  thisYearSales: number
  lastYearSales: number
  thisYearUnits: number
  lastYearUnits: number
  percentageChange: number
  dollarChange: number
  uniqueProducts: number
  totalPercentOfSales?: number
}

interface LYComparisonSummary {
  totalThisYear: number
  totalLastYear: number
  totalPercentageChange: number
  totalDollarChange: number
  totalUPCs: number
  positiveUPCs: number
  negativeUPCs: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const stores = searchParams.get('stores') || 'all_stores'
    const vendor = searchParams.get('vendor') || 'all'
    const category = searchParams.get('category') || 'all'
    const matchType = searchParams.get('matchType') || 'all'

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    const thisYearStart = new Date(startDate)
    const thisYearEnd = new Date(endDate)
    const lastYearStart = new Date(thisYearStart)
    const lastYearEnd = new Date(thisYearEnd)
    
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1)
    lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1)

    // Build dynamic filters
    let storeFilter = ''
    if (stores !== 'all_stores') {
      const storeList = stores.split(',').map(s => `'${s.replace("'", "''")}'`).join(',')
      storeFilter = `AND o.location IN (${storeList})`
    }

    let categoryFilter = ''
    switch (category) {
      case 'footwear':
        categoryFilter = "AND c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track')"
        break
      case 'apparel':
        categoryFilter = "AND c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear')"
        break
      case 'accessories':
        categoryFilter = "AND c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories', 'Compression', 'Hydration', 'Nutrition', 'Injury/Recovery', 'Bags/Belts', 'Insoles/Orthotics', 'GPS', 'Sunglasses', 'Electronic Accessories', 'Fitness', 'Safety', 'Jewelry', 'Skin Care', 'Headphones', 'Strollers', 'Laces/Spikes', 'GPS/HRM', 'Watches', 'Laces', 'Bike Accessories', 'Parts', 'Bags', 'Sunlasses', 'Foam Rollers', 'Rain Gear')"
        break
    }

    let vendorFilter = ''
    if (vendor !== 'all') {
      vendorFilter = `AND c.Vendor = '${vendor.replace("'", "''")}'`
    }

    let matchTypeFilter = ''
    if (matchType === 'matches') {
      matchTypeFilter = 'AND final_results.thisYearSales > 0 AND final_results.lastYearSales > 0'
    }

    const query = `
      SELECT * FROM (
        SELECT 
          c.CLU as upc,
          COALESCE(NULLIF(oi.lineitem_name, ''), NULLIF(c.Description, '')) as productName,
          c.Vendor as vendor,
          CASE 
            WHEN c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track') THEN 'Footwear'
            WHEN c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear') THEN 'Apparel'
            WHEN c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories', 'Compression', 'Hydration', 'Nutrition', 'Injury/Recovery', 'Bags/Belts', 'Insoles/Orthotics', 'GPS', 'Sunglasses', 'Electronic Accessories', 'Fitness', 'Safety', 'Jewelry', 'Skin Care', 'Headphones', 'Strollers', 'Laces/Spikes', 'GPS/HRM', 'Watches', 'Laces', 'Bike Accessories', 'Parts', 'Bags', 'Sunlasses', 'Foam Rollers', 'Rain Gear') THEN 'Accessories'
            WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Footwear' THEN 'Footwear'
            WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Apparel' THEN 'Apparel'
            WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Accessories' THEN 'Accessories'
            ELSE 'Other'
          END as category,
          SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
              THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) as thisYearSales,
          SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
              THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) as lastYearSales,
          SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
              THEN oi.lineitem_quantity ELSE 0 END) as thisYearUnits,
          SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
              THEN oi.lineitem_quantity ELSE 0 END) as lastYearUnits,
          CASE 
            WHEN SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
                     THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) = 0 THEN 
              CASE WHEN SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
                           THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) > 0 THEN 100 ELSE 0 END
            ELSE 
              ((SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
                    THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) - 
                SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
                    THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END)) / 
               SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
                   THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END)) * 100 
          END as percentageChange,
          (SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
               THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) - 
           SUM(CASE WHEN DATE(o.created_at) BETWEEN ? AND ? 
               THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END)) as dollarChange
        FROM shopify_orders o
        JOIN shopify_order_items oi ON o.id = oi.order_id
        JOIN (SELECT CLU, MIN(id) as id, 
                     MAX(Description) as Description, 
                     MAX(Vendor) as Vendor, 
                     MAX(Shopify_Class) as Shopify_Class,
                     MAX(Shopify_Dept) as Shopify_Dept
              FROM fit2run_catalog 
              GROUP BY CLU) c ON oi.lineitem_sku = c.CLU
        WHERE (DATE(o.created_at) BETWEEN ? AND ?
           OR DATE(o.created_at) BETWEEN ? AND ?)
        ${storeFilter}
        ${categoryFilter}
        ${vendorFilter}
        AND c.CLU IS NOT NULL AND c.CLU != ''
        AND c.Description IS NOT NULL
        AND c.Vendor IS NOT NULL AND c.Vendor != '' AND c.Vendor != 'Unknown Vendor'
        GROUP BY c.CLU, productName, c.Vendor, category
        HAVING (thisYearSales > 0 OR lastYearSales > 0)
      ) as final_results
      WHERE 1=1 ${matchType === 'matches' ? 'AND final_results.thisYearSales > 0 AND final_results.lastYearSales > 0' : ''}
      ORDER BY ABS(final_results.dollarChange) DESC`

    const params = [
      // thisYearSales calculation
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0],
      // lastYearSales calculation
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0],
      // thisYearUnits calculation
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0],
      // lastYearUnits calculation
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0],
      // percentageChange calculation (multiple references)
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0],
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0],
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0],
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0],
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0],
      // dollarChange calculation
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0],
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0],
      // WHERE clause date ranges
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0],
      lastYearStart.toISOString().split('T')[0],
      lastYearEnd.toISOString().split('T')[0]
    ]

    const [rows] = await connection.execute(query, params)
    // Convert string values to numbers for proper handling
    const data = (rows as any[]).map(row => ({
      upc: row.upc,
      productName: row.productName,
      vendor: row.vendor,
      category: row.category,
      thisYearSales: parseFloat(row.thisYearSales) || 0,
      lastYearSales: parseFloat(row.lastYearSales) || 0,
      percentageChange: parseFloat(row.percentageChange) || 0,
      dollarChange: parseFloat(row.dollarChange) || 0,
      thisYearUnits: parseInt(row.thisYearUnits) || 0,
      lastYearUnits: parseInt(row.lastYearUnits) || 0
    })) as LYComparisonData[]

    // Calculate summary
    const summary: LYComparisonSummary = {
      totalThisYear: data.reduce((sum, item) => sum + item.thisYearSales, 0),
      totalLastYear: data.reduce((sum, item) => sum + item.lastYearSales, 0),
      totalUPCs: data.length,
      positiveUPCs: data.filter(item => item.percentageChange > 0).length,
      negativeUPCs: data.filter(item => item.percentageChange < 0).length,
      totalPercentageChange: 0,
      totalDollarChange: 0
    }

    summary.totalDollarChange = summary.totalThisYear - summary.totalLastYear
    summary.totalPercentageChange = summary.totalLastYear > 0 
      ? ((summary.totalThisYear - summary.totalLastYear) / summary.totalLastYear) * 100 
      : 0

    // Get total sales for the selected period/location to calculate percentage of total
    let totalSalesQuery = `
      SELECT 
        SUM(oi.lineitem_price * oi.lineitem_quantity) as totalSales
      FROM shopify_orders o 
      JOIN shopify_order_items oi ON o.id = oi.order_id 
      WHERE DATE(o.created_at) BETWEEN ? AND ?
      ${storeFilter}
    `
    const [totalSalesRows] = await connection.execute(totalSalesQuery, [
      thisYearStart.toISOString().split('T')[0],
      thisYearEnd.toISOString().split('T')[0]
    ])
    const totalSales = (totalSalesRows as any[])[0]?.totalSales || 0

    // Calculate percentage of total sales for each product
    data.forEach(item => {
      item.percentOfTotal = totalSales > 0 ? (item.thisYearSales / totalSales) * 100 : 0
    })

    // Calculate brand summary if vendor is selected
    let brandSummary: BrandSummary | null = null
    if (vendor !== 'all' && vendor) {
      brandSummary = {
        brand: vendor,
        category: category === 'all' ? 'All Categories' : 
                 category === 'footwear' ? 'Footwear' : 
                 category === 'apparel' ? 'Apparel' : 
                 category === 'accessories' ? 'Accessories' : category,
        thisYearSales: summary.totalThisYear,
        lastYearSales: summary.totalLastYear,
        thisYearUnits: data.reduce((sum, item) => sum + item.thisYearUnits, 0),
        lastYearUnits: data.reduce((sum, item) => sum + item.lastYearUnits, 0),
        uniqueProducts: data.length,
        dollarChange: summary.totalDollarChange,
        percentageChange: summary.totalPercentageChange,
        totalPercentOfSales: totalSales > 0 ? (summary.totalThisYear / totalSales) * 100 : 0
      }
    }

    return NextResponse.json({
      data,
      summary,
      brandSummary,
      dateRanges: {
        thisYearStart: thisYearStart.toISOString().split('T')[0],
        thisYearEnd: thisYearEnd.toISOString().split('T')[0],
        lastYearStart: lastYearStart.toISOString().split('T')[0],
        lastYearEnd: lastYearEnd.toISOString().split('T')[0]
      }
    })

  } catch (error) {
    console.error('LY Comparison API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}