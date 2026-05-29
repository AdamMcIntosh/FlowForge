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
        Assert.NotEqual(Guid.Empty, created.OwnerId);

        var listResponse = await SendAuthorizedAsync(HttpMethod.Get, "/projects", token);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listed = await listResponse.Content.ReadFromJsonAsync<List<ProjectResponse>>();
        Assert.NotNull(listed);
        Assert.Single(listed);
        Assert.Equal(created.Id, listed[0].Id);
        Assert.Equal(created.OwnerId, listed[0].OwnerId);

        var getResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{created.Id}", token);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(fetched);
        Assert.Equal("My Project", fetched.Name);
        Assert.Equal(created.OwnerId, fetched.OwnerId);

        var updateResponse = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{created.Id}",
            token,
            new UpdateProjectRequest("Renamed Project"));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await updateResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Renamed Project", updated.Name);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(created.OwnerId, updated.OwnerId);

        var deleteResponse = await SendAuthorizedAsync(HttpMethod.Delete, $"/projects/{created.Id}", token);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var missingResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{created.Id}", token);
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);
    }

    [Fact]
    public async Task ListProjects_ReturnsOnlyProjectsOwnedByAuthenticatedUser()
    {
        var ownerAToken = await RegisterAndGetTokenAsync($"project-owner-a-{Guid.NewGuid():N}@example.com");
        var ownerBToken = await RegisterAndGetTokenAsync($"project-owner-b-{Guid.NewGuid():N}@example.com");

        var ownerAProject = await CreateProjectAsync(ownerAToken, "Owner A Project");
        var ownerBProject = await CreateProjectAsync(ownerBToken, "Owner B Project");

        var ownerAListResponse = await SendAuthorizedAsync(HttpMethod.Get, "/projects", ownerAToken);
        Assert.Equal(HttpStatusCode.OK, ownerAListResponse.StatusCode);

        var ownerAList = await ownerAListResponse.Content.ReadFromJsonAsync<List<ProjectResponse>>();
        Assert.NotNull(ownerAList);
        Assert.Single(ownerAList);
        Assert.Equal(ownerAProject.Id, ownerAList[0].Id);
        Assert.Equal(ownerAProject.OwnerId, ownerAList[0].OwnerId);

        var ownerBListResponse = await SendAuthorizedAsync(HttpMethod.Get, "/projects", ownerBToken);
        Assert.Equal(HttpStatusCode.OK, ownerBListResponse.StatusCode);

        var ownerBList = await ownerBListResponse.Content.ReadFromJsonAsync<List<ProjectResponse>>();
        Assert.NotNull(ownerBList);
        Assert.Single(ownerBList);
        Assert.Equal(ownerBProject.Id, ownerBList[0].Id);
        Assert.Equal(ownerBProject.OwnerId, ownerBList[0].OwnerId);
        Assert.NotEqual(ownerAProject.OwnerId, ownerBProject.OwnerId);
    }

    [Theory]
    [InlineData("POST", "/projects")]
    [InlineData("GET", "/projects")]
    [InlineData("GET", "/projects/00000000-0000-0000-0000-000000000001")]
    [InlineData("PUT", "/projects/00000000-0000-0000-0000-000000000001")]
    [InlineData("DELETE", "/projects/00000000-0000-0000-0000-000000000001")]
    public async Task ProjectEndpoints_WithoutToken_ReturnUnauthorized(string method, string path)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);

        if (method is "POST" or "PUT")
        {
            request.Content = JsonContent.Create(new CreateProjectRequest("Unauthorized Attempt"));
        }

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateProject_WithEmptyName_ReturnsBadRequest()
    {
        var token = await RegisterAndGetTokenAsync($"project-empty-create-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            "/projects",
            token,
            new CreateProjectRequest("   "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProject_WithEmptyName_ReturnsBadRequest()
    {
        var token = await RegisterAndGetTokenAsync($"project-empty-update-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Valid Name");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}",
            token,
            new UpdateProjectRequest(""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetProject_WhenOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"project-owner-a-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"project-owner-b-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner A Project");

        var response = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}", otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProject_WhenOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"project-update-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"project-update-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}",
            otherToken,
            new UpdateProjectRequest("Stolen Rename"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var ownerView = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}", ownerToken);
        var unchanged = await ownerView.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(unchanged);
        Assert.Equal("Owner Project", unchanged.Name);
    }

    [Fact]
    public async Task DeleteProject_WhenOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"project-delete-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"project-delete-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Protected Project");

        var response = await SendAuthorizedAsync(HttpMethod.Delete, $"/projects/{project.Id}", otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var ownerView = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}", ownerToken);
        Assert.Equal(HttpStatusCode.OK, ownerView.StatusCode);
    }

    [Fact]
    public async Task GetProject_WhenMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"project-missing-get-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{Guid.NewGuid()}", token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProject_WhenMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"project-missing-update-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{Guid.NewGuid()}",
            token,
            new UpdateProjectRequest("Ghost Project"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteProject_WhenMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"project-missing-delete-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(HttpMethod.Delete, $"/projects/{Guid.NewGuid()}", token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<ProjectResponse> CreateProjectAsync(string token, string name)
    {
        var createResponse = await SendAuthorizedAsync(
            HttpMethod.Post,
            "/projects",
            token,
            new CreateProjectRequest(name));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(created);

        return created;
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
