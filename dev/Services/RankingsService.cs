using Dapper;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Services
{
    public class RankingsService
    {
        private readonly string _connectionString;
        private readonly IConnectionMultiplexer _redis;
        private readonly IDatabase _redisDb;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(30);

        public RankingsService(IConfiguration configuration, IConnectionMultiplexer redis)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _redis = redis;
            _redisDb = redis.GetDatabase();
        }

        public async Task<RankingsResponse> GetRankingsDataAsync(string startDate, string endDate, int minVisitors = 100, int minOrders = 5)
        {
            try
            {
                if (string.IsNullOrEmpty(startDate) || string.IsNullOrEmpty(endDate))
                {
                    return new RankingsResponse
                    {
                        Success = false,
                        Error = "Start date and end date are required",
                        Timestamp = DateTime.UtcNow
                    };
                }

                var cacheKey = $"rankings_data_{startDate}_{endDate}_{minVisitors}_{minOrders}";
                var cachedData = await _redisDb.StringGetAsync(cacheKey);
                if (cachedData.HasValue)
                {
                    var cachedResponse = JsonSerializer.Deserialize<RankingsResponse>(cachedData!);
                    if (cachedResponse != null) return cachedResponse;
                }

                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Get visitor data from door_counts
                var visitorsQuery = @"
                    SELECT 
                        location,
                        DATE(datetime) AS date,
                        SUM(visitors) AS visitors
                    FROM door_counts 
                    WHERE DATE(datetime) BETWEEN @startDate AND @endDate
                      AND location != 'Hq Warehouse (1)'
                      AND location IS NOT NULL
                    GROUP BY location, DATE(datetime)";

                var visitorData = await connection.QueryAsync<VisitorDataPoint>(visitorsQuery, new { startDate, endDate });

                // Get sales data from shopify_orders
                var salesQuery = @"
                    SELECT 
                        so.location,
                        DATE(so.created_at) AS date,
                        COUNT(*) AS transactions,
                        SUM(so.subtotal) AS revenue,
                        AVG(so.subtotal) AS avg_transaction_value,
                        COUNT(DISTINCT so.employee) AS employees_working,
                        COUNT(DISTINCT so.email) AS unique_customers
                    FROM shopify_orders so
                    WHERE DATE(so.created_at) BETWEEN @startDate AND @endDate
                      AND so.financial_status = 'paid'
                      AND so.location IS NOT NULL
                      AND so.location != ''
                      AND so.location != 'Hq Warehouse (1)'
                    GROUP BY so.location, DATE(so.created_at)";

                var salesData = await connection.QueryAsync<SalesDataPoint>(salesQuery, new { startDate, endDate });

                // Merge visitor and sales data
                var mergedData = new Dictionary<string, MergedDataPoint>();

                // Process visitor data
                foreach (var visitor in visitorData)
                {
                    var key = $"{visitor.Location}-{visitor.Date:yyyy-MM-dd}";
                    if (!mergedData.ContainsKey(key))
                    {
                        mergedData[key] = new MergedDataPoint
                        {
                            Location = visitor.Location,
                            Date = visitor.Date
                        };
                    }
                    mergedData[key].Visitors += visitor.Visitors;
                }

                // Process sales data
                foreach (var sales in salesData)
                {
                    var key = $"{sales.Location}-{sales.Date:yyyy-MM-dd}";
                    if (!mergedData.ContainsKey(key))
                    {
                        mergedData[key] = new MergedDataPoint
                        {
                            Location = sales.Location,
                            Date = sales.Date
                        };
                    }
                    var record = mergedData[key];
                    record.Transactions += sales.Transactions;
                    record.Revenue += sales.Revenue;
                    record.AvgTransactionValue = sales.AvgTransactionValue;
                    record.UniqueCustomers += sales.UniqueCustomers;
                }

                // Aggregate by store location
                var storeAggregates = new Dictionary<string, StoreAggregate>();
                foreach (var record in mergedData.Values)
                {
                    if (!storeAggregates.ContainsKey(record.Location))
                    {
                        storeAggregates[record.Location] = new StoreAggregate
                        {
                            Location = record.Location
                        };
                    }
                    
                    var store = storeAggregates[record.Location];
                    store.Visitors += record.Visitors;
                    store.Transactions += record.Transactions;
                    store.Revenue += record.Revenue;
                    store.UniqueCustomers += record.UniqueCustomers;
                    
                    if (record.Transactions > 0 || record.Visitors > 0)
                    {
                        store.DaysActive += 1;
                    }
                    
                    if (record.AvgTransactionValue > 0)
                    {
                        store.TotalAvgTransaction += record.AvgTransactionValue;
                        store.TransactionCount += 1;
                    }
                }

                // Calculate metrics for each store - ONLY REAL DATA
                var stores = storeAggregates.Values
                    .Where(store => store.Visitors > 0) // ONLY include stores with ACTUAL visitor data
                    .Select(store => new StoreRanking
                    {
                        Location = store.Location,
                        Visitors = store.Visitors,
                        Transactions = store.Transactions,
                        Revenue = store.Revenue,
                        UniqueCustomers = store.UniqueCustomers,
                        DaysActive = store.DaysActive,
                        AvgTransactionValue = store.Transactions > 0 ? store.Revenue / store.Transactions : 0,
                        ConversionRate = store.Visitors > 0 ? (decimal)store.Transactions / store.Visitors : 0,
                        RevenuePerVisitor = store.Visitors > 0 ? store.Revenue / store.Visitors : 0,
                        CustomersPerDay = store.DaysActive > 0 ? (decimal)store.UniqueCustomers / store.DaysActive : 0,
                        RevenuePerDay = store.DaysActive > 0 ? store.Revenue / store.DaysActive : 0,
                        TransactionsPerDay = store.DaysActive > 0 ? (decimal)store.Transactions / store.DaysActive : 0
                    })
                    .Where(store => store.Visitors >= minVisitors && store.Transactions >= minOrders)
                    .ToList();

                if (stores.Count == 0)
                {
                    return new RankingsResponse
                    {
                        Success = true,
                        Rankings = new List<StoreRanking>(),
                        ChartData = new RankingsChartData(),
                        Summary = new RankingsSummary(),
                        Timestamp = DateTime.UtcNow
                    };
                }

                // Calculate rankings for each metric
                var sortedByConversion = stores.OrderByDescending(s => s.ConversionRate).ToList();
                var sortedByRevenuePerVisitor = stores.OrderByDescending(s => s.RevenuePerVisitor).ToList();
                var sortedByTotalRevenue = stores.OrderByDescending(s => s.Revenue).ToList();
                var sortedByAvgTransaction = stores.OrderByDescending(s => s.AvgTransactionValue).ToList();

                // Assign ranks and calculate efficiency score
                foreach (var store in stores)
                {
                    store.ConversionRank = sortedByConversion.FindIndex(s => s.Location == store.Location) + 1;
                    store.RevenuePerVisitorRank = sortedByRevenuePerVisitor.FindIndex(s => s.Location == store.Location) + 1;
                    store.TotalRevenueRank = sortedByTotalRevenue.FindIndex(s => s.Location == store.Location) + 1;
                    store.AvgTransactionRank = sortedByAvgTransaction.FindIndex(s => s.Location == store.Location) + 1;
                    
                    store.EfficiencyScore = (store.ConversionRank + store.RevenuePerVisitorRank + 
                                           store.TotalRevenueRank + store.AvgTransactionRank) / 4.0m;
                }

                // Sort by efficiency score (best performers first)
                var rankedStores = stores.OrderBy(s => s.EfficiencyScore).ToList();

                // Calculate date range
                var startDateObj = DateTime.Parse(startDate);
                var endDateObj = DateTime.Parse(endDate);
                var daysDiff = (endDateObj - startDateObj).Days + 1;

                // No chart data needed
                var chartData = new RankingsChartData();

                var response = new RankingsResponse
                {
                    Success = true,
                    Rankings = rankedStores,
                    ChartData = chartData,
                    Summary = new RankingsSummary
                    {
                        TotalStores = rankedStores.Count,
                        TotalVisitors = rankedStores.Sum(s => s.Visitors),
                        TotalRevenue = rankedStores.Sum(s => s.Revenue),
                        DateRangeDays = daysDiff
                    },
                    Timestamp = DateTime.UtcNow
                };

                // Cache the response
                var serializedResponse = JsonSerializer.Serialize(response);
                await _redisDb.StringSetAsync(cacheKey, serializedResponse, _cacheExpiration);

                return response;
            }
            catch (Exception ex)
            {
                return new RankingsResponse
                {
                    Success = false,
                    Error = $"Failed to fetch rankings data: {ex.Message}",
                    Timestamp = DateTime.UtcNow
                };
            }
        }
    }

    // Helper classes for SQL mapping
    internal class VisitorDataPoint
    {
        public string Location { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public int Visitors { get; set; }
    }

    internal class SalesDataPoint
    {
        public string Location { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public int Transactions { get; set; }
        public decimal Revenue { get; set; }
        public decimal AvgTransactionValue { get; set; }
        public int EmployeesWorking { get; set; }
        public int UniqueCustomers { get; set; }
    }

    internal class MergedDataPoint
    {
        public string Location { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public int Visitors { get; set; }
        public int Transactions { get; set; }
        public decimal Revenue { get; set; }
        public decimal AvgTransactionValue { get; set; }
        public int UniqueCustomers { get; set; }
    }

    internal class StoreAggregate
    {
        public string Location { get; set; } = string.Empty;
        public int Visitors { get; set; }
        public int Transactions { get; set; }
        public decimal Revenue { get; set; }
        public int UniqueCustomers { get; set; }
        public int DaysActive { get; set; }
        public decimal TotalAvgTransaction { get; set; }
        public int TransactionCount { get; set; }
    }
}