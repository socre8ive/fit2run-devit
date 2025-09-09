using Dapper;
using Fit2RunDashboard.Models;
using MySqlConnector;

namespace Fit2RunDashboard.Services
{
    public class LYComparisonServiceDaily : ILYComparisonService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LYComparisonServiceDaily> _logger;

        public LYComparisonServiceDaily(
            IConfiguration configuration, 
            ILogger<LYComparisonServiceDaily> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<LYComparisonResponse> GetLYComparisonAsync(LYComparisonRequest request)
        {
            using var connection = new MySqlConnection(_configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            
            // Build store filter
            string storeFilter = "";
            if (!request.Stores.Contains("all_stores"))
            {
                var quotedStores = string.Join(",", request.Stores.Select(s => $"'{s.Replace("'", "''")}'"));
                storeFilter = $"AND o.location IN ({quotedStores})";
            }

            // Get daily sales for this year and last year for matching calendar dates
            var dailyQuery = $@"
                SELECT 
                    DATE(o.created_at) as date,
                    SUM(oi.lineitem_price * oi.lineitem_quantity) as dailySales,
                    COUNT(DISTINCT o.id) as dailyOrders,
                    YEAR(o.created_at) as salesYear
                FROM shopify_orders o
                JOIN shopify_order_items oi ON o.id = oi.order_id
                WHERE DATE(o.created_at) BETWEEN @StartDate AND @EndDate
                {storeFilter}
                GROUP BY DATE(o.created_at), YEAR(o.created_at)
                ORDER BY DATE(o.created_at)";

            var thisYearParams = new { StartDate = request.StartDate.ToString("yyyy-MM-dd"), EndDate = request.EndDate.ToString("yyyy-MM-dd") };
            var lastYearParams = new { StartDate = request.StartDate.AddYears(-1).ToString("yyyy-MM-dd"), EndDate = request.EndDate.AddYears(-1).ToString("yyyy-MM-dd") };

            // Get this year data
            var thisYearData = await connection.QueryAsync<dynamic>(dailyQuery, thisYearParams, commandTimeout: 60);
            var thisYearDict = thisYearData.ToDictionary(x => ((DateTime)x.date).ToString("MM-dd"), x => new { sales = (decimal)x.dailySales, orders = (int)x.dailyOrders });

            // Get last year data  
            var lastYearData = await connection.QueryAsync<dynamic>(dailyQuery, lastYearParams, commandTimeout: 60);
            var lastYearDict = lastYearData.ToDictionary(x => ((DateTime)x.date).ToString("MM-dd"), x => new { sales = (decimal)x.dailySales, orders = (int)x.dailyOrders });

            // Create daily comparison data
            var dailyComparisons = new List<DailyComparisonData>();
            var currentDate = request.StartDate;

            while (currentDate <= request.EndDate)
            {
                var dayKey = currentDate.ToString("MM-dd");
                
                var thisYear = thisYearDict.ContainsKey(dayKey) ? thisYearDict[dayKey] : new { sales = 0m, orders = 0 };
                var lastYear = lastYearDict.ContainsKey(dayKey) ? lastYearDict[dayKey] : new { sales = 0m, orders = 0 };

                var dollarChange = thisYear.sales - lastYear.sales;
                var percentageChange = lastYear.sales > 0 ? ((dollarChange / lastYear.sales) * 100) : 0;

                dailyComparisons.Add(new DailyComparisonData
                {
                    Date = DateOnly.FromDateTime(currentDate),
                    ThisYearSales = thisYear.sales,
                    LastYearSales = lastYear.sales,
                    ThisYearOrders = thisYear.orders,
                    LastYearOrders = lastYear.orders,
                    DollarChange = dollarChange,
                    PercentageChange = percentageChange
                });

                currentDate = currentDate.AddDays(1);
            }

            // Calculate summary
            var summary = new LYComparisonSummary
            {
                TotalThisYear = dailyComparisons.Sum(x => x.ThisYearSales),
                TotalLastYear = dailyComparisons.Sum(x => x.LastYearSales),
                TotalDollarChange = dailyComparisons.Sum(x => x.DollarChange),
                TotalUPCs = dailyComparisons.Count,
                PositiveUPCs = dailyComparisons.Count(x => x.PercentageChange > 0),
                NegativeUPCs = dailyComparisons.Count(x => x.PercentageChange < 0)
            };

            summary.TotalPercentageChange = summary.TotalLastYear > 0 
                ? ((summary.TotalDollarChange / summary.TotalLastYear) * 100) 
                : 0;

            var response = new LYComparisonResponse
            {
                Data = new List<LYComparisonData>(), // Empty for now, focusing on daily data
                DailyData = dailyComparisons,
                Summary = summary,
                DateRanges = new DateRange
                {
                    ThisYearStart = DateOnly.FromDateTime(request.StartDate),
                    ThisYearEnd = DateOnly.FromDateTime(request.EndDate),
                    LastYearStart = DateOnly.FromDateTime(request.StartDate.AddYears(-1)),
                    LastYearEnd = DateOnly.FromDateTime(request.EndDate.AddYears(-1))
                }
            };

            _logger.LogInformation("Daily LY Comparison completed: {Days} days compared, ${TotalThisYear:F2} vs ${TotalLastYear:F2}", 
                dailyComparisons.Count, summary.TotalThisYear, summary.TotalLastYear);

            return response;
        }

        public async Task<string[]> GetVendorsAsync()
        {
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
            return vendors.ToArray();
        }

        public async Task<string[]> GetCategoriesAsync()
        {
            using var connection = new MySqlConnection(_configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            
            var query = @"
                SELECT DISTINCT 
                    CASE 
                        WHEN c.Shopify_Class IN ('Performance', 'Trail', 'Racing', 'Speed', 'Lifestyle', 'Sandals', 'XC/Track') THEN 'Footwear'
                        WHEN c.Shopify_Class IN ('Tops', 'Bottoms', 'Bras', 'Outerwear') THEN 'Apparel'
                        WHEN c.Shopify_Class IN ('Socks', 'Headwear', 'Accessories') THEN 'Accessories'
                        ELSE 'Other'
                    END as category
                FROM fit2run_catalog c
                WHERE c.Shopify_Class IS NOT NULL 
                  AND c.Shopify_Class != ''
                ORDER BY category";

            var categories = await connection.QueryAsync<string>(query);
            return categories.Where(c => c != "Other").ToArray();
        }
    }
}