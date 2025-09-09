import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: 'sales_data',
}

export async function GET() {
  let connection
  
  try {
    connection = await mysql.createConnection(dbConfig)
    
    // Get line-crossing cameras and locations (excluding warehouse/HQ)
    const [statsResult] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT CONCAT(site_id, '_', camera_name)) as line_crossing_cameras,
        COUNT(DISTINCT site_id) as active_locations
      FROM solink_line_crossings
      WHERE standard_store_name NOT IN ('warehouse', 'unknown')
        AND event_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `)
    
    // Get line-in events by store for today, yesterday, this week, and this month
    const [storeEventsResult] = await connection.execute(`
      SELECT 
        CONCAT(UPPER(SUBSTRING(standard_store_name, 1, 1)), SUBSTRING(standard_store_name, 2)) as store_name,
        COALESCE(SUM(CASE 
          WHEN event_date = CURDATE() 
          THEN line_crossings_in 
          ELSE 0 
        END), 0) as today,
        COALESCE(SUM(CASE 
          WHEN event_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
          THEN line_crossings_in 
          ELSE 0 
        END), 0) as yesterday,
        COALESCE(SUM(CASE 
          WHEN event_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
            AND event_date <= CURDATE()
          THEN line_crossings_in 
          ELSE 0 
        END), 0) as week,
        COALESCE(SUM(CASE 
          WHEN YEAR(event_date) = YEAR(CURDATE()) 
            AND MONTH(event_date) = MONTH(CURDATE())
            AND event_date <= CURDATE()
          THEN line_crossings_in 
          ELSE 0 
        END), 0) as month
      FROM solink_line_crossings
      WHERE standard_store_name NOT IN ('warehouse', 'unknown', '')
        AND standard_store_name IS NOT NULL
      GROUP BY standard_store_name
      ORDER BY standard_store_name
    `)
    
    return NextResponse.json({
      stats: {
        total_cameras: 390, // Total cameras in SoLink system
        line_crossing_cameras: (statsResult as any)[0].line_crossing_cameras || 0,
        active_locations: (statsResult as any)[0].active_locations || 0,
      },
      storeEvents: storeEventsResult || []
    })
    
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SoLink data' },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}