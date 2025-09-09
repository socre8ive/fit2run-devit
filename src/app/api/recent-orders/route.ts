import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const dbConfig = {
  host: 'localhost',
  user: process.env.DB_USER || 'fit2run',
  password: process.env.DB_PASSWORD || 'Fit2Run1!',
  database: process.env.DB_NAME || 'sales_data',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

export async function GET(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get 30 most recent orders with fulfillment location
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.name as order_number,
        o.email,
        o.subtotal,
        o.total,
        o.financial_status,
        o.created_at,
        o.currency,
        o.fulfillment_location_id,
        o.fulfillment_location_name,
        o.fulfillment_status
      FROM shopify_orders o
      ORDER BY o.created_at DESC
      LIMIT 30
    `);
    
    // Get line items for these orders
    const orderIds = (orders as any[]).map(o => o.id);
    let lineItems: any[] = [];
    
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const [items] = await connection.execute(
        `SELECT 
          order_id,
          lineitem_name as product_name,
          lineitem_sku as sku,
          lineitem_quantity as quantity,
          lineitem_price as price
        FROM shopify_order_items
        WHERE order_id IN (${placeholders})
        ORDER BY order_id, id`,
        orderIds
      );
      lineItems = items as any[];
    }
    
    // Combine orders with their line items
    const ordersWithItems = (orders as any[]).map(order => {
      const items = lineItems.filter(item => item.order_id === order.id);
      const itemsSummary = items.map(item => 
        `${item.product_name} (x${item.quantity})`
      ).join(', ');
      
      return {
        ...order,
        items: items,
        items_summary: itemsSummary || 'No items'
      };
    });
    
    await connection.end();
    
    const response = NextResponse.json({ 
      success: true,
      orders: ordersWithItems,
      count: ordersWithItems.length,
      timestamp: new Date().toISOString()
    });
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('Recent orders API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch recent orders',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}