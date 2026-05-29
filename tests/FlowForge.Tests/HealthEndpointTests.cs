using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FlowForge.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
            builder.UseSetting("Jwt:Issuer", "FlowForge");
            builder.UseSetting("Jwt:Audience", "FlowForge");
            builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
        }).CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsHealthyWhenDatabaseIsAvailable()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("Healthy", body);
    }

    [Fact]
    public async Task GetHealth_IsNotSubjectToRateLimiting()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
            builder.UseSetting("Jwt:Issuer", "FlowForge");
            builder.UseSetting("Jwt:Audience", "FlowForge");
            builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
            builder.UseSetting("RateLimiting:PermitLimit", "1");
            builder.UseSetting("RateLimiting:WindowSeconds", "60");
        });

        using var client = factory.CreateClient();

        for (var i = 0; i < 5; i++)
        {
            var healthResponse = await client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
        }
    }
}
