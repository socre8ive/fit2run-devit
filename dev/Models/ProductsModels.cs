namespace Fit2RunDashboard.Models
{
    public class ProductSummary
    {
        public int TotalProducts { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalUnits { get; set; }
        public decimal AvgProductRevenue { get; set; }
    }

    public class Product
    {
        public string Sku { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string Vendor { get; set; } = string.Empty;
        public int TotalQuantity { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal AvgPrice { get; set; }
        public int OrderCount { get; set; }
        public int StoreCount { get; set; }
        public int EmployeeCount { get; set; }
    }

    public class BrandPerformance
    {
        public string Vendor { get; set; } = string.Empty;
        public int TotalQuantity { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalOrders { get; set; }
        public int ProductCount { get; set; }
        public decimal AvgPrice { get; set; }
    }

    public class ProductsResponse
    {
        public bool Success { get; set; }
        public ProductSummary Summary { get; set; } = new ProductSummary();
        public List<Product> TopProducts { get; set; } = new List<Product>();
        public List<BrandPerformance> BrandPerformance { get; set; } = new List<BrandPerformance>();
        public List<string> AvailableStores { get; set; } = new List<string>();
        public List<string> AvailableVendors { get; set; } = new List<string>();
        public DateTime Timestamp { get; set; }
        public string? Error { get; set; }
    }
}