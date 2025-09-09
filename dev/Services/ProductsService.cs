using Dapper;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Services
{
    public class ProductsService
    {
        private readonly string _connectionString;
        private readonly IConnectionMultiplexer _redis;
        private readonly IDatabase _redisDb;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(30);

        public ProductsService(IConfiguration configuration, IConnectionMultiplexer redis)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _redis = redis;
            _redisDb = redis.GetDatabase();
        }

        public async Task<ProductsResponse> GetInitialDataAsync()
        {
            try
            {
                var cacheKey = "products_initial_data";
                var cachedData = await _redisDb.StringGetAsync(cacheKey);
                if (cachedData.HasValue)
                {
                    var cachedResponse = JsonSerializer.Deserialize<ProductsResponse>(cachedData!);
                    if (cachedResponse != null) return cachedResponse;
                }

                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Get available stores
                var storesQuery = @"
                    SELECT DISTINCT so.location 
                    FROM shopify_orders so 
                    WHERE so.location IS NOT NULL 
                      AND so.location != '' 
                      AND so.location != 'Hq Warehouse (1)'
                    ORDER BY so.location
                    LIMIT 100";

                var stores = (await connection.QueryAsync<string>(storesQuery)).ToList();

                // Get available vendors
                var vendorsQuery = @"
                    SELECT DISTINCT soi.vendor 
                    FROM shopify_order_items soi 
                    WHERE soi.vendor IS NOT NULL 
                      AND soi.vendor != ''
                    ORDER BY soi.vendor
                    LIMIT 100";

                var vendors = (await connection.QueryAsync<string>(vendorsQuery)).ToList();

                var response = new ProductsResponse
                {
                    Success = true,
                    AvailableStores = stores,
                    AvailableVendors = vendors,
                    Timestamp = DateTime.UtcNow
                };

                // Cache for 1 hour
                var serializedResponse = JsonSerializer.Serialize(response);
                await _redisDb.StringSetAsync(cacheKey, serializedResponse, TimeSpan.FromHours(1));

                return response;
            }
            catch (Exception ex)
            {
                return new ProductsResponse
                {
                    Success = false,
                    Error = $"Failed to fetch initial data: {ex.Message}",
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        public async Task<ProductsResponse> GetProductsDataAsync(string startDate, string endDate, 
            List<string> selectedStores, List<string> selectedVendors, int minQuantity = 1)
        {
            try
            {
                if (string.IsNullOrEmpty(startDate) || string.IsNullOrEmpty(endDate))
                {
                    return new ProductsResponse
                    {
                        Success = false,
                        Error = "Start date and end date are required",
                        Timestamp = DateTime.UtcNow
                    };
                }

                var cacheKey = $"products_data_{startDate}_{endDate}_{string.Join(",", selectedStores)}_{string.Join(",", selectedVendors)}_{minQuantity}";
                var cachedData = await _redisDb.StringGetAsync(cacheKey);
                if (cachedData.HasValue)
                {
                    var cachedResponse = JsonSerializer.Deserialize<ProductsResponse>(cachedData!);
                    if (cachedResponse != null) return cachedResponse;
                }

                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Get initial data for stores and vendors if not provided
                var initialData = await GetInitialDataAsync();
                var availableStores = initialData.AvailableStores;
                var availableVendors = initialData.AvailableVendors;

                // Limit selections for performance
                const int MAX_STORES = 10;
                const int MAX_VENDORS = 20;

                var storesToAnalyze = selectedStores?.Any() == true 
                    ? selectedStores.Take(MAX_STORES).ToList() 
                    : availableStores.Take(MAX_STORES).ToList();

                var vendorsToAnalyze = selectedVendors?.Any() == true 
                    ? selectedVendors.Take(MAX_VENDORS).ToList() 
                    : availableVendors.Take(MAX_VENDORS).ToList();

                if (!storesToAnalyze.Any() || !vendorsToAnalyze.Any())
                {
                    return new ProductsResponse
                    {
                        Success = true,
                        Summary = new ProductSummary(),
                        TopProducts = new List<Product>(),
                        BrandPerformance = new List<BrandPerformance>(),
                        AvailableStores = availableStores,
                        AvailableVendors = availableVendors,
                        Timestamp = DateTime.UtcNow
                    };
                }

                // Product performance query
                var productQuery = @"
                    SELECT 
                        soi.lineitem_sku as Sku, 
                        soi.lineitem_name as ProductName, 
                        soi.vendor as Vendor,
                        COUNT(*) as OrderCount,
                        SUM(soi.lineitem_quantity) as TotalQuantity,
                        SUM(soi.lineitem_quantity * soi.lineitem_price) as TotalRevenue,
                        AVG(soi.lineitem_price) as AvgPrice,
                        COUNT(DISTINCT so.location) as StoreCount,
                        COUNT(DISTINCT so.employee) as EmployeeCount
                    FROM shopify_order_items soi 
                    JOIN shopify_orders so ON soi.order_id = so.id 
                    WHERE DATE(so.created_at) BETWEEN @startDate AND @endDate
                      AND so.financial_status = 'paid' 
                      AND soi.lineitem_sku IS NOT NULL 
                      AND soi.lineitem_sku != ''
                      AND so.location IN @stores
                      AND soi.vendor IN @vendors
                    GROUP BY soi.lineitem_sku, soi.lineitem_name, soi.vendor
                    HAVING SUM(soi.lineitem_quantity) >= @minQuantity
                    ORDER BY TotalRevenue DESC
                    LIMIT 500";

                var parameters = new
                {
                    startDate,
                    endDate,
                    stores = storesToAnalyze,
                    vendors = vendorsToAnalyze,
                    minQuantity
                };

                var products = (await connection.QueryAsync<Product>(productQuery, parameters)).ToList();

                // Calculate summary metrics
                var totalProducts = products.Count;
                var totalRevenue = products.Sum(p => p.TotalRevenue);
                var totalUnits = products.Sum(p => p.TotalQuantity);
                var avgProductRevenue = totalProducts > 0 ? totalRevenue / totalProducts : 0;

                var summary = new ProductSummary
                {
                    TotalProducts = totalProducts,
                    TotalRevenue = totalRevenue,
                    TotalUnits = totalUnits,
                    AvgProductRevenue = avgProductRevenue
                };

                // Brand performance analysis
                var brandQuery = @"
                    SELECT 
                        soi.vendor as Vendor,
                        COUNT(*) as TotalOrders,
                        SUM(soi.lineitem_quantity) as TotalQuantity,
                        SUM(soi.lineitem_quantity * soi.lineitem_price) as TotalRevenue,
                        COUNT(DISTINCT soi.lineitem_sku) as ProductCount,
                        AVG(soi.lineitem_price) as AvgPrice
                    FROM shopify_order_items soi 
                    JOIN shopify_orders so ON soi.order_id = so.id 
                    WHERE DATE(so.created_at) BETWEEN @startDate AND @endDate
                      AND so.financial_status = 'paid' 
                      AND soi.lineitem_sku IS NOT NULL 
                      AND soi.lineitem_sku != ''
                      AND so.location IN @stores
                      AND soi.vendor IS NOT NULL 
                      AND soi.vendor != ''
                    GROUP BY soi.vendor
                    ORDER BY TotalRevenue DESC
                    LIMIT 50";

                var brandPerformance = (await connection.QueryAsync<BrandPerformance>(brandQuery, parameters)).ToList();

                var response = new ProductsResponse
                {
                    Success = true,
                    Summary = summary,
                    TopProducts = products.Take(100).ToList(),
                    BrandPerformance = brandPerformance,
                    AvailableStores = availableStores,
                    AvailableVendors = availableVendors,
                    Timestamp = DateTime.UtcNow
                };

                // Cache the response
                var serializedResponse = JsonSerializer.Serialize(response);
                await _redisDb.StringSetAsync(cacheKey, serializedResponse, _cacheExpiration);

                return response;
            }
            catch (Exception ex)
            {
                return new ProductsResponse
                {
                    Success = false,
                    Error = $"Failed to fetch products data: {ex.Message}",
                    Timestamp = DateTime.UtcNow
                };
            }
        }
    }
}