import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: process.env.DB_NAME || 'sales_data'
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location') || searchParams.get('store');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const hourly = searchParams.get('hourly') === 'true';
  const details = searchParams.get('details') === 'true';

  try {
    const connection = await mysql.createConnection(dbConfig);

    let hourlyQuery = '';
    let hourlyParams: any[] = [];

    // Build WHERE conditions for hourly data
    const whereConditions = ['line_crossings_in > 0'];
    const queryParams = [];

    if (location && location !== 'all' && location !== 'all_stores') {
      whereConditions.push('standard_store_name = ?');
      queryParams.push(location);
    }

    if (startDate && endDate) {
      whereConditions.push('event_date >= ? AND event_date <= ?');
      queryParams.push(startDate, endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get hourly data - this is what the user requested
    hourlyQuery = `
      SELECT 
        HOUR(event_time) as hour,
        SUM(line_crossings_in) as total_entries
      FROM solink_line_crossings 
      ${whereClause}
      GROUP BY HOUR(event_time)
      ORDER BY hour ASC
    `;
    hourlyParams = queryParams;

    const [hourlyRows] = await connection.execute(hourlyQuery, hourlyParams);
    await connection.end();

    return NextResponse.json({
      hourlyData: hourlyRows
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
  }
}