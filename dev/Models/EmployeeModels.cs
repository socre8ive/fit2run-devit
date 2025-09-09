namespace Fit2RunDashboard.Models
{
    public class EmployeeSummary
    {
        public int TotalEmployees { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalTransactions { get; set; }
        public int TotalCustomers { get; set; }
        public decimal AvgRevenuePerEmployee { get; set; }
        public decimal AvgTransactionsPerEmployee { get; set; }
        public BestPerformer BestPerformer { get; set; } = new BestPerformer();
    }

    public class BestPerformer
    {
        public string Name { get; set; } = "N/A";
        public decimal Revenue { get; set; }
        public string Location { get; set; } = "N/A";
    }

    public class Employee
    {
        public string EmployeeId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public int DaysWorked { get; set; }
        public int TotalTransactions { get; set; }
        public int UniqueCustomers { get; set; }
        public decimal Revenue { get; set; }
        public decimal RevenuePerDay { get; set; }
        public decimal TransactionsPerDay { get; set; }
        public decimal CustomersPerDay { get; set; }
        public decimal AvgTransactionValue { get; set; }
        public decimal EfficiencyScore { get; set; }
        public int Rank { get; set; }
    }

    public class PerformanceTabs
    {
        public List<Employee> RevenueLeaders { get; set; } = new List<Employee>();
        public List<Employee> TransactionLeaders { get; set; } = new List<Employee>();
    }

    public class ChartData
    {
        public PerformanceDistribution PerformanceDistribution { get; set; } = new PerformanceDistribution();
    }

    public class PerformanceDistribution
    {
        public List<string> Labels { get; set; } = new List<string>();
        public List<DataSet> Datasets { get; set; } = new List<DataSet>();
    }

    public class DataSet
    {
        public string Label { get; set; } = string.Empty;
        public List<int> Data { get; set; } = new List<int>();
        public List<string> BackgroundColor { get; set; } = new List<string>();
    }

    public class EmployeeResponse
    {
        public bool Success { get; set; }
        public EmployeeSummary Summary { get; set; } = new EmployeeSummary();
        public PerformanceTabs PerformanceTabs { get; set; } = new PerformanceTabs();
        public List<Employee> AllEmployees { get; set; } = new List<Employee>();
        public ChartData ChartData { get; set; } = new ChartData();
        public List<string> Locations { get; set; } = new List<string>();
        public DateTime Timestamp { get; set; }
        public string? Error { get; set; }
    }
}