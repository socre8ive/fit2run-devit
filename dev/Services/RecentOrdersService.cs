using Dapper;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Services
{
    public class RecentOrdersService
    {
        private readonly string _connectionString;
        private readonly IConnectionMultiplexer _redis;
        private readonly IDatabase _redisDb;
        private readonly string _cacheKey = "recent_orders";
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(2); // 2-minute cache for recent orders

        public RecentOrdersService(IConfiguration configuration, IConnectionMultiplexer redis)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _redis = redis;
            _redisDb = redis.GetDatabase();
        }

        public async Task<RecentOrdersResponse> GetRecentOrdersAsync()
        {
            try
            {
                // Try to get from cache first
                var cachedData = await _redisDb.StringGetAsync(_cacheKey);
                if (cachedData.HasValue)
                {
                    var cachedResponse = JsonSerializer.Deserialize<RecentOrdersResponse>(cachedData!);
                    if (cachedResponse != null)
                    {
                        return cachedResponse;
                    }
                }

                // If not in cache, fetch from database
                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Get 30 most recent orders
                var ordersSql = @"
                    SELECT 
                        o.id as Id,
                        o.name as OrderNumber,
                        o.email as Email,
                        o.subtotal as Subtotal,
                        o.total as Total,
                        o.financial_status as FinancialStatus,
                        o.created_at as CreatedAt,
                        o.currency as Currency,
                        o.fulfillment_location_id as FulfillmentLocationId,
                        o.fulfillment_location_name as FulfillmentLocationName,
                        o.fulfillment_status as FulfillmentStatus
                    FROM shopify_orders o
                    ORDER BY o.created_at DESC
                    LIMIT 30";

                var orders = (await connection.QueryAsync<Models.Order>(ordersSql)).ToList();

                // Get line items for these orders
                if (orders.Any())
                {
                    var orderIds = orders.Select(o => o.Id).ToList();
                    var itemsSql = @"
                        SELECT 
                            order_id as OrderId,
                            lineitem_name as ProductName,
                            lineitem_sku as Sku,
                            lineitem_quantity as Quantity,
                            lineitem_price as Price
                        FROM shopify_order_items
                        WHERE order_id IN @OrderIds
                        ORDER BY order_id, id";

                    var allItems = await connection.QueryAsync<OrderItemWithOrderId>(itemsSql, new { OrderIds = orderIds });

                    // Group items by order
                    var itemsByOrder = allItems.GroupBy(i => i.OrderId).ToDictionary(g => g.Key, g => g.ToList());

                    // Attach items to orders
                    foreach (var order in orders)
                    {
                        if (itemsByOrder.TryGetValue(order.Id, out var orderItems))
                        {
                            order.Items = orderItems.Select(i => new OrderItem
                            {
                                ProductName = i.ProductName,
                                Sku = i.Sku,
                                Quantity = i.Quantity,
                                Price = i.Price
                            }).ToList();

                            order.ItemsSummary = string.Join(", ", order.Items.Select(i => $"{i.ProductName} (x{i.Quantity})"));
                        }
                        else
                        {
                            order.ItemsSummary = "No items";
                        }
                    }
                }

                var response = new RecentOrdersResponse
                {
                    Success = true,
                    Orders = orders,
                    Count = orders.Count,
                    Timestamp = DateTime.UtcNow
                };

                // Cache the response
                var serializedResponse = JsonSerializer.Serialize(response);
                await _redisDb.StringSetAsync(_cacheKey, serializedResponse, _cacheExpiration);

                return response;
            }
            catch (Exception ex)
            {
                return new RecentOrdersResponse
                {
                    Success = false,
                    Error = $"Failed to fetch recent orders: {ex.Message}",
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        public async Task<bool> ClearCacheAsync()
        {
            try
            {
                await _redisDb.KeyDeleteAsync(_cacheKey);
                return true;
            }
            catch
            {
                return false;
            }
        }
    }

    // Helper class for SQL mapping
    internal class OrderItemWithOrderId : OrderItem
    {
        public long OrderId { get; set; }
    }
}