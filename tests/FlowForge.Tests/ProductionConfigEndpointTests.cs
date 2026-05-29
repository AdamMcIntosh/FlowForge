using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace FlowForge.Tests;

// Uses WebApplicationFactory<Program> with Production environment and SQLite in-memory overrides.
public sealed class ProductionConfigEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string AllowedOrigin = "https://app.flowforge.example.com";
    private const string DisallowedOrigin = "https://evil.example.com";
    private const string ProductionJwtSecret = "k7P9mX2vQ4nR8wL1tY6hJ3cF5bN0sD9uA7gE2iK4oM6pZ8x";

    [Fact]
    public async Task GetHealth_InProduction_IncludesSecurityHeaders()
    {
        using var factory = CreateProductionFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal(
            "strict-origin-when-cross-origin",
            response.Headers.GetValues("Referrer-Policy").Single());
        Assert.True(response.Headers.Contains("Permissions-Policy"));
    }

    [Fact]
    public async Task OptionsHealth_WithAllowedOrigin_ReturnsCorsHeaders()
    {
        using var factory = CreateProductionFactory();
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Options, "/health");
        request.Headers.Add("Origin", AllowedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(AllowedOrigin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task OptionsHealth_WithDisallowedOrigin_DoesNotReturnAllowOriginHeader()
    {
        using var factory = CreateProductionFactory();
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Options, "/health");
        request.Headers.Add("Origin", DisallowedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task SwaggerUI_InProduction_IsNotReachable()
    {
        using var factory = CreateProductionFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/swagger/index.html");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateProductionFactory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(Environments.Production);
            builder.UseSetting("AllowedHosts", "*");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
            builder.UseSetting("Jwt:Issuer", "FlowForge");
            builder.UseSetting("Jwt:Audience", "FlowForge");
            builder.UseSetting("Jwt:Secret", ProductionJwtSecret);
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
            builder.UseSetting("Cors:AllowedOrigins:0", AllowedOrigin);
        });
}
