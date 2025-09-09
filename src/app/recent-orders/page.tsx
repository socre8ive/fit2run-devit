'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface OrderItem {
  product_name: string;
  sku: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  order_number: string;
  email: string;
  subtotal: number;
  total: number;
  financial_status: string;
  created_at: string;
  currency: string;
  items: OrderItem[];
  items_summary: string;
  fulfillment_location_id: number | null;
  fulfillment_location_name: string | null;
  fulfillment_status: string | null;
}

export default function RecentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const router = useRouter();

  const fetchOrders = async () => {
    try {
      // Add cache-busting parameter and headers to ensure fresh data
      const cacheBuster = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const response = await fetch(`/api/recent-orders?t=${cacheBuster}&rid=${randomId}`, {
        cache: 'no-store',
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.orders);
        setLastRefresh(new Date().toLocaleTimeString());
        setError('');
      } else {
        setError(data.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Auto-refresh every 30 seconds if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchOrders, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatDate = (dateString: string) => {
    // The date from database is in UTC, convert to Eastern Time
    // Manual formatting to avoid system timezone issues
    const date = new Date(dateString);
    
    // Get UTC components
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcDay = date.getUTCDate();
    const utcMonth = date.getUTCMonth();
    const utcYear = date.getUTCFullYear();
    
    // Apply EST offset (UTC-5) - system seems to be using EST even in September
    let edtHours = utcHours - 5;
    let edtDay = utcDay;
    let edtMonth = utcMonth;
    let edtYear = utcYear;
    
    // Handle day rollback if hours go negative
    if (edtHours < 0) {
      edtHours += 24;
      edtDay -= 1;
      // Handle month/year rollback if needed
      if (edtDay === 0) {
        edtMonth -= 1;
        if (edtMonth < 0) {
          edtMonth = 11;
          edtYear -= 1;
        }
        // Get last day of previous month
        edtDay = new Date(edtYear, edtMonth + 1, 0).getDate();
      }
    }
    
    // Format time
    const period = edtHours >= 12 ? 'PM' : 'AM';
    const displayHours = edtHours === 0 ? 12 : edtHours > 12 ? edtHours - 12 : edtHours;
    const displayMinutes = utcMinutes.toString().padStart(2, '0');
    
    // Format month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[edtMonth];
    
    return `${monthName} ${edtDay}, ${edtYear}, ${displayHours.toString().padStart(2, '0')}:${displayMinutes} ${period}`;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'paid': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'refunded': 'bg-red-100 text-red-800',
      'voided': 'bg-gray-100 text-gray-800',
      'authorized': 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading recent orders...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg mb-6 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Recent Orders</h1>
              <p className="text-gray-600 mt-1">Last 30 orders from Shopify</p>
              {lastRefresh && (
                <p className="text-xs text-gray-500 mt-1">Last updated: {lastRefresh}</p>
              )}
            </div>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Auto-refresh (30s)</span>
              </label>
              <button
                onClick={fetchOrders}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Now
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items Purchased
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subtotal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fulfillment Location
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.order_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {order.id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {order.items_summary}
                        </div>
                        {order.items.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''} total
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(order.subtotal, order.currency)}
                        </div>
                        {order.total !== order.subtotal && (
                          <div className="text-xs text-gray-500">
                            Total: {formatCurrency(order.total, order.currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.fulfillment_location_name || 
                           (order.fulfillment_location_id ? `Location ${order.fulfillment_location_id}` : 
                            <span className="text-gray-400 italic">Not fulfilled</span>)}
                        </div>
                        {order.fulfillment_status && (
                          <div className="text-xs text-gray-500">
                            {order.fulfillment_status}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer */}
          {orders.length > 0 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {orders.length} most recent orders
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}