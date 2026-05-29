using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FlowForge.Api.Endpoints;
using FlowForge.Application.Common.Interfaces;
using FlowForge.Domain.Projects;
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
using Microsoft.Extensions.Hosting;

namespace FlowForge.Tests;

public class ExceptionHandlingEndpointTests : IClassFixture<ExceptionHandlingWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ExceptionHandlingEndpointTests(ExceptionHandlingWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetMe_WithoutToken_ReturnsProblemDetails()
    {
        var response = await _client.GetAsync("/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await AssertProblemDetails(response, StatusCodes.Status401Unauthorized, "Unauthorized");
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsProblemDetailsWithoutInternalDetails()
    {
        var email = $"dup-problem-{Guid.NewGuid():N}@example.com";

        var first = await _client.PostAsJsonAsync("/register", new AuthRequest(email, "SecurePass123!"));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var duplicate = await _client.PostAsJsonAsync("/register", new AuthRequest(email, "OtherPass456!"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var problem = await ReadProblemDetailsAsync(duplicate);
        Assert.Equal("Duplicate email", problem.Title);
        Assert.Equal("A user with this email already exists.", problem.Detail);
        Assert.DoesNotContain(email, problem.Detail ?? string.Empty);
        AssertNoExceptionLeak(problem, duplicate);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsProblemDetails()
    {
        var email = $"login-problem-{Guid.NewGuid():N}@example.com";

        var register = await _client.PostAsJsonAsync("/register", new AuthRequest(email, "SecurePass123!"));
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        var login = await _client.PostAsJsonAsync("/login", new AuthRequest(email, "WrongPass456!"));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        var problem = await ReadProblemDetailsAsync(login);
        Assert.Equal("Invalid credentials", problem.Title);
        Assert.Equal("Invalid email or password.", problem.Detail);
        AssertNoExceptionLeak(problem, login);
    }

    [Fact]
    public async Task CreateProject_WithEmptyName_ReturnsProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"project-problem-{Guid.NewGuid():N}@example.com");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/projects");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateProjectRequest(""));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemDetails(response, StatusCodes.Status400BadRequest, "Invalid request", "Project name is required.");
    }

    [Fact]
    public async Task GetProject_WhenMissing_ReturnsProblemDetailsWithoutInternalDetails()
    {
        var token = await RegisterAndGetTokenAsync($"missing-project-{Guid.NewGuid():N}@example.com");
        var missingProjectId = Guid.NewGuid();

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/projects/{missingProjectId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var problem = await ReadProblemDetailsAsync(response);
        Assert.Equal("Project not found", problem.Title);
        Assert.Equal("The requested project was not found.", problem.Detail);
        Assert.DoesNotContain(missingProjectId.ToString(), problem.Detail ?? string.Empty);
        AssertNoExceptionLeak(problem, response);
    }

    [Fact]
    public async Task GetProject_WhenOwnedByAnotherUser_ReturnsForbiddenProblemDetails()
    {
        var ownerAToken = await RegisterAndGetTokenAsync($"owner-a-{Guid.NewGuid():N}@example.com");
        var ownerBToken = await RegisterAndGetTokenAsync($"owner-b-{Guid.NewGuid():N}@example.com");

        using var createRequest = new HttpRequestMessage(HttpMethod.Post, "/projects");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ownerAToken);
        createRequest.Content = JsonContent.Create(new CreateProjectRequest("Owner A Project"));

        var createResponse = await _client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(created);

        using var getRequest = new HttpRequestMessage(HttpMethod.Get, $"/projects/{created.Id}");
        getRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ownerBToken);

        var response = await _client.SendAsync(getRequest);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var problem = await ReadProblemDetailsAsync(response);
        Assert.Equal("Forbidden", problem.Title);
        Assert.Equal("You are not authorized to access this project.", problem.Detail);
        AssertNoExceptionLeak(problem, response);
    }

    [Fact]
    public async Task CreateProject_WithDuplicateName_ReturnsConflictProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"dup-project-{Guid.NewGuid():N}@example.com");
        const string projectName = "Duplicate Project";

        using var firstRequest = new HttpRequestMessage(HttpMethod.Post, "/projects");
        firstRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        firstRequest.Content = JsonContent.Create(new CreateProjectRequest(projectName));

        var firstResponse = await _client.SendAsync(firstRequest);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        using var duplicateRequest = new HttpRequestMessage(HttpMethod.Post, "/projects");
        duplicateRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        duplicateRequest.Content = JsonContent.Create(new CreateProjectRequest(projectName));

        var duplicateResponse = await _client.SendAsync(duplicateRequest);

        Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);

        var problem = await ReadProblemDetailsAsync(duplicateResponse);
        Assert.Equal(StatusCodes.Status409Conflict, problem.Status);
        Assert.Equal("Duplicate name", problem.Title);
        Assert.Equal("A resource with this name already exists.", problem.Detail);
        AssertNoExceptionLeak(problem, duplicateResponse);
    }

    [Fact]
    public async Task CreateTask_WithDuplicateName_ReturnsConflictProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"dup-task-{Guid.NewGuid():N}@example.com");
        const string taskName = "Duplicate Task";

        using var createProjectRequest = new HttpRequestMessage(HttpMethod.Post, "/projects");
        createProjectRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        createProjectRequest.Content = JsonContent.Create(new CreateProjectRequest("Task Host Project"));

        var createProjectResponse = await _client.SendAsync(createProjectRequest);
        Assert.Equal(HttpStatusCode.Created, createProjectResponse.StatusCode);

        var project = await createProjectResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(project);

        using var firstTaskRequest = new HttpRequestMessage(HttpMethod.Post, $"/projects/{project.Id}/tasks");
        firstTaskRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        firstTaskRequest.Content = JsonContent.Create(new CreateTaskRequest(taskName));

        var firstTaskResponse = await _client.SendAsync(firstTaskRequest);
        Assert.Equal(HttpStatusCode.Created, firstTaskResponse.StatusCode);

        using var duplicateTaskRequest = new HttpRequestMessage(HttpMethod.Post, $"/projects/{project.Id}/tasks");
        duplicateTaskRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        duplicateTaskRequest.Content = JsonContent.Create(new CreateTaskRequest(taskName));

        var duplicateTaskResponse = await _client.SendAsync(duplicateTaskRequest);

        Assert.Equal(HttpStatusCode.Conflict, duplicateTaskResponse.StatusCode);

        var problem = await ReadProblemDetailsAsync(duplicateTaskResponse);
        Assert.Equal(StatusCodes.Status409Conflict, problem.Status);
        Assert.Equal("Duplicate name", problem.Title);
        Assert.Equal("A resource with this name already exists.", problem.Detail);
        AssertNoExceptionLeak(problem, duplicateTaskResponse);
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

    private static async Task AssertProblemDetails(
        HttpResponseMessage response,
        int expectedStatus,
        string expectedTitle,
        string? expectedDetail = null)
    {
        var problem = await ReadProblemDetailsAsync(response);
        Assert.Equal(expectedStatus, problem.Status);
        Assert.Equal(expectedTitle, problem.Title);

        if (expectedDetail is not null)
        {
            Assert.Equal(expectedDetail, problem.Detail);
        }

        AssertNoExceptionLeak(problem, response);
    }

    private static async Task<ProblemDetails> ReadProblemDetailsAsync(HttpResponseMessage response)
    {
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        return problem;
    }

    private static void AssertNoExceptionLeak(ProblemDetails problem, HttpResponseMessage response)
    {
        var serialized = JsonSerializer.Serialize(problem);
        Assert.DoesNotContain("StackTrace", serialized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(" at ", serialized);
        Assert.True(problem.Extensions.ContainsKey("traceId") || response.Headers.Contains("trace-id"));
    }
}

public sealed class ExceptionHandlingWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public ExceptionHandlingWebApplicationFactory()
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
        builder.UseSetting("RateLimiting:PermitLimit", "10000");
        builder.UseSetting("RateLimiting:WindowSeconds", "60");

        builder.ConfigureTestServices(services =>
        {
            RemoveEfCoreRegistrations(services);

            services.AddDbContext<FlowForgeDbContext>(options => options.UseSqlite(_connection));
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IProjectRepository, ProjectRepository>();
            services.AddScoped<FlowForge.Domain.Tasks.ITaskRepository, TaskRepository>();
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
                d.ServiceType == typeof(FlowForge.Domain.Tasks.ITaskRepository) ||
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
