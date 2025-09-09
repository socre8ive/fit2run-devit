using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;

namespace Fit2RunDashboard.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Performance Dashboard";
            return View();
        }

        public IActionResult Error()
        {
            return View();
        }
    }
}