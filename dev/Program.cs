using Fit2RunDashboard.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddRazorPages();
builder.Services.AddControllersWithViews();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { 
        Title = "Fit2Run Dashboard API", 
        Version = "v1",
        Description = "High-performance dashboard API with Dapper + MySQL + Redis caching"
    });
});

// Configure Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(provider =>
{
    var configuration = provider.GetService<IConfiguration>();
    var connectionString = configuration!.GetConnectionString("Redis");
    return ConnectionMultiplexer.Connect(connectionString!);
});

// Add Redis distributed caching
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
});

// Register services
builder.Services.AddScoped<ILYComparisonService, LYComparisonService>();
builder.Services.AddScoped<RecentOrdersService>();
builder.Services.AddScoped<BudgetService>();
builder.Services.AddScoped<EmployeeService>();
builder.Services.AddScoped<RankingsService>();
builder.Services.AddScoped<ProductsService>();
builder.Services.AddScoped<PerformanceService>();

// Add health checks
builder.Services.AddHealthChecks()
    .AddCheck("mysql", () => 
    {
        try
        {
            using var connection = new MySqlConnector.MySqlConnection(
                builder.Configuration.GetConnectionString("DefaultConnection"));
            connection.Open();
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("MySQL connection successful");
        }
        catch (Exception ex)
        {
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Unhealthy("MySQL connection failed", ex);
        }
    })
    .AddCheck("redis", () =>
    {
        try
        {
            var redis = ConnectionMultiplexer.Connect(builder.Configuration.GetConnectionString("Redis")!);
            var db = redis.GetDatabase();
            db.Ping();
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("Redis connection successful");
        }
        catch (Exception ex)
        {
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Unhealthy("Redis connection failed", ex);
        }
    });

// Add CORS for development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure path base for running under /dev/
app.UsePathBase("/dev");

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Fit2Run Dashboard API v1");
        c.RoutePrefix = "api-docs"; // Serve Swagger UI at /api-docs instead of root
    });
}

app.UseCors();
app.UseStaticFiles();
app.UseRouting();

app.MapControllers();
app.MapRazorPages();
app.MapDefaultControllerRoute();
app.MapHealthChecks("/health");

// Welcome message
app.MapGet("/api/status", () => new
{
    service = "Fit2Run Dashboard API",
    version = "1.0.0",
    framework = ".NET 9",
    stack = "ASP.NET Core + Dapper + MySQL + Redis",
    timestamp = DateTime.UtcNow,
    message = "Online"
});

app.Run("http://0.0.0.0:5000");
