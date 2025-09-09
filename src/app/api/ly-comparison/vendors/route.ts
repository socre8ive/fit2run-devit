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
      SELECT DISTINCT c.Vendor as vendor
      FROM fit2run_catalog c
      WHERE c.Vendor IS NOT NULL 
        AND c.Vendor != '' 
        AND c.Vendor != 'Unknown Vendor'
      ORDER BY c.Vendor`

    const [rows] = await connection.execute(query)
    const vendors = (rows as any[]).map(row => row.vendor)

    return NextResponse.json(vendors)

  } catch (error) {
    console.error('Vendors API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}