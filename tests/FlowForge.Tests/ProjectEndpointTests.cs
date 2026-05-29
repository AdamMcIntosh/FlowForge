using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FlowForge.Api.Endpoints;
using FlowForge.Application.Common.Interfaces;
using FlowForge.Domain.Projects;
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
using Microsoft.Extensions.Hosting;

namespace FlowForge.Tests;

public class ProjectEndpointTests : IClassFixture<ProjectEndpointWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ProjectEndpointTests(ProjectEndpointWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ProjectCrud_WithAuthenticatedOwner_WorksEndToEnd()
    {
        var token = await RegisterAndGetTokenAsync($"project-owner-{Guid.NewGuid():N}@example.com");

        var createResponse = await SendAuthorizedAsync(
            HttpMethod.Post,
            "/projects",
            token,
            new CreateProjectRequest("My Project"));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(created);
        Assert.Equal("My Project", created.Name);

        var listResponse = await SendAuthorizedAsync(HttpMethod.Get, "/projects", token);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listed = await listResponse.Content.ReadFromJsonAsync<List<ProjectResponse>>();
        Assert.NotNull(listed);
        Assert.Single(listed);
        Assert.Equal(created.Id, listed[0].Id);

        var getResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{created.Id}", token);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(fetched);
        Assert.Equal("My Project", fetched.Name);

        var updateResponse = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{created.Id}",
            token,
            new UpdateProjectRequest("Renamed Project"));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await updateResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Renamed Project", updated.Name);

        var deleteResponse = await SendAuthorizedAsync(HttpMethod.Delete, $"/projects/{created.Id}", token);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var missingResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{created.Id}", token);
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);
    }

    [Fact]
    public async Task GetProject_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/projects");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetProject_WhenOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"project-owner-a-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"project-owner-b-{Guid.NewGuid():N}@example.com");

        var createResponse = await SendAuthorizedAsync(
            HttpMethod.Post,
            "/projects",
            ownerToken,
            new CreateProjectRequest("Owner A Project"));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(created);

        var response = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{created.Id}", otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetProject_WhenMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"project-missing-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{Guid.NewGuid()}", token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<string> RegisterAndGetTokenAsync(string email)
    {
        var registerResponse = await _client.PostAsJsonAsync(
            "/register",
            new AuthRequest(email, "SecurePass123!"));

        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        var registered = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(registered);

        return registered.AccessToken;
    }

    private async Task<HttpResponseMessage> SendAuthorizedAsync(
        HttpMethod method,
        string path,
        string token,
        object? body = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await _client.SendAsync(request);
    }
}

public sealed class ProjectEndpointWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public ProjectEndpointWebApplicationFactory()
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
            services.AddScoped<IProjectRepository, ProjectRepository>();
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
                d.ServiceType == typeof(IProjectRepository) ||
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
