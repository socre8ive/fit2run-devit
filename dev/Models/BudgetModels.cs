namespace Fit2RunDashboard.Models
{
    public class BudgetSummary
    {
        public decimal TotalBudget { get; set; }
        public decimal TotalActual { get; set; }
        public decimal Total2024Sales { get; set; }
        public decimal Variance { get; set; }
        public decimal VariancePercent { get; set; }
        public decimal YearOverYearGrowth { get; set; }
    }

    public class LocationBudgetData
    {
        public string Location { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public decimal Actual { get; set; }
        public decimal VariancePercent { get; set; }
    }

    public class BudgetChartPoint
    {
        public string Date { get; set; } = string.Empty;
        public decimal Budget2024 { get; set; }
        public decimal Budget2025 { get; set; }
        public decimal Actual2025 { get; set; }
    }

    public class BudgetResponse
    {
        public bool Success { get; set; }
        public BudgetSummary Summary { get; set; } = new BudgetSummary();
        public List<BudgetChartPoint> ChartData { get; set; } = new List<BudgetChartPoint>();
        public List<LocationBudgetData> LocationData { get; set; } = new List<LocationBudgetData>();
        public List<string> Locations { get; set; } = new List<string>();
        public DateTime Timestamp { get; set; }
        public string? Error { get; set; }
    }
}