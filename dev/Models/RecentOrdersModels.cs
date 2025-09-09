namespace Fit2RunDashboard.Models
{
    public class OrderItem
    {
        public string ProductName { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal Price { get; set; }
    }

    public class Order
    {
        public long Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public decimal Subtotal { get; set; }
        public decimal Total { get; set; }
        public string FinancialStatus { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string Currency { get; set; } = "USD";
        public List<OrderItem> Items { get; set; } = new List<OrderItem>();
        public string ItemsSummary { get; set; } = string.Empty;
        public long? FulfillmentLocationId { get; set; }
        public string? FulfillmentLocationName { get; set; }
        public string? FulfillmentStatus { get; set; }
    }

    public class RecentOrdersResponse
    {
        public bool Success { get; set; }
        public List<Order> Orders { get; set; } = new List<Order>();
        public int Count { get; set; }
        public DateTime Timestamp { get; set; }
        public string? Error { get; set; }
    }
}