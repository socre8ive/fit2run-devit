using Dapper;
using Fit2RunDashboard.Models;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;

namespace Fit2RunDashboard.Services
{
    public class LYComparisonServiceSimple : ILYComparisonService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LYComparisonServiceSimple> _logger;

        public LYComparisonServiceSimple(
            IConfiguration configuration, 
            ILogger<LYComparisonServiceSimple> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<LYComparisonResponse> GetLYComparisonAsync(LYComparisonRequest request)
        {
            // Calculate date ranges
            var lastYearStart = request.StartDate.AddYears(-1);
            var lastYearEnd = request.EndDate.AddYears(-1);

            using var connection = new MySqlConnection(_configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            
            // Build store filter
            string storeFilter = "";
            if (!request.Stores.Contains("all_stores"))
            {
                var quotedStores = string.Join(",", request.Stores.Select(s => $"'{s.Replace("'", "''")}'"));
                storeFilter = $"AND o.location IN ({quotedStores})";
            }

            // Daily comparison - each day vs same day last year
            var query = $@"
                SELECT 
                    DATE(o.created_at) as date,
                    SUM(oi.lineitem_price * oi.lineitem_quantity) as dailySales,
                    COUNT(DISTINCT o.id) as dailyOrders,
                    SUM(oi.lineitem_quantity) as dailyUnits,
                    YEAR(o.created_at) as salesYear
                FROM shopify_orders o
                JOIN shopify_order_items oi ON o.id = oi.order_id
                WHERE (DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd
                   OR DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd)
                {storeFilter}
                GROUP BY DATE(o.created_at), YEAR(o.created_at)
                ORDER BY DATE(o.created_at)";

            var parameters = new
            {
                ThisYearStart = request.StartDate.ToString("yyyy-MM-dd"),
                ThisYearEnd = request.EndDate.ToString("yyyy-MM-dd"),
                LastYearStart = lastYearStart.ToString("yyyy-MM-dd"),
                LastYearEnd = lastYearEnd.ToString("yyyy-MM-dd")
            };

            _logger.LogInformation("Executing simple LY comparison query");

            var data = await connection.QueryAsync<LYComparisonData>(query, parameters, commandTimeout: 60);
            var dataList = data.ToList();

            // Calculate percentage and dollar changes for each UPC
            foreach (var item in dataList)
            {
                item.PercentageChange = item.LastYearSales > 0 
                    ? ((item.ThisYearSales - item.LastYearSales) / item.LastYearSales) * 100 
                    : (item.ThisYearSales > 0 ? 100 : 0);
                item.DollarChange = item.ThisYearSales - item.LastYearSales;
            }

            // Calculate summary from UPC-level data
            var summaryObj = new LYComparisonSummary
            {
                TotalThisYear = dataList.Sum(x => x.ThisYearSales),
                TotalLastYear = dataList.Sum(x => x.LastYearSales),
                TotalUPCs = dataList.Count,
                PositiveUPCs = dataList.Count(x => x.PercentageChange > 0),
                NegativeUPCs = dataList.Count(x => x.PercentageChange < 0)
            };
            
            summaryObj.TotalPercentageChange = summaryObj.TotalLastYear > 0 
                ? ((summaryObj.TotalThisYear - summaryObj.TotalLastYear) / summaryObj.TotalLastYear) * 100 
                : 0;
            summaryObj.TotalDollarChange = summaryObj.TotalThisYear - summaryObj.TotalLastYear;

            var response = new LYComparisonResponse
            {
                Data = dataList,
                Summary = summaryObj,
                DateRanges = new DateRange
                {
                    ThisYearStart = DateOnly.FromDateTime(request.StartDate),
                    ThisYearEnd = DateOnly.FromDateTime(request.EndDate),
                    LastYearStart = DateOnly.FromDateTime(lastYearStart),
                    LastYearEnd = DateOnly.FromDateTime(lastYearEnd)
                }
            };

            _logger.LogInformation("Simple LY Comparison completed: ${TotalThisYear:F2} this year vs ${TotalLastYear:F2} last year", 
                response.Summary.TotalThisYear, response.Summary.TotalLastYear);

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