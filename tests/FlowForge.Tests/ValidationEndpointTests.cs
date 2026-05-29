using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FlowForge.Api.Endpoints;
using FlowForge.Domain.Projects;
using DomainTask = FlowForge.Domain.Tasks.Task;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowForge.Tests;

public class ValidationEndpointTests : IClassFixture<ExceptionHandlingWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ValidationEndpointTests(ExceptionHandlingWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_WithEmptyEmail_ReturnsProblemDetails()
    {
        var response = await _client.PostAsJsonAsync(
            "/register",
            new AuthRequest("", "SecurePass123!"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.Status);
        Assert.Equal("Invalid request", problem.Title);
        Assert.Equal("Email is required.", problem.Detail);
    }

    [Fact]
    public async Task Login_WithInvalidEmailFormat_ReturnsProblemDetails()
    {
        var response = await _client.PostAsJsonAsync(
            "/login",
            new AuthRequest("not-an-email", "SecurePass123!"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.Status);
        Assert.Equal("Invalid request", problem.Title);
        Assert.Equal("Email address format is invalid.", problem.Detail);
    }

    [Fact]
    public async Task Register_WithEmptyPassword_ReturnsProblemDetails()
    {
        var response = await _client.PostAsJsonAsync(
            "/register",
            new AuthRequest($"empty-pass-{Guid.NewGuid():N}@example.com", ""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal("Password is required.", problem.Detail);
    }

    [Fact]
    public async Task Register_WithWeakPassword_ReturnsProblemDetails()
    {
        var response = await _client.PostAsJsonAsync(
            "/register",
            new AuthRequest($"weak-pass-{Guid.NewGuid():N}@example.com", "short"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.Status);
        Assert.Equal("Invalid request", problem.Title);
        Assert.Equal("Password must be at least 12 characters long.", problem.Detail);
    }

    [Fact]
    public async Task CreateProject_WithNameTooLong_ReturnsProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"project-long-{Guid.NewGuid():N}@example.com");
        var tooLongName = new string('a', Project.MaxNameLength + 1);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/projects");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateProjectRequest(tooLongName));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.Status);
        Assert.Equal("Invalid request", problem.Title);
        Assert.Equal("Project name is too long.", problem.Detail);
    }

    [Fact]
    public async Task UpdateProject_WithWhitespaceName_ReturnsProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"project-whitespace-{Guid.NewGuid():N}@example.com");

        using var createRequest = new HttpRequestMessage(HttpMethod.Post, "/projects");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        createRequest.Content = JsonContent.Create(new CreateProjectRequest("Valid Project"));

        var createResponse = await _client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(created);

        using var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/projects/{created.Id}");
        updateRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        updateRequest.Content = JsonContent.Create(new UpdateProjectRequest("   "));

        var response = await _client.SendAsync(updateRequest);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal("Project name is required.", problem.Detail);
    }

    [Fact]
    public async Task CreateTask_WithNameTooLong_ReturnsProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"task-long-{Guid.NewGuid():N}@example.com");
        var projectId = await CreateProjectAndGetIdAsync(token);
        var tooLongName = new string('b', DomainTask.MaxNameLength + 1);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"/projects/{projectId}/tasks");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateTaskRequest(tooLongName));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status400BadRequest, problem.Status);
        Assert.Equal("Invalid request", problem.Title);
        Assert.Equal("Task name is too long.", problem.Detail);
    }

    [Fact]
    public async Task UpdateTask_WithEmptyName_ReturnsProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"task-empty-{Guid.NewGuid():N}@example.com");
        var projectId = await CreateProjectAndGetIdAsync(token);
        var taskId = await CreateTaskAndGetIdAsync(token, projectId, "Valid Task");

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/projects/{projectId}/tasks/{taskId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new UpdateTaskRequest(""));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal("Task name is required.", problem.Detail);
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

    private async Task<Guid> CreateProjectAndGetIdAsync(string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/projects");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateProjectRequest("Host Project"));

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var project = await response.Content.ReadFromJsonAsync<ProjectResponse>();
        Assert.NotNull(project);

        return project.Id;
    }

    private async Task<Guid> CreateTaskAndGetIdAsync(string token, Guid projectId, string name)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/projects/{projectId}/tasks");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateTaskRequest(name));

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var task = await response.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(task);

        return task.Id;
    }
}
