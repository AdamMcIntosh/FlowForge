using System.Net;
using System.Net.Http.Json;
using FlowForge.Api.Endpoints;
using FlowForge.Application.Common.Interfaces;
using FlowForge.Domain.Users;
using FlowForge.Infrastructure.Authentication;
using FlowForge.Infrastructure.Persistence;
using FlowForge.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace FlowForge.Tests;

public class RateLimitEndpointTests : IClassFixture<RateLimitEndpointWebApplicationFactory>
{
    private readonly HttpClient _client;

    public RateLimitEndpointTests(RateLimitEndpointWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_ExceedingPermitLimit_ReturnsTooManyRequestsWithProblemDetails()
    {
        var email = $"rate-limit-{Guid.NewGuid():N}@example.com";
        var password = "SecurePass123!";

        var registerResponse = await _client.PostAsJsonAsync("/register", new AuthRequest(email, password));
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        var allowedLogin = await _client.PostAsJsonAsync("/login", new AuthRequest(email, password));
        Assert.Equal(HttpStatusCode.OK, allowedLogin.StatusCode);

        var limited = await _client.PostAsJsonAsync("/login", new AuthRequest(email, password));
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);

        var problem = await limited.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status429TooManyRequests, problem.Status);
        Assert.Equal("Too many requests", problem.Title);
    }
}

public sealed class RateLimitEndpointWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public RateLimitEndpointWebApplicationFactory()
    {
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Database:Provider", "Sqlite");
        builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
        builder.UseSetting("Jwt:Issuer", "FlowForge");
        builder.UseSetting("Jwt:Audience", "FlowForge");
        builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
        builder.UseSetting("Jwt:ExpiryMinutes", "60");
        builder.UseSetting("RateLimiting:PermitLimit", "2");
        builder.UseSetting("RateLimiting:WindowSeconds", "60");

        builder.ConfigureTestServices(services =>
        {
            RemoveEfCoreRegistrations(services);

            services.AddDbContext<FlowForgeDbContext>(options => options.UseSqlite(_connection));
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IJwtTokenService, JwtTokenService>();
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FlowForgeDbContext>();
        dbContext.Database.EnsureCreated();

        return host;
    }

    public new void Dispose()
    {
        base.Dispose();
        _connection.Dispose();
    }

    private static void RemoveEfCoreRegistrations(IServiceCollection services)
    {
        var descriptors = services
            .Where(d =>
                d.ServiceType == typeof(DbContextOptions<FlowForgeDbContext>)
                || d.ServiceType == typeof(FlowForgeDbContext)
                || d.ServiceType == typeof(IUserRepository))
            .ToList();

        foreach (var descriptor in descriptors)
        {
            services.Remove(descriptor);
        }

        services.RemoveAll(typeof(DbContextOptions<FlowForgeDbContext>));
    }
}
