using Dapper;
using Fit2RunDashboard.Models;
using MySqlConnector;

namespace Fit2RunDashboard.Services
{
    public class LYComparisonServiceFixed : ILYComparisonService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<LYComparisonServiceFixed> _logger;

        public LYComparisonServiceFixed(
            IConfiguration configuration, 
            ILogger<LYComparisonServiceFixed> logger)
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

            // Simple fast query - get sales first, then add catalog data separately  
            var upcQuery = $@"
                SELECT 
                    oi.lineitem_sku as Upc,
                    COALESCE(MAX(NULLIF(TRIM(oi.lineitem_name), '')), 'Unknown Product') as ProductName,
                    COALESCE(MAX(NULLIF(TRIM(oi.vendor), '')), 'Unknown') as Vendor,
                    'Other' as Category,
                    SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                        THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) as ThisYearSales,
                    SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                        THEN oi.lineitem_price * oi.lineitem_quantity ELSE 0 END) as LastYearSales,
                    SUM(CASE WHEN DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd 
                        THEN oi.lineitem_quantity ELSE 0 END) as ThisYearUnits,
                    SUM(CASE WHEN DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd 
                        THEN oi.lineitem_quantity ELSE 0 END) as LastYearUnits
                FROM shopify_orders o
                JOIN shopify_order_items oi ON o.id = oi.order_id
                WHERE (DATE(o.created_at) BETWEEN @ThisYearStart AND @ThisYearEnd
                   OR DATE(o.created_at) BETWEEN @LastYearStart AND @LastYearEnd)
                {storeFilter}
                GROUP BY oi.lineitem_sku
                HAVING (ThisYearSales > 0 OR LastYearSales > 0)
                ORDER BY ThisYearUnits DESC, LastYearUnits DESC
                LIMIT 200";

            var lastYearStart = request.StartDate.AddYears(-1);
            var lastYearEnd = request.EndDate.AddYears(-1);

            var parameters = new
            {
                ThisYearStart = request.StartDate.ToString("yyyy-MM-dd"),
                ThisYearEnd = request.EndDate.ToString("yyyy-MM-dd"),
                LastYearStart = lastYearStart.ToString("yyyy-MM-dd"),
                LastYearEnd = lastYearEnd.ToString("yyyy-MM-dd")
            };

            _logger.LogInformation("Executing UPC comparison query for {Store} from {Start} to {End}", 
                string.Join(",", request.Stores), request.StartDate, request.EndDate);

            // Get UPC data
            var upcData = await connection.QueryAsync<LYComparisonData>(upcQuery, parameters, commandTimeout: 60);
            var dataList = upcData.ToList();

            // Enrich with catalog data fast lookup
            if (dataList.Any())
            {
                var upcs = string.Join(",", dataList.Select(d => $"'{d.Upc.Replace("'", "''")}'"));
                var catalogQuery = $@"
                    SELECT DISTINCT
                        COALESCE(UPC_Code, CLU) as product_code,
                        Vendor,
                        Shopify_Class as Category
                    FROM fit2run_catalog 
                    WHERE UPC_Code IN ({upcs}) OR CLU IN ({upcs})";
                
                var catalogData = await connection.QueryAsync<dynamic>(catalogQuery, commandTimeout: 30);
                var catalogDict = catalogData.ToDictionary(c => (string)c.product_code, c => new { vendor = (string)c.Vendor, category = (string)c.Category });
                
                foreach (var item in dataList)
                {
                    if (catalogDict.ContainsKey(item.Upc))
                    {
                        var catalog = catalogDict[item.Upc];
                        if (!string.IsNullOrEmpty(catalog.vendor))
                            item.Vendor = catalog.vendor;
                        if (!string.IsNullOrEmpty(catalog.category))
                            item.Category = catalog.category;
                    }
                }
            }

            // Calculate percentage and dollar changes
            foreach (var item in dataList)
            {
                item.PercentageChange = item.LastYearSales > 0 
                    ? ((item.ThisYearSales - item.LastYearSales) / item.LastYearSales) * 100 
                    : (item.ThisYearSales > 0 ? 100 : 0);
                item.DollarChange = item.ThisYearSales - item.LastYearSales;
                
                // Clean up product names
                if (!string.IsNullOrEmpty(item.ProductName))
                {
                    item.ProductName = item.ProductName.Trim();
                }
                if (string.IsNullOrEmpty(item.Vendor))
                {
                    item.Vendor = "Unknown";
                }
            }

            // Get daily comparison data
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
            var lastYearParams = new { StartDate = lastYearStart.ToString("yyyy-MM-dd"), EndDate = lastYearEnd.ToString("yyyy-MM-dd") };

            // Get this year daily data
            var thisYearDaily = await connection.QueryAsync<dynamic>(dailyQuery, thisYearParams, commandTimeout: 60);
            var thisYearDict = thisYearDaily.ToDictionary(x => ((DateTime)x.date).ToString("MM-dd"), x => new { sales = (decimal)x.dailySales, orders = (int)x.dailyOrders });

            // Get last year daily data  
            var lastYearDaily = await connection.QueryAsync<dynamic>(dailyQuery, lastYearParams, commandTimeout: 60);
            var lastYearDict = lastYearDaily.ToDictionary(x => ((DateTime)x.date).ToString("MM-dd"), x => new { sales = (decimal)x.dailySales, orders = (int)x.dailyOrders });

            // Build daily comparisons
            var dailyComparisons = new List<DailyComparisonData>();
            var currentDate = request.StartDate;

            while (currentDate <= request.EndDate)
            {
                var dayKey = currentDate.ToString("MM-dd");
                
                var thisYear = thisYearDict.ContainsKey(dayKey) ? thisYearDict[dayKey] : new { sales = 0m, orders = 0 };
                var lastYear = lastYearDict.ContainsKey(dayKey) ? lastYearDict[dayKey] : new { sales = 0m, orders = 0 };

                var dollarChange = thisYear.sales - lastYear.sales;
                var percentageChange = lastYear.sales > 0 ? ((dollarChange / lastYear.sales) * 100) : (thisYear.sales > 0 ? 100 : 0);

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

            // Calculate summary from UPC data
            var summary = new LYComparisonSummary
            {
                TotalThisYear = dataList.Sum(x => x.ThisYearSales),
                TotalLastYear = dataList.Sum(x => x.LastYearSales),
                TotalDollarChange = dataList.Sum(x => x.DollarChange),
                TotalUPCs = dataList.Count,
                PositiveUPCs = dataList.Count(x => x.PercentageChange > 0),
                NegativeUPCs = dataList.Count(x => x.PercentageChange < 0)
            };

            summary.TotalPercentageChange = summary.TotalLastYear > 0 
                ? ((summary.TotalDollarChange / summary.TotalLastYear) * 100) 
                : (summary.TotalThisYear > 0 ? 100 : 0);

            var response = new LYComparisonResponse
            {
                Data = dataList, // UPC-level product comparisons
                DailyData = dailyComparisons, // Daily trend data
                Summary = summary,
                DateRanges = new DateRange
                {
                    ThisYearStart = DateOnly.FromDateTime(request.StartDate),
                    ThisYearEnd = DateOnly.FromDateTime(request.EndDate),
                    LastYearStart = DateOnly.FromDateTime(lastYearStart),
                    LastYearEnd = DateOnly.FromDateTime(lastYearEnd)
                }
            };

            _logger.LogInformation("LY Comparison completed: {UPCs} products, ${TotalThisYear:F2} vs ${TotalLastYear:F2}", 
                dataList.Count, summary.TotalThisYear, summary.TotalLastYear);

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