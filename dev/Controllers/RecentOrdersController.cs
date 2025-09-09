using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecentOrdersController : ControllerBase
    {
        private readonly RecentOrdersService _recentOrdersService;

        public RecentOrdersController(RecentOrdersService recentOrdersService)
        {
            _recentOrdersService = recentOrdersService;
        }

        [HttpGet]
        public async Task<IActionResult> GetRecentOrders()
        {
            try
            {
                var result = await _recentOrdersService.GetRecentOrdersAsync();
                
                // Set no-cache headers to ensure fresh data
                Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
                Response.Headers["Pragma"] = "no-cache";
                Response.Headers["Expires"] = "0";
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    error = "Failed to fetch recent orders",
                    details = ex.Message 
                });
            }
        }

        [HttpPost("clear-cache")]
        public async Task<IActionResult> ClearCache()
        {
            try
            {
                var result = await _recentOrdersService.ClearCacheAsync();
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    error = "Failed to clear cache",
                    details = ex.Message 
                });
            }
        }
    }
}