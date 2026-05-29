using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace FlowForge.Tests;

public class SwaggerEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public SwaggerEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(Environments.Development);
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
            builder.UseSetting("Jwt:Issuer", "FlowForge");
            builder.UseSetting("Jwt:Audience", "FlowForge");
            builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
            builder.UseSetting("Jwt:ExpiryMinutes", "60");
        }).CreateClient();
    }

    [Fact]
    public async Task SwaggerUI_IsReachableAtSwaggerRoute()
    {
        var response = await _client.GetAsync("/swagger/index.html");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SwaggerJson_IncludesJwtSecurityDefinitionAndEndpointDescriptions()
    {
        var response = await _client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.True(root.TryGetProperty("components", out var components));
        Assert.True(components.TryGetProperty("securitySchemes", out var securitySchemes));
        Assert.True(securitySchemes.TryGetProperty("Bearer", out var bearerScheme));
        Assert.Equal("http", bearerScheme.GetProperty("type").GetString());
        Assert.Equal("bearer", bearerScheme.GetProperty("scheme").GetString());

        Assert.True(root.TryGetProperty("paths", out var paths));
        Assert.True(paths.TryGetProperty("/register", out var registerPath));
        Assert.True(registerPath.TryGetProperty("post", out var registerPost));
        Assert.Equal("Register a new user", registerPost.GetProperty("summary").GetString());

        Assert.True(paths.TryGetProperty("/me", out var mePath));
        Assert.True(mePath.TryGetProperty("get", out var meGet));
        Assert.Equal("Get current user", meGet.GetProperty("summary").GetString());
        Assert.True(meGet.TryGetProperty("security", out _));

        Assert.True(paths.TryGetProperty("/projects", out var projectsPath));
        Assert.True(projectsPath.TryGetProperty("get", out var listProjects));
        Assert.Equal("List projects", listProjects.GetProperty("summary").GetString());
    }
}
