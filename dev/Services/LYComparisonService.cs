using Dapper;
using Fit2RunDashboard.Models;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;

namespace Fit2RunDashboard.Services
{
    public interface ILYComparisonService
    {
        Task<LYComparisonResponse> GetLYComparisonAsync(LYComparisonRequest request);
        Task<string[]> GetVendorsAsync();
        Task<string[]> GetCategoriesAsync();
    }

    public class LYComparisonService : ILYComparisonService
    {
        private readonly IConfiguration _configuration;
        private readonly IConnectionMultiplexer _redis;
        private readonly ILogger<LYComparisonService> _logger;

        public LYComparisonService(
            IConfiguration configuration, 
            IConnectionMultiplexer redis, 
            ILogger<LYComparisonService> logger)
        {
            _configuration = configuration;
            _redis = redis;
            _logger = logger;
        }

        public async Task<LYComparisonResponse> GetLYComparisonAsync(LYComparisonRequest request)
        {
            var cacheKey = $"ly-comparison:{request.StartDate:yyyy-MM-dd}:{request.EndDate:yyyy-MM-dd}:{string.Join(",", request.Stores)}:{request.Category}:{request.Vendor}:{request.MatchType}";
            
            // Try Redis cache first
            var database = _redis.GetDatabase();
            var cachedResult = await database.StringGetAsync(cacheKey);
            
            if (cachedResult.HasValue)
            {
                _logger.LogInformation("Cache hit for LY comparison: {CacheKey}", cacheKey);
                var cached = JsonSerializer.Deserialize<LYComparisonResponse>(cachedResult!)!;
                return cached;
            }

            _logger.LogInformation("Cache miss for LY comparison: {CacheKey}", cacheKey);
            
            // Calculate date ranges
            var lastYearStart = request.StartDate.AddYears(-1);
            var lastYearEnd = request.EndDate.AddYears(-1);

            using var connection = new MySqlConnection(_configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            
            // Build dynamic filters
            string storeFilter;
            if (request.Stores.Contains("all_stores"))
            {
                storeFilter = "";
            }
            else
            {
                var quotedStores = string.Join(",", request.Stores.Select(s => $"'{s.Replace("'", "''")}'"));
                storeFilter = $"AND o.location IN ({quotedStores})";
            }

            var categoryFilter = request.Category switch
            {
                "footwear" => "AND c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track')",
                "apparel" => "AND c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear')",
                "accessories" => "AND c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories', 'Compression', 'Hydration', 'Nutrition', 'Injury/Recovery', 'Bags/Belts', 'Insoles/Orthotics', 'GPS', 'Sunglasses', 'Electronic Accessories', 'Fitness', 'Safety', 'Jewelry', 'Skin Care', 'Headphones', 'Strollers', 'Laces/Spikes', 'GPS/HRM', 'Watches', 'Laces', 'Bike Accessories', 'Parts', 'Bags', 'Sunlasses', 'Foam Rollers', 'Rain Gear')",
                _ => ""
            };

            var vendorFilter = request.Vendor != "all" 
                ? $"AND c.Vendor = '{request.Vendor.Replace("'", "''")}'"
                : "";

            var matchTypeFilter = request.MatchType == "matches" 
                ? "AND final_results.thisYearSales > 0 AND final_results.lastYearSales > 0" 
                : "";

            // Simple query that will work with proper column mapping
            var query = $@"
                SELECT 
                  c.CLU as Upc,
                  COALESCE(NULLIF(oi.lineitem_name, ''), NULLIF(c.Description, '')) as ProductName,
                  c.Vendor as Vendor,
                  CASE 
                    WHEN c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track') THEN 'Footwear'
                    WHEN c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear') THEN 'Apparel'
                    WHEN c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories', 'Compression', 'Hydration', 'Nutrition', 'Injury/Recovery', 'Bags/Belts', 'Insoles/Orthotics', 'GPS', 'Sunglasses', 'Electronic Accessories', 'Fitness', 'Safety', 'Jewelry', 'Skin Care', 'Headphones', 'Strollers', 'Laces/Spikes', 'GPS/HRM', 'Watches', 'Laces', 'Bike Accessories', 'Parts', 'Bags', 'Sunlasses', 'Foam Rollers', 'Rain Gear') THEN 'Accessories'
                    WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Footwear' THEN 'Footwear'
                    WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Apparel' THEN 'Apparel'
                    WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Accessories' THEN 'Accessories'
                    ELSE 'Other'
                  END as Category,
                  SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                      THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) as ThisYearSales,
                  SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                      THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) as LastYearSales,
                  SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                      THEN oi.lineitem_quantity ELSE 0 END) as ThisYearUnits,
                  SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                      THEN oi.lineitem_quantity ELSE 0 END) as LastYearUnits,
                  CASE 
                    WHEN SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                             THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) = 0 THEN 
                      CASE WHEN SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                                   THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) > 0 THEN 100 ELSE 0 END
                    ELSE 
                      ((SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                            THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) - 
                        SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                            THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END)) / 
                       SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                           THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END)) * 100 
                  END as PercentageChange,
                  (SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                       THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) - 
                   SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                       THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END)) as DollarChange
                FROM shopify_orders o
                JOIN shopify_order_items oi ON o.id = oi.order_id
                JOIN fit2run_catalog c ON oi.lineitem_sku = c.CLU
                WHERE (DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd
                   OR DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd)
                {storeFilter}
                {categoryFilter}
                {vendorFilter}
                AND c.CLU IS NOT NULL AND c.CLU != ''
                AND c.Description IS NOT NULL
                AND c.Vendor IS NOT NULL AND c.Vendor != '' AND c.Vendor != 'Unknown Vendor'
                GROUP BY c.CLU, ProductName, c.Vendor, Category
                HAVING (ThisYearSales > 0 OR LastYearSales > 0)
                ORDER BY ABS(DollarChange) DESC
                LIMIT 200";

            var parameters = new
            {
                ThisYearStart = request.StartDate.ToString("yyyy-MM-dd"),
                ThisYearEnd = request.EndDate.ToString("yyyy-MM-dd"),
                LastYearStart = lastYearStart.ToString("yyyy-MM-dd"),
                LastYearEnd = lastYearEnd.ToString("yyyy-MM-dd")
            };

            _logger.LogInformation("Executing LY comparison query with parameters: {@Parameters}", parameters);

            var data = await connection.QueryAsync<LYComparisonData>(query, parameters, commandTimeout: 300); // 5 minute timeout
            var dataList = data.ToList();

            // Calculate summary
            var summary = new LYComparisonSummary
            {
                TotalThisYear = dataList.Sum(x => x.ThisYearSales),
                TotalLastYear = dataList.Sum(x => x.LastYearSales),
                TotalUPCs = dataList.Count,
                PositiveUPCs = dataList.Count(x => x.PercentageChange > 0),
                NegativeUPCs = dataList.Count(x => x.PercentageChange < 0)
            };
            
            summary.TotalPercentageChange = summary.TotalLastYear > 0 
                ? ((summary.TotalThisYear - summary.TotalLastYear) / summary.TotalLastYear) * 100 
                : 0;
            summary.TotalDollarChange = summary.TotalThisYear - summary.TotalLastYear;

            // Calculate brand summary if a specific vendor is selected
            BrandSummary? brandSummary = null;
            if (request.Vendor != "all" && !string.IsNullOrEmpty(request.Vendor))
            {
                brandSummary = new BrandSummary
                {
                    Brand = request.Vendor,
                    Category = request.Category == "all" ? "All Categories" : 
                              request.Category == "footwear" ? "Footwear" : 
                              request.Category == "apparel" ? "Apparel" : 
                              request.Category == "accessories" ? "Accessories" : request.Category,
                    ThisYearSales = dataList.Sum(x => x.ThisYearSales),
                    LastYearSales = dataList.Sum(x => x.LastYearSales),
                    ThisYearUnits = dataList.Sum(x => x.ThisYearUnits),
                    LastYearUnits = dataList.Sum(x => x.LastYearUnits),
                    UniqueProducts = dataList.Count
                };
                
                brandSummary.DollarChange = brandSummary.ThisYearSales - brandSummary.LastYearSales;
                brandSummary.PercentageChange = brandSummary.LastYearSales > 0 
                    ? ((brandSummary.ThisYearSales - brandSummary.LastYearSales) / brandSummary.LastYearSales) * 100 
                    : (brandSummary.ThisYearSales > 0 ? 100 : 0);
            }

            var response = new LYComparisonResponse
            {
                Data = dataList,
                Summary = summary,
                BrandSummary = brandSummary,
                DateRanges = new DateRange
                {
                    ThisYearStart = DateOnly.FromDateTime(request.StartDate),
                    ThisYearEnd = DateOnly.FromDateTime(request.EndDate),
                    LastYearStart = DateOnly.FromDateTime(lastYearStart),
                    LastYearEnd = DateOnly.FromDateTime(lastYearEnd)
                }
            };

            // Cache for 30 minutes
            await database.StringSetAsync(cacheKey, JsonSerializer.Serialize(response), TimeSpan.FromMinutes(30));
            _logger.LogInformation("Cached LY comparison result: {CacheKey}", cacheKey);

            return response;
        }

        public async Task<string[]> GetVendorsAsync()
        {
            var cacheKey = "ly-comparison-vendors";
            
            // Try Redis cache first
            var database = _redis.GetDatabase();
            var cachedResult = await database.StringGetAsync(cacheKey);
            
            if (cachedResult.HasValue)
            {
                return JsonSerializer.Deserialize<string[]>(cachedResult!)!;
            }

            using var connection = new MySqlConnection(_configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            
            var query = @"
                SELECT DISTINCT c.Vendor as vendor
                FROM fit2run_catalog c
                WHERE c.Vendor IS NOT NULL 
                  AND c.Vendor != '' 
                  AND c.Vendor != 'Unknown Vendor'
                ORDER BY c.Vendor";

            var vendors = await connection.QueryAsync<string>(query);
            var vendorArray = vendors.ToArray();

            // Cache for 24 hours
            await database.StringSetAsync(cacheKey, JsonSerializer.Serialize(vendorArray), TimeSpan.FromHours(24));

            return vendorArray;
        }

        public async Task<string[]> GetCategoriesAsync()
        {
            var cacheKey = "ly-comparison-categories";
            
            // Try Redis cache first
            var database = _redis.GetDatabase();
            var cachedResult = await database.StringGetAsync(cacheKey);
            
            if (cachedResult.HasValue)
            {
                return JsonSerializer.Deserialize<string[]>(cachedResult!)!;
            }

            using var connection = new MySqlConnection(_configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            
            var query = @"
                SELECT DISTINCT 
                    CASE 
                        WHEN c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track') THEN 'Footwear'
                        WHEN c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear') THEN 'Apparel'
                        WHEN c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories', 'Compression', 'Hydration', 'Nutrition', 'Injury/Recovery', 'Bags/Belts', 'Insoles/Orthotics', 'GPS', 'Sunglasses', 'Electronic Accessories', 'Fitness', 'Safety', 'Jewelry', 'Skin Care', 'Headphones', 'Strollers', 'Laces/Spikes', 'GPS/HRM', 'Watches', 'Laces', 'Bike Accessories', 'Parts', 'Bags', 'Sunlasses', 'Foam Rollers', 'Rain Gear') THEN 'Accessories'
                        WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Footwear' THEN 'Footwear'
                        WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Apparel' THEN 'Apparel'
                        WHEN c.Shopify_Class IS NULL AND c.Shopify_Dept = 'Accessories' THEN 'Accessories'
                        ELSE 'Other'
                    END as category
                FROM fit2run_catalog c
                WHERE (c.Shopify_Class IS NOT NULL AND c.Shopify_Class != '')
                   OR (c.Shopify_Class IS NULL AND c.Shopify_Dept IS NOT NULL)
                ORDER BY category";

            var categories = await connection.QueryAsync<string>(query);
            var categoryArray = categories.Where(c => c != "Other").ToArray();

            // Cache for 24 hours
            await database.StringSetAsync(cacheKey, JsonSerializer.Serialize(categoryArray), TimeSpan.FromHours(24));

            return categoryArray;
        }
    }
}