import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const connection = mysql.createPool({
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: 'sales_data',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

export async function GET() {
  try {
    const query = `
      SELECT DISTINCT 
          CASE 
              WHEN c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track') THEN 'Footwear'
              WHEN c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear') THEN 'Apparel'
              WHEN c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories', 'Compression', 'Hydration', 'Nutrition', 'Injury/Recovery', 'Bags/Belts', 'Insoles/Orthotics', 'GPS', 'Sunglasses', 'Electronic Accessories', 'Fitness', 'Safety', 'Jewelry', 'Skin Care', 'Headphones', 'Strollers', 'Laces/Spikes', 'GPS/HRM', 'Watches', 'Laces', 'Bike Accessories', 'Parts', 'Bags', 'Sunlasses', 'Foam Rollers', 'Rain Gear') THEN 'Accessories'
              WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Footwear' THEN 'Footwear'
              WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Apparel' THEN 'Apparel'
              WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Accessories' THEN 'Accessories'
              ELSE 'Other'
          END as category
      FROM fit2run_catalog c
      WHERE (c.Shopify_Class IS NOT NULL AND c.Shopify_Class != '')
         OR (c.Shopify_Class IS NULL AND c.Shopify_Dept IS NOT NULL)
      ORDER BY category`

    const [rows] = await connection.execute(query)
    const categories = (rows as any[])
      .map(row => row.category)
      .filter(category => category !== 'Other')

    return NextResponse.json(categories)

  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}