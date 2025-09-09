using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RankingsController : ControllerBase
    {
        private readonly RankingsService _rankingsService;

        public RankingsController(RankingsService rankingsService)
        {
            _rankingsService = rankingsService;
        }

        [HttpGet("test")]
        public IActionResult Test()
        {
            return Ok(new { success = true, message = "API is working", timestamp = DateTime.Now });
        }

        [HttpGet]
        public async Task<IActionResult> GetRankingsData(
            [FromQuery] string startDate, 
            [FromQuery] string endDate, 
            [FromQuery] int minVisitors = 100,
            [FromQuery] int minOrders = 5)
        {
            try
            {
                if (string.IsNullOrEmpty(startDate) || string.IsNullOrEmpty(endDate))
                {
                    return BadRequest(new { success = false, error = "Start date and end date are required" });
                }

                var result = await _rankingsService.GetRankingsDataAsync(startDate, endDate, minVisitors, minOrders);
                
                Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
                Response.Headers["Pragma"] = "no-cache";
                Response.Headers["Expires"] = "0";
                Response.Headers["Access-Control-Allow-Origin"] = "*";
                Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
                Response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
                
                if (!result.Success)
                {
                    return BadRequest(result);
                }
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    error = "Failed to fetch rankings data",
                    details = ex.Message 
                });
            }
        }
    }
}