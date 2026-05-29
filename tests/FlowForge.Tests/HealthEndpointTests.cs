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
            builder.UseSetting("ConnectionStrings:DefaultConnection",
                "Server=(localdb)\\mssqllocaldb;Database=FlowForgeTests;Trusted_Connection=True;TrustServerCertificate=True;");
            builder.UseSetting("Jwt:Issuer", "FlowForge");
            builder.UseSetting("Jwt:Audience", "FlowForge");
            builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
        }).CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
