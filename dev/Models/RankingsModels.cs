namespace Fit2RunDashboard.Models
{
    public class StoreRanking
    {
        public string Location { get; set; } = string.Empty;
        public int Visitors { get; set; }
        public int Transactions { get; set; }
        public decimal Revenue { get; set; }
        public int UniqueCustomers { get; set; }
        public int DaysActive { get; set; }
        public decimal AvgTransactionValue { get; set; }
        public decimal ConversionRate { get; set; }
        public decimal RevenuePerVisitor { get; set; }
        public decimal CustomersPerDay { get; set; }
        public decimal RevenuePerDay { get; set; }
        public decimal TransactionsPerDay { get; set; }
        public int ConversionRank { get; set; }
        public int RevenuePerVisitorRank { get; set; }
        public int TotalRevenueRank { get; set; }
        public int AvgTransactionRank { get; set; }
        public decimal EfficiencyScore { get; set; }
    }

    public class RankingsSummary
    {
        public int TotalStores { get; set; }
        public int TotalVisitors { get; set; }
        public decimal TotalRevenue { get; set; }
        public int DateRangeDays { get; set; }
    }

    public class RankingsChartData
    {
        public List<string> Labels { get; set; } = new List<string>();
        public List<ChartDataset> Datasets { get; set; } = new List<ChartDataset>();
    }

    public class ChartDataset
    {
        public string Label { get; set; } = string.Empty;
        public List<decimal> Data { get; set; } = new List<decimal>();
        public List<string> BackgroundColor { get; set; } = new List<string>();
    }

    public class RankingsResponse
    {
        public bool Success { get; set; }
        public List<StoreRanking> Rankings { get; set; } = new List<StoreRanking>();
        public RankingsChartData ChartData { get; set; } = new RankingsChartData();
        public RankingsSummary Summary { get; set; } = new RankingsSummary();
        public DateTime Timestamp { get; set; }
        public string? Error { get; set; }
    }
}