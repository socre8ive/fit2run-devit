import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

export async function GET(request: NextRequest) {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'fit2run',
      password: 'Fit2Run1!',
      database: 'sales_data',
      timezone: 'Z'
    })

    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Query to get today's line-in totals by location
    const [rows] = await connection.execute(`
      SELECT 
        UPPER(standard_store_name) as store,
        SUM(line_crossings_in) as traffic_count,
        MAX(event_time) as last_update
      FROM solink_line_crossings
      WHERE event_date = ?
      GROUP BY standard_store_name
      ORDER BY standard_store_name
    `, [todayStr])

    // Build traffic data structure
    const storesData = []
    let totalTraffic = 0
    let activeStores = 0
    
    // Process each store's data
    for (const row of rows as any[]) {
      const trafficCount = parseInt(row.traffic_count || 0)
      const lastUpdate = row.last_update
      
      // Calculate hourly rate (assuming store is open 12 hours, starting at 9am)
      const now = new Date()
      const hoursOpen = Math.min(Math.max(now.getHours() - 9, 0), 12)
      const hourlyRate = hoursOpen > 0 ? Math.round(trafficCount / hoursOpen * 10) / 10 : 0
      
      // Determine status based on last update time
      let status = 'no_data'
      if (lastUpdate) {
        const timeDiff = (now.getTime() - new Date(lastUpdate).getTime()) / 1000
        status = timeDiff < 1800 ? 'active' : 'stale'
        if (status === 'active') activeStores++
      }
      
      storesData.push({
        name: row.store,
        traffic: trafficCount,
        hourly_rate: hourlyRate,
        last_update: lastUpdate ? lastUpdate.toISOString() : null,
        status: status
      })
      
      totalTraffic += trafficCount
    }
    
    // Add stores that might not have data yet
    const allStores = [
      '6LAPS', 'AUGUSTA', 'AVENUES', 'BRADENTON', 'CELEBRATION',
      'CLEARWATER', 'FTMYERSOUTLET', 'MALLOFGEORGIA', 'MELBOURNE',
      'ORANGEPARK', 'PERIMETER', 'PIERPARK', 'PLAZACAROLINA',
      'STPETE', 'TAMPA', 'TYRONE', 'UTC', 'WAREHOUSE'
    ]
    
    const existingStores = storesData.map(s => s.name)
    
    for (const store of allStores) {
      if (!existingStores.includes(store)) {
        storesData.push({
          name: store,
          traffic: 0,
          hourly_rate: 0,
          last_update: null,
          status: 'no_data'
        })
      }
    }
    
    // Sort stores alphabetically
    storesData.sort((a, b) => a.name.localeCompare(b.name))
    
    const responseData = {
      timestamp: new Date().toISOString(),
      date: todayStr,
      stores: storesData,
      summary: {
        total_traffic: totalTraffic,
        active_stores: activeStores,
        total_stores: storesData.length,
        avg_per_store: storesData.length > 0 ? Math.round(totalTraffic / storesData.length * 10) / 10 : 0
      }
    }

    return NextResponse.json(responseData)
    
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch traffic data',
        timestamp: new Date().toISOString(),
        stores: [],
        summary: { total_traffic: 0, active_stores: 0, total_stores: 0, avg_per_store: 0 }
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}