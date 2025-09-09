using Fit2RunDashboard.Models;
using Fit2RunDashboard.Services;
using Microsoft.AspNetCore.Mvc;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class LYComparisonController : ControllerBase
    {
        private readonly ILYComparisonService _service;
        private readonly ILogger<LYComparisonController> _logger;

        public LYComparisonController(ILYComparisonService service, ILogger<LYComparisonController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>
        /// Get Last Year comparison data for UPC-level sales analysis
        /// </summary>
        /// <param name="startDate">Start date for this year's data</param>
        /// <param name="endDate">End date for this year's data</param>
        /// <param name="stores">Comma-separated list of stores, or 'all_stores' for all</param>
        /// <param name="category">Category filter: 'all', 'footwear', 'apparel', or 'accessories'</param>
        /// <param name="vendor">Vendor filter: 'all' or specific vendor name</param>
        /// <param name="matchType">Match type: 'all' or 'matches' (only products sold in both years)</param>
        /// <returns>LY comparison data with summary statistics</returns>
        [HttpGet]
        public async Task<ActionResult<LYComparisonResponse>> GetLYComparison(
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate,
            [FromQuery] string stores = "all_stores",
            [FromQuery] string category = "all",
            [FromQuery] string vendor = "all",
            [FromQuery] string matchType = "all")
        {
            try
            {
                if (startDate == default || endDate == default)
                {
                    return BadRequest(new { error = "Start date and end date are required" });
                }

                if (endDate < startDate)
                {
                    return BadRequest(new { error = "End date must be after start date" });
                }

                var request = new LYComparisonRequest
                {
                    StartDate = startDate,
                    EndDate = endDate,
                    Stores = stores.Split(',', StringSplitOptions.RemoveEmptyEntries),
                    Category = category,
                    Vendor = vendor,
                    MatchType = matchType
                };

                _logger.LogInformation("LY Comparison request: {@Request}", request);

                var result = await _service.GetLYComparisonAsync(request);
                
                _logger.LogInformation("LY Comparison completed: {DataCount} records, ${TotalThisYear:F2} this year vs ${TotalLastYear:F2} last year", 
                    result.Data.Count, result.Summary.TotalThisYear, result.Summary.TotalLastYear);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing LY comparison request");
                return StatusCode(500, new { error = "Internal server error", message = ex.Message });
            }
        }

        /// <summary>
        /// Get available store locations
        /// </summary>
        [HttpGet("locations")]
        public async Task<ActionResult<string[]>> GetLocations()
        {
            // For now, return hardcoded locations - can be made dynamic later
            var locations = new[] 
            { 
                "all_stores", "tyrone", "sunset", "waterford", "orlando", "altamonte", 
                "winter_park", "disney", "melbourne", "gainesville", "tallahassee", 
                "jacksonville", "naples", "sarasota", "clearwater", "ecom" 
            };
            
            return Ok(new { locations });
        }

        /// <summary>
        /// Get available vendors for filtering
        /// </summary>
        [HttpGet("vendors")]
        public async Task<ActionResult<string[]>> GetVendors()
        {
            try
            {
                var vendors = await _service.GetVendorsAsync();
                return Ok(vendors);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting vendors");
                return StatusCode(500, new { error = "Internal server error", message = ex.Message });
            }
        }

        /// <summary>
        /// Get available categories for filtering
        /// </summary>
        [HttpGet("categories")]
        public async Task<ActionResult<string[]>> GetCategories()
        {
            try
            {
                var categories = await _service.GetCategoriesAsync();
                return Ok(categories);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting categories");
                return StatusCode(500, new { error = "Internal server error", message = ex.Message });
            }
        }
    }
}