using Dapper;
using Fit2RunDashboard.Models;
using MySqlConnector;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace Fit2RunDashboard.Services
{
    public class PerformanceService
    {
        private readonly IConfiguration _configuration;
        private readonly IDistributedCache _cache;
        private readonly ILogger<PerformanceService> _logger;
        private readonly string _connectionString;

        public PerformanceService(IConfiguration configuration, IDistributedCache cache, ILogger<PerformanceService> logger)
        {
            _configuration = configuration;
            _cache = cache;
            _logger = logger;
            _connectionString = _configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=localhost;Database=sales_data;Uid=fit2run;Pwd=Fit2Run1!;";
        }

        public async Task<PerformanceData> GetPerformanceDataAsync(PerformanceRequest request)
        {
            var cacheKey = $"performance_data_{request.StartDate:yyyyMMdd}_{request.EndDate:yyyyMMdd}_{request.Location}";
            
            var cachedData = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<PerformanceData>(cachedData) ?? new PerformanceData();
            }

            var performanceData = new PerformanceData();

            using var connection = new MySqlConnector.MySqlConnection(_connectionString);
            await connection.OpenAsync();

            // Build location filters
            var (locationFilter, locationParams) = BuildLocationFilter(request.Location);
            var baseParams = new List<object> { request.StartDate, request.EndDate };
            baseParams.AddRange(locationParams);

            try
            {
                // Get overall metrics
                performanceData.Metrics = await GetOverallMetricsAsync(connection, locationFilter, baseParams);

                // Get door count data for conversion rate
                var totalVisitors = await GetTotalVisitorsAsync(connection, request, locationFilter, locationParams);
                if (totalVisitors.HasValue && totalVisitors > 0)
                {
                    performanceData.Metrics.ConversionRate = Math.Round((decimal)performanceData.Metrics.TotalOrders / totalVisitors.Value * 100, 2);
                    performanceData.Metrics.RevenuePerVisitor = Math.Round(performanceData.Metrics.TotalRevenue / totalVisitors.Value, 2);
                }

                // Get store performance
                performanceData.StorePerformance = await GetStorePerformanceAsync(connection, request, locationFilter);

                // Get daily performance
                performanceData.DailyPerformance = await GetDailyPerformanceAsync(connection, locationFilter, baseParams, request);

                // Cache for 30 minutes
                var cacheOptions = new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
                };

                await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(performanceData), cacheOptions);

                _logger.LogInformation($"Performance data retrieved for {request.StartDate:yyyy-MM-dd} to {request.EndDate:yyyy-MM-dd}, location: {request.Location}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving performance data");
                throw;
            }

            return performanceData;
        }

        private async Task<PerformanceMetrics> GetOverallMetricsAsync(MySqlConnector.MySqlConnection connection, string locationFilter, List<object> baseParams)
        {
            var metricsQuery = $@"
                SELECT 
                    COUNT(*) as TotalOrders,
                    SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as TotalRevenue,
                    COUNT(DISTINCT email) as UniqueCustomers,
                    AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as AvgOrderValue
                FROM shopify_orders 
                WHERE created_at BETWEEN @StartDate AND @EndDate {locationFilter}";

            var parameters = new DynamicParameters();
            parameters.Add("StartDate", baseParams[0]);
            parameters.Add("EndDate", baseParams[1]);
            
            for (int i = 2; i < baseParams.Count; i++)
            {
                parameters.Add($"Param{i}", baseParams[i]);
            }

            var result = await connection.QueryFirstOrDefaultAsync<PerformanceMetrics>(metricsQuery, parameters);
            return result ?? new PerformanceMetrics();
        }

        private async Task<int?> GetTotalVisitorsAsync(MySqlConnector.MySqlConnection connection, PerformanceRequest request, string locationFilter, List<object> locationParams)
        {
            string doorCountQuery;
            var parameters = new DynamicParameters();
            parameters.Add("StartDate", request.StartDate);
            parameters.Add("EndDate", request.EndDate);

            if (request.Location != "all" && request.Location != "all_stores" && request.Location != "ecom")
            {
                doorCountQuery = @"
                    SELECT SUM(visitors) as TotalVisitors
                    FROM door_counts
                    WHERE DATE(datetime) BETWEEN DATE(@StartDate) AND DATE(@EndDate)
                        AND location = @Location";
                parameters.Add("Location", request.Location);
            }
            else
            {
                doorCountQuery = @"
                    SELECT SUM(visitors) as TotalVisitors
                    FROM door_counts
                    WHERE DATE(datetime) BETWEEN DATE(@StartDate) AND DATE(@EndDate)";
            }

            var result = await connection.QueryFirstOrDefaultAsync<int?>(doorCountQuery, parameters);
            return result;
        }

        private async Task<List<StorePerformance>> GetStorePerformanceAsync(MySqlConnector.MySqlConnection connection, PerformanceRequest request, string storeLocationFilter)
        {
            // Build store location filter
            var storeFilter = request.Location switch
            {
                "all_stores" => @"AND location IS NOT NULL AND location != '' 
                                 AND LOWER(location) NOT LIKE '%ecom%' 
                                 AND LOWER(location) NOT LIKE '%online%' 
                                 AND LOWER(location) NOT LIKE '%web%'",
                "ecom" => @"AND (LOWER(location) LIKE '%ecom%' 
                           OR LOWER(location) LIKE '%online%' 
                           OR LOWER(location) LIKE '%web%')",
                _ => "AND location IS NOT NULL AND location != ''"
            };

            var storeQuery = $@"
                SELECT 
                    location as Location,
                    COUNT(*) as TotalOrders,
                    SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as TotalRevenue,
                    COUNT(DISTINCT email) as UniqueCustomers,
                    AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as AvgOrderValue
                FROM shopify_orders 
                WHERE created_at BETWEEN @StartDate AND @EndDate {storeFilter}
                GROUP BY location
                ORDER BY TotalRevenue DESC";

            var parameters = new DynamicParameters();
            parameters.Add("StartDate", request.StartDate);
            parameters.Add("EndDate", request.EndDate);

            var storeData = (await connection.QueryAsync<StorePerformance>(storeQuery, parameters)).ToList();

            // Get door count data for each store
            var doorCountQuery = @"
                SELECT 
                    location as Location,
                    SUM(visitors) as TotalVisitors
                FROM door_counts
                WHERE DATE(datetime) BETWEEN DATE(@StartDate) AND DATE(@EndDate)
                GROUP BY location";

            var doorCountData = (await connection.QueryAsync<(string Location, int TotalVisitors)>(doorCountQuery, parameters)).ToList();

            // Create door count map with location mappings
            var doorCountMap = new Dictionary<string, int>();
            foreach (var dc in doorCountData)
            {
                var mappedLocation = dc.Location switch
                {
                    "mallgeorgia" => "mallofgeorgia",
                    "stpete" => "oldstpete",
                    _ => dc.Location
                };
                doorCountMap[mappedLocation] = dc.TotalVisitors;
                doorCountMap[dc.Location] = dc.TotalVisitors; // Also set original name
            }

            // Calculate conversion rates and revenue per visitor
            foreach (var store in storeData)
            {
                if (doorCountMap.TryGetValue(store.Location, out var visitors) && visitors > 0)
                {
                    store.TotalVisitors = visitors;
                    store.ConversionRate = Math.Round((decimal)store.TotalOrders / visitors * 100, 2);
                    store.RevenuePerVisitor = Math.Round(store.TotalRevenue / visitors, 2);
                }
            }

            return storeData;
        }

        private async Task<List<DailyPerformance>> GetDailyPerformanceAsync(MySqlConnector.MySqlConnection connection, string locationFilter, List<object> baseParams, PerformanceRequest request)
        {
            var dailyQuery = $@"
                SELECT 
                    DATE(created_at) as Date,
                    COUNT(*) as Orders,
                    SUM(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as Revenue,
                    COUNT(DISTINCT email) as UniqueCustomers,
                    AVG(CASE WHEN subtotal IS NOT NULL THEN subtotal ELSE 0 END) as AvgOrderValue
                FROM shopify_orders 
                WHERE created_at BETWEEN @StartDate AND @EndDate {locationFilter}
                GROUP BY DATE(created_at)
                ORDER BY Date";

            var parameters = new DynamicParameters();
            parameters.Add("StartDate", baseParams[0]);
            parameters.Add("EndDate", baseParams[1]);
            
            for (int i = 2; i < baseParams.Count; i++)
            {
                parameters.Add($"Param{i}", baseParams[i]);
            }

            var dailyData = (await connection.QueryAsync<DailyPerformance>(dailyQuery, parameters)).ToList();

            // Get daily door count data
            var doorCountParams = new DynamicParameters();
            doorCountParams.Add("StartDate", request.StartDate);
            doorCountParams.Add("EndDate", request.EndDate);
            
            string dailyDoorCountQuery;
            if (request.Location != "all" && request.Location != "all_stores" && request.Location != "ecom")
            {
                dailyDoorCountQuery = @"
                    SELECT 
                        DATE(datetime) as Date,
                        SUM(visitors) as TotalVisitors
                    FROM door_counts
                    WHERE DATE(datetime) BETWEEN DATE(@StartDate) AND DATE(@EndDate)
                        AND location = @Location
                    GROUP BY DATE(datetime)";
                doorCountParams.Add("Location", request.Location);
            }
            else
            {
                dailyDoorCountQuery = @"
                    SELECT 
                        DATE(datetime) as Date,
                        SUM(visitors) as TotalVisitors
                    FROM door_counts
                    WHERE DATE(datetime) BETWEEN DATE(@StartDate) AND DATE(@EndDate)
                    GROUP BY DATE(datetime)";
            }

            var dailyDoorCountData = (await connection.QueryAsync<(DateTime Date, int TotalVisitors)>(dailyDoorCountQuery, doorCountParams)).ToList();
            var dailyVisitorMap = dailyDoorCountData.ToDictionary(dv => dv.Date.Date, dv => dv.TotalVisitors);

            // Calculate conversion rates and revenue per visitor for daily data
            foreach (var day in dailyData)
            {
                if (dailyVisitorMap.TryGetValue(day.Date.Date, out var visitors) && visitors > 0)
                {
                    day.TotalVisitors = visitors;
                    day.ConversionRate = Math.Round((decimal)day.Orders / visitors * 100, 2);
                    day.RevenuePerVisitor = Math.Round(day.Revenue / visitors, 2);
                }
            }

            return dailyData;
        }

        private (string filter, List<object> parameters) BuildLocationFilter(string location)
        {
            return location switch
            {
                "all_stores" => (@"AND location IS NOT NULL AND location != '' 
                                  AND LOWER(location) NOT LIKE '%ecom%' 
                                  AND LOWER(location) NOT LIKE '%online%' 
                                  AND LOWER(location) NOT LIKE '%web%'", new List<object>()),
                "ecom" => (@"AND (LOWER(location) LIKE '%ecom%' 
                            OR LOWER(location) LIKE '%online%' 
                            OR LOWER(location) LIKE '%web%')", new List<object>()),
                "all" => ("", new List<object>()),
                _ => ("AND location = @Param2", new List<object> { location })
            };
        }
    }
}