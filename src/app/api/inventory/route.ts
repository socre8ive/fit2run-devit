import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import { formatDateForChart } from '@/lib/dateUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const initialData = searchParams.get('initialData')
    const location = searchParams.get('location')
    const minPrice = parseFloat(searchParams.get('minPrice') || '0')
    const minTotalValue = parseFloat(searchParams.get('minTotalValue') || '0')

    // Handle initial data request (just return available locations)
    if (initialData === 'true') {
      const availableLocationsQuery = `
        SELECT DISTINCT location 
        FROM store_inventory 
        WHERE location IS NOT NULL
        ORDER BY location
        LIMIT 50
      `
      const availableLocationsResult = await executeQuery(availableLocationsQuery, []) as any[]
      const availableLocations = availableLocationsResult.map(l => l.location)

      return NextResponse.json({
        availableLocations
      })
    }

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    // Main inventory query - exactly like display3.py
    const inventoryQuery = `
      SELECT 
        si.sku,
        si.name as product_name,
        si.manufacturer as vendor_name,
        si.retail_price,
        si.total_qty as current_stock,
        si.mh_department,
        (si.retail_price * si.total_qty) as total_value
      FROM store_inventory si
      WHERE si.location = ?
        AND si.total_qty > 0
        AND si.retail_price >= ?
      HAVING total_value >= ?
      ORDER BY total_value DESC
      LIMIT 5000
    `

    const inventory = await executeQuery(inventoryQuery, [location, minPrice, minTotalValue]) as any[]

    if (inventory.length === 0) {
      return NextResponse.json({
        summary: { totalSKUs: 0, totalUnits: 0, totalValue: 0, avgPrice: 0 },
        highValueItems: [],
        vendorSummary: [],
        departmentSummary: [],
        allInventory: []
      })
    }

    // Calculate summary metrics
    const totalSKUs = inventory.length
    const totalUnits = inventory.reduce((sum, item) => sum + (parseInt(item.current_stock) || 0), 0)
    const totalValue = inventory.reduce((sum, item) => sum + (parseFloat(item.total_value) || 0), 0)
    const avgPrice = inventory.reduce((sum, item) => sum + (parseFloat(item.retail_price) || 0), 0) / totalSKUs

    // Process inventory items
    const processedInventory = inventory.map(item => ({
      sku: item.sku,
      productName: item.product_name,
      vendorName: item.vendor_name,
      retailPrice: parseFloat(item.retail_price) || 0,
      currentStock: parseInt(item.current_stock) || 0,
      mhDepartment: item.mh_department || 'Unknown',
      totalValue: parseFloat(item.total_value) || 0
    }))

    // High value items (top 50 by total value)
    const highValueItems = processedInventory.slice(0, 50)

    // Vendor summary - exactly like display3.py
    const vendorMap = new Map()
    processedInventory.forEach(item => {
      const vendor = item.vendorName
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          vendor: vendor,
          skus: 0,
          units: 0,
          totalValue: 0
        })
      }
      const vendorData = vendorMap.get(vendor)
      vendorData.skus += 1
      vendorData.units += item.currentStock
      vendorData.totalValue += item.totalValue
    })

    const vendorSummary = Array.from(vendorMap.values()).map(vendor => ({
      ...vendor,
      avgPrice: vendor.units > 0 ? vendor.totalValue / vendor.units : 0
    })).sort((a, b) => b.totalValue - a.totalValue)

    // Department summary - exactly like display3.py
    const deptMap = new Map()
    processedInventory.forEach(item => {
      const dept = item.mhDepartment
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          skus: 0,
          units: 0,
          totalValue: 0
        })
      }
      const deptData = deptMap.get(dept)
      deptData.skus += 1
      deptData.units += item.currentStock
      deptData.totalValue += item.totalValue
    })

    const departmentSummary = Array.from(deptMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)

    return NextResponse.json({
      summary: {
        totalSKUs,
        totalUnits,
        totalValue,
        avgPrice
      },
      highValueItems,
      vendorSummary,
      departmentSummary,
      allInventory: processedInventory
    })

  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}