import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'fit2run',
  password: process.env.DB_PASSWORD || 'Fit2Run1!',
  database: process.env.DB_NAME || 'sales_data',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// Create connection pool
const pool = mysql.createPool(dbConfig)

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const [rows] = await pool.execute(query, params)
    return rows
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

export async function getConnection() {
  return await pool.getConnection()
}

export default pool