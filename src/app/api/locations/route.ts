import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'

export async function GET() {
  try {
    const query = `
      SELECT DISTINCT location 
      FROM shopify_orders 
      WHERE location IS NOT NULL AND location != '' 
      ORDER BY location
    `
    
    const locations = await executeQuery(query) as any[]
    const locationNames = locations.map(l => l.location)
    
    // Separate physical stores from Ecom
    const physicalStores = locationNames.filter(loc => 
      !loc.toLowerCase().includes('ecom') && 
      !loc.toLowerCase().includes('online') &&
      !loc.toLowerCase().includes('web')
    )
    
    const hasEcom = locationNames.some(loc => 
      loc.toLowerCase().includes('ecom') || 
      loc.toLowerCase().includes('online') ||
      loc.toLowerCase().includes('web')
    )
    
    // Build dropdown options
    const dropdownOptions = ['all_stores']
    dropdownOptions.push(...physicalStores)
    if (hasEcom) {
      dropdownOptions.push('ecom')
    }
    
    return NextResponse.json({
      locations: dropdownOptions,
      physicalStores,
      hasEcom,
      allLocations: locationNames
    })
  } catch (error) {
    console.error('Locations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}