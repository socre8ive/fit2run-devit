using Microsoft.AspNetCore.Mvc;
using Fit2RunDashboard.Services;

namespace Fit2RunDashboard.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly ProductsService _productsService;

        public ProductsController(ProductsService productsService)
        {
            _productsService = productsService;
        }

        [HttpGet("initial")]
        public async Task<IActionResult> GetInitialData()
        {
            try
            {
                var result = await _productsService.GetInitialDataAsync();
                
                Response.Headers["Cache-Control"] = "public, max-age=3600"; // 1 hour cache for initial data
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    error = "Failed to fetch initial data",
                    details = ex.Message 
                });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetProductsData(
            [FromQuery] string startDate, 
            [FromQuery] string endDate,
            [FromQuery] string? stores,
            [FromQuery] string? vendors,
            [FromQuery] int minQuantity = 1)
        {
            try
            {
                if (string.IsNullOrEmpty(startDate) || string.IsNullOrEmpty(endDate))
                {
                    return BadRequest(new { success = false, error = "Start date and end date are required" });
                }

                var selectedStores = string.IsNullOrEmpty(stores) 
                    ? new List<string>() 
                    : stores.Split(',').Where(s => !string.IsNullOrWhiteSpace(s)).ToList();

                var selectedVendors = string.IsNullOrEmpty(vendors) 
                    ? new List<string>() 
                    : vendors.Split(',').Where(v => !string.IsNullOrWhiteSpace(v)).ToList();

                var result = await _productsService.GetProductsDataAsync(startDate, endDate, selectedStores, selectedVendors, minQuantity);
                
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
                    error = "Failed to fetch products data",
                    details = ex.Message 
                });
            }
        }
    }
}