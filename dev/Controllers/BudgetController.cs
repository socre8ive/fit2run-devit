using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BudgetController : ControllerBase
    {
        private readonly BudgetService _budgetService;

        public BudgetController(BudgetService budgetService)
        {
            _budgetService = budgetService;
        }

        [HttpGet]
        public async Task<IActionResult> GetBudgetData(
            [FromQuery] string location = "all", 
            [FromQuery] string period = "last4weeks")
        {
            try
            {
                var result = await _budgetService.GetBudgetDataAsync(location, period);
                
                Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
                Response.Headers["Pragma"] = "no-cache";
                Response.Headers["Expires"] = "0";
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    error = "Failed to fetch budget data",
                    details = ex.Message 
                });
            }
        }

        [HttpGet("locations")]
        public async Task<IActionResult> GetLocations()
        {
            try
            {
                var result = await _budgetService.GetBudgetDataAsync();
                return Ok(new { success = true, locations = result.Locations });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    error = "Failed to fetch locations",
                    details = ex.Message 
                });
            }
        }
    }
}