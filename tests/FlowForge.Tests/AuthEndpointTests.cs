using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using FlowForge.Api.Endpoints;
using FlowForge.Application.Common.Interfaces;
using FlowForge.Domain.Users;
using FlowForge.Infrastructure.Authentication;
using FlowForge.Infrastructure.Persistence;
using FlowForge.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace FlowForge.Tests;

public class AuthEndpointTests : IClassFixture<AuthEndpointWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthEndpointTests(AuthEndpointWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_ThenLogin_ReturnsJwtWithUniqueJti()
    {
        var email = $"auth-endpoint-{Guid.NewGuid():N}@example.com";
        var password = "SecurePass123!";

        var registerResponse = await _client.PostAsJsonAsync("/register", new AuthRequest(email, password));
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        var registered = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(registered);
        Assert.False(string.IsNullOrWhiteSpace(registered.AccessToken));
        Assert.Equal(email, registered.Email);

        var loginResponse = await _client.PostAsJsonAsync("/login", new AuthRequest(email, password));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loggedIn = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(loggedIn);
        Assert.Equal(registered.UserId, loggedIn.UserId);
        Assert.Equal(email, loggedIn.Email);

        var handler = new JwtSecurityTokenHandler();
        var registerJti = handler.ReadJwtToken(registered.AccessToken).Claims
            .Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
        var loginJti = handler.ReadJwtToken(loggedIn.AccessToken).Claims
            .Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;

        Assert.NotEqual(registerJti, loginJti);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsConflict()
    {
        var email = $"dup-endpoint-{Guid.NewGuid():N}@example.com";

        var first = await _client.PostAsJsonAsync("/register", new AuthRequest(email, "SecurePass123!"));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var duplicate = await _client.PostAsJsonAsync("/register", new AuthRequest(email, "OtherPass456!"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var email = $"wrong-pass-endpoint-{Guid.NewGuid():N}@example.com";

        var register = await _client.PostAsJsonAsync("/register", new AuthRequest(email, "SecurePass123!"));
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        var login = await _client.PostAsJsonAsync("/login", new AuthRequest(email, "WrongPass456!"));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task Login_WhenUserMissing_ReturnsUnauthorized()
    {
        var login = await _client.PostAsJsonAsync(
            "/login",
            new AuthRequest($"missing-endpoint-{Guid.NewGuid():N}@example.com", "SecurePass123!"));

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task GetMe_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMe_WithValidToken_ReturnsCurrentUser()
    {
        var email = $"me-endpoint-{Guid.NewGuid():N}@example.com";
        var password = "SecurePass123!";

        var registerResponse = await _client.PostAsJsonAsync("/register", new AuthRequest(email, password));
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        var registered = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(registered);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Bearer",
            registered.AccessToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var me = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(me);
        Assert.Equal(registered.UserId, me.Id);
        Assert.Equal(email, me.Email);
    }
}

public sealed class AuthEndpointWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public AuthEndpointWebApplicationFactory()
    {
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:DefaultConnection", "Data Source=:memory:");
        builder.UseSetting("Jwt:Issuer", "FlowForge");
        builder.UseSetting("Jwt:Audience", "FlowForge");
        builder.UseSetting("Jwt:Secret", "FlowForge-Dev-Secret-Key-At-Least-32-Chars!");
        builder.UseSetting("Jwt:ExpiryMinutes", "60");

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
                d.ServiceType == typeof(FlowForgeDbContext) ||
                d.ServiceType == typeof(DbContextOptions<FlowForgeDbContext>) ||
                d.ServiceType == typeof(IUserRepository) ||
                d.ServiceType == typeof(IJwtTokenService) ||
                (d.ServiceType.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false) ||
                (d.ImplementationType?.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false))
            .ToList();

        foreach (var descriptor in descriptors)
        {
            services.Remove(descriptor);
        }
    }
}
