using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Controllers
{
    public class DashboardController : Controller
    {
        private readonly ILYComparisonService _lyComparisonService;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(ILYComparisonService lyComparisonService, ILogger<DashboardController> logger)
        {
            _lyComparisonService = lyComparisonService;
            _logger = logger;
        }

        public IActionResult LYComparison()
        {
            ViewData["Title"] = "Last Year Comparison";
            return View();
        }

        public IActionResult Employees()
        {
            ViewData["Title"] = "Employee Analytics";
            return View();
        }

        public IActionResult Budget()
        {
            ViewData["Title"] = "Budget Dashboard";
            return View();
        }

        public IActionResult Rankings()
        {
            ViewData["Title"] = "Store Rankings";
            return View();
        }

        public IActionResult RecentOrders()
        {
            ViewData["Title"] = "Recent Orders";
            return View();
        }

        public IActionResult Performance()
        {
            ViewData["Title"] = "Performance Dashboard";
            return View();
        }

        public IActionResult Products()
        {
            ViewData["Title"] = "Product Intelligence";
            return View();
        }

        public IActionResult Inventory()
        {
            ViewData["Title"] = "Inventory Intelligence";
            return View();
        }

        public IActionResult Customers()
        {
            ViewData["Title"] = "Customer Analytics";
            return View();
        }

        public IActionResult Shopify()
        {
            ViewData["Title"] = "Shopify Sales Report";
            return View();
        }

        public IActionResult Aetrex()
        {
            ViewData["Title"] = "Aetrex Intelligence";
            return View();
        }
    }
}