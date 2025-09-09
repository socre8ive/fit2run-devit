import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import mysql from 'mysql2/promise';

// Use the Shopify-provided webhook secrets (support multiple stores)
const WEBHOOK_SECRETS = [
  process.env.SHOPIFY_WEBHOOK_SECRET || '806a6f7c6c31e5e5b2e09971da57428f37798b8b2254426a142cbb433baa923c',
  process.env.SHOPIFY_WEBHOOK_SECRET_2 || '05501b115415e2ceee151b151c2f96792187e89667a471946d8e1798750701f9'
];

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: 'sales_data'
};

// Verify HMAC signature against multiple webhook secrets
function verifyWebhook(body: string, signature: string): { isValid: boolean; secret?: string } {
  if (!signature) return { isValid: false };
  
  // Try each webhook secret
  for (const secret of WEBHOOK_SECRETS) {
    const hmac = createHmac('sha256', secret);
    hmac.update(body, 'utf8');
    const calculatedSignature = hmac.digest('base64');
    
    if (calculatedSignature === signature) {
      return { isValid: true, secret: secret.substring(0, 8) + '...' };
    }
  }
  
  return { isValid: false };
}

// Log webhook events
async function logWebhookEvent(
  topic: string, 
  orderId: string | null, 
  status: 'received' | 'processed' | 'failed' | 'duplicate',
  details: string | null = null,
  errorMessage: string | null = null
): Promise<void> {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    await connection.execute(`
      INSERT INTO shopify_webhook_log 
      (webhook_topic, shopify_order_id, processing_status, created_at, error_message) 
      VALUES (?, ?, ?, NOW(), ?)
    `, [topic, orderId, status, errorMessage]);
  } catch (error) {
    console.error('Failed to log webhook event:', error);
  } finally {
    await connection.end();
  }
}

// Check if order already exists (duplicate detection)
async function orderExists(orderId: string): Promise<boolean> {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [rows] = await connection.execute(
      'SELECT id FROM shopify_orders WHERE id = ?',
      [orderId]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.error('Error checking order existence:', error);
    return false;
  } finally {
    await connection.end();
  }
}

// Process order data and store in database
async function processOrderData(orderData: any): Promise<void> {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    await connection.beginTransaction();

    // Insert order record
    await connection.execute(`
      INSERT INTO shopify_orders (
        id, name, email, phone, created_at, updated_at, processed_at,
        cancelled_at, closed_at, total_price, subtotal_price, total_tax,
        currency, financial_status, fulfillment_status, gateway,
        test, order_number, fulfillment_location_id, fulfillment_location_name,
        customer_first_name, customer_last_name, shipping_city, shipping_province,
        shipping_country, billing_city, billing_province, billing_country,
        tags, note_attributes, discount_codes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderData.id,
      orderData.name || '',
      orderData.email || '',
      orderData.phone || '',
      orderData.created_at ? new Date(orderData.created_at) : null,
      orderData.updated_at ? new Date(orderData.updated_at) : null,
      orderData.processed_at ? new Date(orderData.processed_at) : null,
      orderData.cancelled_at ? new Date(orderData.cancelled_at) : null,
      orderData.closed_at ? new Date(orderData.closed_at) : null,
      orderData.total_price || '0.00',
      orderData.subtotal_price || '0.00',
      orderData.total_tax || '0.00',
      orderData.currency || 'USD',
      orderData.financial_status || '',
      orderData.fulfillment_status || '',
      orderData.gateway || '',
      orderData.test || false,
      orderData.order_number || null,
      orderData.fulfillments?.[0]?.location_id || null,
      orderData.fulfillments?.[0]?.name || null,
      orderData.customer?.first_name || '',
      orderData.customer?.last_name || '',
      orderData.shipping_address?.city || '',
      orderData.shipping_address?.province || '',
      orderData.shipping_address?.country || '',
      orderData.billing_address?.city || '',
      orderData.billing_address?.province || '',
      orderData.billing_address?.country || '',
      orderData.tags || '',
      JSON.stringify(orderData.note_attributes || []),
      JSON.stringify(orderData.discount_codes || [])
    ]);

    // Insert line items
    if (orderData.line_items && Array.isArray(orderData.line_items)) {
      for (const item of orderData.line_items) {
        await connection.execute(`
          INSERT INTO shopify_order_items (
            order_id, lineitem_id, lineitem_name, lineitem_sku, lineitem_title,
            lineitem_price, lineitem_quantity, lineitem_total, lineitem_vendor,
            lineitem_product_id, lineitem_variant_id, lineitem_variant_title,
            lineitem_fulfillment_service, lineitem_gift_card, lineitem_taxable
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderData.id,
          item.id,
          item.name || '',
          item.sku || '',
          item.title || '',
          item.price || '0.00',
          item.quantity || 0,
          (parseFloat(item.price || '0') * parseInt(item.quantity || '0')).toFixed(2),
          item.vendor || '',
          item.product_id || null,
          item.variant_id || null,
          item.variant_title || '',
          item.fulfillment_service || '',
          item.gift_card || false,
          item.taxable || false
        ]);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

// Force dynamic route to prevent caching issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get request body and headers
    const body = await request.text();
    const topic = request.headers.get('x-shopify-topic') || 'unknown';
    const signature = request.headers.get('x-shopify-hmac-sha256') || '';
    
    // Log the webhook receipt
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    console.log(`🔗 ${new Date().toISOString()} - Webhook received: ${topic} from ${clientIp}`);

    // Verify webhook signature
    const verificationResult = verifyWebhook(body, signature);
    if (!verificationResult.isValid) {
      console.log('❌ HMAC verification failed');
      console.log('Received HMAC:', signature);
      console.log('Tried secrets:', WEBHOOK_SECRETS.map(s => s.substring(0, 8) + '...'));
      
      await logWebhookEvent(topic, null, 'failed', `Invalid signature from ${clientIp}`, 'HMAC verification failed');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    console.log(`✅ HMAC verified with secret: ${verificationResult.secret}`);

    // Parse JSON payload
    let webhookData;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      await logWebhookEvent(topic, null, 'failed', 'JSON parse error', (parseError as Error).message);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const orderId = webhookData.id?.toString() || null;
    
    // Log webhook receipt
    await logWebhookEvent(topic, orderId, 'received', `Order #${webhookData.name || 'Unknown'}`);

    // Handle order-related webhooks
    if (topic.startsWith('orders/') && orderId) {
      // Check for duplicates
      if (await orderExists(orderId)) {
        await logWebhookEvent(topic, orderId, 'duplicate', `Order ${orderId} already processed`);
        return NextResponse.json({ 
          message: 'Order already processed', 
          orderId: orderId,
          timestamp: new Date().toISOString()
        }, { status: 200 });
      }

      // Process new order
      try {
        await processOrderData(webhookData);
        await logWebhookEvent(topic, orderId, 'processed', `Successfully processed order ${orderId}`);
        
        console.log(`✅ Successfully processed order ${orderId}`);
        
        return NextResponse.json({ 
          message: 'Webhook processed successfully', 
          orderId: orderId,
          timestamp: new Date().toISOString()
        }, { status: 200 });
      } catch (processError) {
        await logWebhookEvent(topic, orderId, 'failed', null, (processError as Error).message);
        throw processError;
      }
    } else {
      // Non-order webhooks
      await logWebhookEvent(topic, orderId, 'processed', `Webhook received: ${topic}`);
      return NextResponse.json({ 
        message: `Webhook ${topic} acknowledged`
      }, { status: 200 });
    }

  } catch (error) {
    console.error('❌ Webhook error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}