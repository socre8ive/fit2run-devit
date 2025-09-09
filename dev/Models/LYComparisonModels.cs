namespace Fit2RunDashboard.Models
{
    public class LYComparisonRequest
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string[] Stores { get; set; } = ["all_stores"];
        public string Category { get; set; } = "all";
        public string Vendor { get; set; } = "all";
        public string MatchType { get; set; } = "all";
    }

    public class LYComparisonData
    {
        public string Upc { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string Vendor { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal ThisYearSales { get; set; }
        public decimal LastYearSales { get; set; }
        public decimal PercentageChange { get; set; }
        public decimal DollarChange { get; set; }
        public int ThisYearUnits { get; set; }
        public int LastYearUnits { get; set; }
    }

    public class LYComparisonSummary
    {
        public decimal TotalThisYear { get; set; }
        public decimal TotalLastYear { get; set; }
        public decimal TotalPercentageChange { get; set; }
        public decimal TotalDollarChange { get; set; }
        public int TotalUPCs { get; set; }
        public int PositiveUPCs { get; set; }
        public int NegativeUPCs { get; set; }
    }

    public class BrandSummary
    {
        public string Brand { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal ThisYearSales { get; set; }
        public decimal LastYearSales { get; set; }
        public int ThisYearUnits { get; set; }
        public int LastYearUnits { get; set; }
        public decimal PercentageChange { get; set; }
        public decimal DollarChange { get; set; }
        public int UniqueProducts { get; set; }
    }

    public class DailyComparisonData
    {
        public DateOnly Date { get; set; }
        public decimal ThisYearSales { get; set; }
        public decimal LastYearSales { get; set; }
        public int ThisYearOrders { get; set; }
        public int LastYearOrders { get; set; }
        public decimal PercentageChange { get; set; }
        public decimal DollarChange { get; set; }
    }

    public class LYComparisonResponse
    {
        public List<LYComparisonData> Data { get; set; } = new();
        public List<DailyComparisonData> DailyData { get; set; } = new();
        public LYComparisonSummary Summary { get; set; } = new();
        public BrandSummary? BrandSummary { get; set; }
        public DateRange DateRanges { get; set; } = new();
    }

    public class DateRange
    {
        public DateOnly ThisYearStart { get; set; }
        public DateOnly ThisYearEnd { get; set; }
        public DateOnly LastYearStart { get; set; }
        public DateOnly LastYearEnd { get; set; }
    }
}