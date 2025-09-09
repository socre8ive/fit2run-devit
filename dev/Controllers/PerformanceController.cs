using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;
using Fit2RunDashboard.Models;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PerformanceController : ControllerBase
    {
        private readonly PerformanceService _performanceService;
        private readonly ILogger<PerformanceController> _logger;

        public PerformanceController(PerformanceService performanceService, ILogger<PerformanceController> logger)
        {
            _performanceService = performanceService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<PerformanceData>> GetPerformanceData(
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string location = "all")
        {
            try
            {
                var request = new PerformanceRequest
                {
                    StartDate = startDate ?? DateTime.Today.AddDays(-7),
                    EndDate = endDate ?? DateTime.Today,
                    Location = location ?? "all"
                };

                var data = await _performanceService.GetPerformanceDataAsync(request);
                
                _logger.LogInformation($"Performance data retrieved: {data.Metrics.TotalOrders} orders, ${data.Metrics.TotalRevenue:F2} revenue");
                
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetPerformanceData");
                return StatusCode(500, new { error = "Internal server error", message = ex.Message });
            }
        }
    }
}