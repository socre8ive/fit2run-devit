using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeesController : ControllerBase
    {
        private readonly EmployeeService _employeeService;

        public EmployeesController(EmployeeService employeeService)
        {
            _employeeService = employeeService;
        }

        [HttpGet]
        public async Task<IActionResult> GetEmployeeData(
            [FromQuery] string startDate, 
            [FromQuery] string endDate, 
            [FromQuery] string location = "all")
        {
            try
            {
                if (string.IsNullOrEmpty(startDate) || string.IsNullOrEmpty(endDate))
                {
                    return BadRequest(new { success = false, error = "Start date and end date are required" });
                }

                var result = await _employeeService.GetEmployeeDataAsync(startDate, endDate, location);
                
                Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
                Response.Headers["Pragma"] = "no-cache";
                Response.Headers["Expires"] = "0";
                
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
                    error = "Failed to fetch employee data",
                    details = ex.Message 
                });
            }
        }

        [HttpGet("locations")]
        public async Task<IActionResult> GetLocations()
        {
            try
            {
                // Use a dummy date range to get locations
                var result = await _employeeService.GetEmployeeDataAsync("2025-01-01", "2025-01-01");
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