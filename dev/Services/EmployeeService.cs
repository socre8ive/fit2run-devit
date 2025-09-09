using Dapper;
using MySqlConnector;
using StackExchange.Redis;
using System.Text.Json;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Services
{
    public class EmployeeService
    {
        private readonly string _connectionString;
        private readonly IConnectionMultiplexer _redis;
        private readonly IDatabase _redisDb;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(15);

        public EmployeeService(IConfiguration configuration, IConnectionMultiplexer redis)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _redis = redis;
            _redisDb = redis.GetDatabase();
        }

        public async Task<EmployeeResponse> GetEmployeeDataAsync(string startDate, string endDate, string location = "all")
        {
            try
            {
                if (string.IsNullOrEmpty(startDate) || string.IsNullOrEmpty(endDate))
                {
                    return new EmployeeResponse
                    {
                        Success = false,
                        Error = "Start date and end date are required",
                        Timestamp = DateTime.UtcNow
                    };
                }

                var cacheKey = $"employee_data_{startDate}_{endDate}_{location}";
                var cachedData = await _redisDb.StringGetAsync(cacheKey);
                if (cachedData.HasValue)
                {
                    var cachedResponse = JsonSerializer.Deserialize<EmployeeResponse>(cachedData!);
                    if (cachedResponse != null) return cachedResponse;
                }

                // Get locations first with separate connection
                List<string> locations;
                using (var locConnection = new MySqlConnection(_connectionString))
                {
                    await locConnection.OpenAsync();
                    locations = await GetLocationsAsync(locConnection);
                }

                using var connection = new MySqlConnection(_connectionString);
                await connection.OpenAsync();

                // Build location filter
                var (locationFilter, locationParams) = BuildLocationFilter(location);

                // Employee performance query with name mapping
                var employeeSummaryQuery = $@"
                    SELECT 
                        so.employee,
                        COALESCE(sm.staff_name, so.employee) as staff_name,
                        so.location,
                        COUNT(*) AS total_transactions,
                        SUM(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS total_revenue,
                        AVG(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS avg_transaction_value,
                        MIN(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS min_transaction,
                        MAX(CASE WHEN so.subtotal IS NOT NULL THEN so.subtotal ELSE 0 END) AS max_transaction,
                        COUNT(DISTINCT DATE(so.created_at)) AS days_worked,
                        COUNT(DISTINCT so.email) AS unique_customers
                    FROM shopify_orders so
                    LEFT JOIN staff_member_mapping sm ON so.employee = sm.staff_id
                    WHERE DATE(so.created_at) BETWEEN @startDate AND @endDate
                      AND so.financial_status = 'paid'
                      AND so.employee IS NOT NULL 
                      AND so.employee != ''
                      {locationFilter}
                    GROUP BY so.employee, sm.staff_name, so.location
                    HAVING COUNT(*) >= 1
                    ORDER BY total_revenue DESC";

                var parameters = new DynamicParameters();
                parameters.Add("@startDate", startDate);
                parameters.Add("@endDate", endDate);
                foreach (var param in locationParams)
                {
                    parameters.Add(param.Key, param.Value);
                }

                var employeeData = (await connection.QueryAsync<EmployeeDataPoint>(employeeSummaryQuery, parameters)).ToList();

                if (employeeData.Count == 0)
                {
                    return new EmployeeResponse
                    {
                        Success = true,
                        Summary = new EmployeeSummary(),
                        PerformanceTabs = new PerformanceTabs(),
                        AllEmployees = new List<Employee>(),
                        ChartData = new ChartData(),
                        Locations = locations,
                        Timestamp = DateTime.UtcNow
                    };
                }

                // Process employees with calculated metrics
                var processedEmployees = employeeData.Select((emp, index) => new Employee
                {
                    EmployeeId = emp.Employee,
                    Name = emp.StaffName ?? emp.Employee,
                    Location = emp.Location,
                    DaysWorked = emp.DaysWorked,
                    TotalTransactions = emp.TotalTransactions,
                    UniqueCustomers = emp.UniqueCustomers,
                    Revenue = emp.TotalRevenue,
                    RevenuePerDay = emp.TotalRevenue / Math.Max(emp.DaysWorked, 1),
                    TransactionsPerDay = (decimal)emp.TotalTransactions / Math.Max(emp.DaysWorked, 1),
                    CustomersPerDay = (decimal)emp.UniqueCustomers / Math.Max(emp.DaysWorked, 1),
                    AvgTransactionValue = emp.AvgTransactionValue,
                    EfficiencyScore = Math.Round(emp.TotalRevenue / Math.Max(emp.TotalTransactions, 1), 2),
                    Rank = index + 1
                }).ToList();

                // Calculate summary
                var totalEmployees = processedEmployees.Count;
                var totalRevenue = processedEmployees.Sum(e => e.Revenue);
                var totalTransactions = processedEmployees.Sum(e => e.TotalTransactions);
                var totalCustomers = processedEmployees.Sum(e => e.UniqueCustomers);
                var bestPerformer = processedEmployees.FirstOrDefault() ?? new Employee();

                var summary = new EmployeeSummary
                {
                    TotalEmployees = totalEmployees,
                    TotalRevenue = totalRevenue,
                    TotalTransactions = totalTransactions,
                    TotalCustomers = totalCustomers,
                    AvgRevenuePerEmployee = totalEmployees > 0 ? totalRevenue / totalEmployees : 0,
                    AvgTransactionsPerEmployee = totalEmployees > 0 ? (decimal)totalTransactions / totalEmployees : 0,
                    BestPerformer = new BestPerformer
                    {
                        Name = bestPerformer.Name,
                        Revenue = bestPerformer.Revenue,
                        Location = bestPerformer.Location
                    }
                };

                // Performance tabs
                var revenueLeaders = processedEmployees.Take(15).ToList();
                var transactionLeaders = processedEmployees.OrderByDescending(e => e.TotalTransactions).Take(15).ToList();

                // Update ranks for transaction leaders
                for (int i = 0; i < transactionLeaders.Count; i++)
                {
                    transactionLeaders[i].Rank = i + 1;
                }

                var performanceTabs = new PerformanceTabs
                {
                    RevenueLeaders = revenueLeaders,
                    TransactionLeaders = transactionLeaders
                };

                // Chart data - performance distribution
                var chartData = new ChartData
                {
                    PerformanceDistribution = new PerformanceDistribution
                    {
                        Labels = new List<string> { "Top 25%", "Upper Mid 25%", "Lower Mid 25%", "Bottom 25%" },
                        Datasets = new List<DataSet>
                        {
                            new DataSet
                            {
                                Label = "Employee Performance Distribution",
                                Data = new List<int>
                                {
                                    (int)Math.Ceiling(totalEmployees * 0.25),
                                    (int)Math.Ceiling(totalEmployees * 0.25),
                                    (int)Math.Ceiling(totalEmployees * 0.25),
                                    (int)Math.Floor(totalEmployees * 0.25)
                                },
                                BackgroundColor = new List<string>
                                {
                                    "rgba(34, 197, 94, 0.8)",
                                    "rgba(59, 130, 246, 0.8)",
                                    "rgba(245, 158, 11, 0.8)",
                                    "rgba(239, 68, 68, 0.8)"
                                }
                            }
                        }
                    }
                };

                var response = new EmployeeResponse
                {
                    Success = true,
                    Summary = summary,
                    PerformanceTabs = performanceTabs,
                    AllEmployees = processedEmployees,
                    ChartData = chartData,
                    Locations = locations,
                    Timestamp = DateTime.UtcNow
                };

                // Cache the response
                var serializedResponse = JsonSerializer.Serialize(response);
                await _redisDb.StringSetAsync(cacheKey, serializedResponse, _cacheExpiration);

                return response;
            }
            catch (Exception ex)
            {
                return new EmployeeResponse
                {
                    Success = false,
                    Error = $"Failed to fetch employee data: {ex.Message}",
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        private async Task<List<string>> GetLocationsAsync(MySqlConnection connection)
        {
            var query = @"
                SELECT 'all' as location
                UNION ALL
                SELECT 'all_stores' as location
                UNION ALL
                SELECT 'ecom' as location
                UNION ALL
                SELECT DISTINCT location 
                FROM shopify_orders 
                WHERE location IS NOT NULL AND location != '' AND location != 'ecom'
                ORDER BY location";
            
            var locations = await connection.QueryAsync<string>(query);
            return locations.ToList();
        }

        private (string filter, Dictionary<string, object> parameters) BuildLocationFilter(string location)
        {
            var parameters = new Dictionary<string, object>();
            
            return location switch
            {
                "all" => ("", parameters),
                "all_stores" => ("AND so.location != 'ecom'", parameters),
                "ecom" => ("AND so.location = @location", new Dictionary<string, object> { { "@location", "ecom" } }),
                _ => ("AND so.location = @location", new Dictionary<string, object> { { "@location", location } })
            };
        }
    }

    // Helper class for SQL mapping
    internal class EmployeeDataPoint
    {
        public string Employee { get; set; } = string.Empty;
        public string? StaffName { get; set; }
        public string Location { get; set; } = string.Empty;
        public int TotalTransactions { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal AvgTransactionValue { get; set; }
        public decimal MinTransaction { get; set; }
        public decimal MaxTransaction { get; set; }
        public int DaysWorked { get; set; }
        public int UniqueCustomers { get; set; }
    }
}