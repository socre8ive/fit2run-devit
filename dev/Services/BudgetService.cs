using Dapper;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Services
{
    public class BudgetService
    {
        private readonly string _connectionString;
        private readonly IConnectionMultiplexer _redis;
        private readonly IDatabase _redisDb;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(30);

        public BudgetService(IConfiguration configuration, IConnectionMultiplexer redis)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _redis = redis;
            _redisDb = redis.GetDatabase();
        }

        public async Task<BudgetResponse> GetBudgetDataAsync(string location = "all", string period = "last4weeks")
        {
            try
            {
                // Disable caching temporarily for debugging
                // var cacheKey = $"budget_data_{location}_{period}";
                // var cachedData = await _redisDb.StringGetAsync(cacheKey);
                // if (cachedData.HasValue)
                // {
                //     var cachedResponse = JsonSerializer.Deserialize<BudgetResponse>(cachedData!);
                //     if (cachedResponse != null) return cachedResponse;
                // }

                // Get locations first with separate connection
                List<string> locations;
                using (var locConnection = new MySqlConnection(_connectionString))
                {
                    await locConnection.OpenAsync();
                    locations = await GetLocationsAsync(locConnection);
                }

                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Simple working queries
                var budgetQuery = @"
                    SELECT 
                        fb.forecast_date as ForecastDate,
                        COALESCE(SUM(fb.plan_2025), 0) as Budget2025,
                        COALESCE(SUM(f.net_sales), 0) as Actual2025
                    FROM forecast_budget_readonly fb
                    LEFT JOIN forecast f ON fb.forecast_date = f.forecast_date AND fb.location_name = f.location_name
                    WHERE fb.forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND fb.forecast_date <= CURDATE()
                    GROUP BY fb.forecast_date
                    ORDER BY fb.forecast_date ASC";

                var sales2024Query = @"
                    SELECT 
                        forecast_date as ForecastDate,
                        SUM(2024_Sales) as Daily2024Sales
                    FROM forecast_budget_readonly
                    WHERE forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND forecast_date <= CURDATE()
                    GROUP BY forecast_date
                    ORDER BY forecast_date ASC";

                // Execute queries (no parameters needed for hardcoded version)
                var budgetData = (await connection.QueryAsync<BudgetDataPoint>(budgetQuery)).ToList();
                var sales2024Data = (await connection.QueryAsync<Sales2024Point>(sales2024Query)).ToList();
                
                // Debug: Log query results
                Console.WriteLine($"Budget Query: {budgetQuery}");
                Console.WriteLine($"Budget Data Count: {budgetData.Count}");
                Console.WriteLine($"Sales2024 Data Count: {sales2024Data.Count}");
                if (budgetData.Any()) 
                {
                    Console.WriteLine($"First Budget Record: Date={budgetData[0].ForecastDate}, Budget={budgetData[0].Budget2025}, Actual={budgetData[0].Actual2025}");
                }

                // Create lookup for 2024 sales (handle potential duplicates)
                var sales2024Map = sales2024Data
                    .GroupBy(s => s.ForecastDate.ToString("yyyy-MM-dd"))
                    .ToDictionary(
                        g => g.Key, 
                        g => g.Sum(s => s.Daily2024Sales)
                    );

                // Merge data
                var chartData = budgetData.Select(b => new BudgetChartPoint
                {
                    Date = b.ForecastDate.ToString("MMM dd"),
                    Budget2024 = sales2024Map.GetValueOrDefault(b.ForecastDate.ToString("yyyy-MM-dd"), 0),
                    Budget2025 = b.Budget2025,
                    Actual2025 = b.Actual2025
                }).ToList();

                // Calculate summary
                var total2024Sales = chartData.Sum(c => c.Budget2024);
                var totalBudget2025 = chartData.Sum(c => c.Budget2025);
                var totalActual2025 = chartData.Sum(c => c.Actual2025);
                var variance = totalActual2025 - totalBudget2025;
                var variancePercent = totalBudget2025 > 0 ? (variance / totalBudget2025 * 100) : 0;
                var yearOverYearGrowth = total2024Sales > 0 ? ((totalActual2025 - total2024Sales) / total2024Sales * 100) : 0;

                // Get location performance (hardcoded version)
                var locationQuery = @"
                    SELECT 
                        fb.location_name as LocationName,
                        COALESCE(SUM(fb.plan_2025), 0) as Budget,
                        COALESCE(SUM(f.net_sales), 0) as Actual,
                        CASE 
                            WHEN SUM(fb.plan_2025) > 0 THEN ((SUM(f.net_sales) - SUM(fb.plan_2025)) / SUM(fb.plan_2025) * 100)
                            ELSE 0 
                        END as VariancePercent
                    FROM forecast_budget_readonly fb
                    LEFT JOIN forecast f ON fb.forecast_date = f.forecast_date AND fb.location_name = f.location_name
                    WHERE fb.forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND fb.forecast_date <= CURDATE()
                    GROUP BY fb.location_name
                    ORDER BY COALESCE(SUM(f.net_sales), 0) DESC";

                var locationData = (await connection.QueryAsync<LocationBudgetDataPoint>(locationQuery)).ToList();

                var response = new BudgetResponse
                {
                    Success = true,
                    Summary = new BudgetSummary
                    {
                        TotalBudget = totalBudget2025,
                        TotalActual = totalActual2025,
                        Total2024Sales = total2024Sales,
                        Variance = variance,
                        VariancePercent = variancePercent,
                        YearOverYearGrowth = yearOverYearGrowth
                    },
                    ChartData = chartData,
                    LocationData = locationData.Select(l => new LocationBudgetData
                    {
                        Location = l.LocationName,
                        Budget = l.Budget,
                        Actual = l.Actual,
                        VariancePercent = l.VariancePercent
                    }).ToList(),
                    Locations = locations,
                    Timestamp = DateTime.UtcNow
                };

                // Cache the response - disabled for debugging
                // var serializedResponse = JsonSerializer.Serialize(response);
                // await _redisDb.StringSetAsync(cacheKey, serializedResponse, _cacheExpiration);

                return response;
            }
            catch (Exception ex)
            {
                return new BudgetResponse
                {
                    Success = false,
                    Error = $"Failed to fetch budget data: {ex.Message}",
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        private async Task<List<string>> GetLocationsAsync(MySqlConnection connection)
        {
            var query = "SELECT DISTINCT location_name FROM forecast_budget_readonly ORDER BY location_name";
            var locations = await connection.QueryAsync<string>(query);
            return locations.ToList();
        }

        private string BuildDateFilter(string period, string tableAlias = "")
        {
            var prefix = string.IsNullOrEmpty(tableAlias) ? "" : $"{tableAlias}.";
            return period switch
            {
                "lastweek" => $"AND {prefix}forecast_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) + 1 DAY), INTERVAL 7 DAY) AND {prefix}forecast_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) + 1 DAY)",
                "last4weeks" => $"AND {prefix}forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND {prefix}forecast_date <= CURDATE()",
                "lastmonth" => $"AND {prefix}forecast_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND {prefix}forecast_date < DATE_FORMAT(CURDATE(), '%Y-%m-01')",
                _ => $"AND {prefix}forecast_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) AND {prefix}forecast_date <= CURDATE()"
            };
        }

        private string BuildLocationFilter(string location)
        {
            if (location == "all")
                return "";
            
            return "AND location_name = @location";
        }

    }

    // Helper classes for SQL mapping
    internal class BudgetDataPoint
    {
        public DateTime ForecastDate { get; set; }
        public decimal Budget2025 { get; set; }
        public decimal Actual2025 { get; set; }
    }

    internal class Sales2024Point
    {
        public DateTime ForecastDate { get; set; }
        public decimal Daily2024Sales { get; set; }
    }

    internal class LocationBudgetDataPoint
    {
        public string LocationName { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public decimal Actual { get; set; }
        public decimal VariancePercent { get; set; }
    }
}