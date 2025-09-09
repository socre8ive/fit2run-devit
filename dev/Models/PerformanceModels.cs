namespace Fit2RunDashboard.Models
{
    public class PerformanceMetrics
    {
        public int TotalOrders { get; set; }
        public decimal TotalRevenue { get; set; }
        public int UniqueCustomers { get; set; }
        public decimal AvgOrderValue { get; set; }
        public decimal? ConversionRate { get; set; }
        public decimal? RevenuePerVisitor { get; set; }
    }

    public class StorePerformance
    {
        public string Location { get; set; } = string.Empty;
        public int TotalOrders { get; set; }
        public decimal TotalRevenue { get; set; }
        public int UniqueCustomers { get; set; }
        public decimal AvgOrderValue { get; set; }
        public decimal? ConversionRate { get; set; }
        public decimal? RevenuePerVisitor { get; set; }
        public int? TotalVisitors { get; set; }
    }

    public class DailyPerformance
    {
        public DateTime Date { get; set; }
        public int Orders { get; set; }
        public decimal Revenue { get; set; }
        public int UniqueCustomers { get; set; }
        public decimal AvgOrderValue { get; set; }
        public decimal? ConversionRate { get; set; }
        public decimal? RevenuePerVisitor { get; set; }
        public int? TotalVisitors { get; set; }
    }

    public class PerformanceData
    {
        public PerformanceMetrics Metrics { get; set; } = new();
        public List<StorePerformance> StorePerformance { get; set; } = new();
        public List<DailyPerformance> DailyPerformance { get; set; } = new();
    }

    public class PerformanceRequest
    {
        public DateTime StartDate { get; set; } = DateTime.Today.AddDays(-7);
        public DateTime EndDate { get; set; } = DateTime.Today;
        public string Location { get; set; } = "all";
    }
}