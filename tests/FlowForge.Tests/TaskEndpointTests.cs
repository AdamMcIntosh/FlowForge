// HTTP integration tests for task CRUD and project ownership authorization.
// Setup: WebApplicationFactory with SQLite in-memory (see TaskEndpointWebApplicationFactory).
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FlowForge.Api.Endpoints;
using DomainTask = FlowForge.Domain.Tasks.Task;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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

public sealed class TaskEndpointTests : IClassFixture<TaskEndpointWebApplicationFactory>
{
    private readonly HttpClient _client;

    public TaskEndpointTests(TaskEndpointWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task TaskCrud_WithAuthenticatedOwner_WorksEndToEnd()
    {
        var token = await RegisterAndGetTokenAsync($"task-owner-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Task Host");

        var createResponse = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("My Task"));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(created);
        Assert.Equal("My Task", created.Name);
        Assert.Equal(project.Id, created.ProjectId);

        var listResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}/tasks", token);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listed = await listResponse.Content.ReadFromJsonAsync<List<TaskResponse>>();
        Assert.NotNull(listed);
        Assert.Single(listed);
        Assert.Equal(created.Id, listed[0].Id);

        var getResponse = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{created.Id}",
            token);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(fetched);
        Assert.Equal("My Task", fetched.Name);

        var updateResponse = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}/tasks/{created.Id}",
            token,
            new UpdateTaskRequest("Renamed Task"));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await updateResponse.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Renamed Task", updated.Name);
        Assert.Equal(created.Id, updated.Id);

        var deleteResponse = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{project.Id}/tasks/{created.Id}",
            token);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var missingResponse = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{created.Id}",
            token);
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);
    }

    [Fact]
    public async Task ListTasks_ReturnsOnlyTasksInProject()
    {
        var token = await RegisterAndGetTokenAsync($"task-list-{Guid.NewGuid():N}@example.com");
        var projectA = await CreateProjectAsync(token, "Project A");
        var projectB = await CreateProjectAsync(token, "Project B");

        var taskInA = await CreateTaskAsync(token, projectA.Id, "Only A");
        await CreateTaskAsync(token, projectB.Id, "Only B");

        var listResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{projectA.Id}/tasks", token);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listed = await listResponse.Content.ReadFromJsonAsync<List<TaskResponse>>();
        Assert.NotNull(listed);
        Assert.Single(listed);
        Assert.Equal(taskInA.Id, listed[0].Id);
        Assert.Equal("Only A", listed[0].Name);
    }

    [Theory]
    [InlineData("POST", "/projects/00000000-0000-0000-0000-000000000001/tasks")]
    [InlineData("GET", "/projects/00000000-0000-0000-0000-000000000001/tasks")]
    [InlineData("GET", "/projects/00000000-0000-0000-0000-000000000001/tasks/00000000-0000-0000-0000-000000000002")]
    [InlineData("PUT", "/projects/00000000-0000-0000-0000-000000000001/tasks/00000000-0000-0000-0000-000000000002")]
    [InlineData("DELETE", "/projects/00000000-0000-0000-0000-000000000001/tasks/00000000-0000-0000-0000-000000000002")]
    public async Task TaskEndpoints_WithoutToken_ReturnUnauthorized(string method, string path)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);

        if (method is "POST" or "PUT")
        {
            request.Content = JsonContent.Create(new CreateTaskRequest("Unauthorized Attempt"));
        }

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateTask_WithEmptyName_ReturnsBadRequest()
    {
        var token = await RegisterAndGetTokenAsync($"task-empty-create-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("   "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTask_WithEmptyName_ReturnsBadRequest()
    {
        var token = await RegisterAndGetTokenAsync($"task-empty-update-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");
        var task = await CreateTaskAsync(token, project.Id, "Valid Name");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}/tasks/{task.Id}",
            token,
            new UpdateTaskRequest(""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetTask_WhenProjectOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"task-owner-a-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"task-owner-b-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");
        var task = await CreateTaskAsync(ownerToken, project.Id, "Private Task");

        var response = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{task.Id}",
            otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateTask_WhenProjectOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"task-create-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"task-create-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            otherToken,
            new CreateTaskRequest("Intruder Task"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var ownerList = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}/tasks", ownerToken);
        var tasks = await ownerList.Content.ReadFromJsonAsync<List<TaskResponse>>();
        Assert.NotNull(tasks);
        Assert.Empty(tasks);
    }

    [Fact]
    public async Task UpdateTask_WhenProjectOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"task-update-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"task-update-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");
        var task = await CreateTaskAsync(ownerToken, project.Id, "Original");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}/tasks/{task.Id}",
            otherToken,
            new UpdateTaskRequest("Stolen Rename"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var ownerView = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{task.Id}",
            ownerToken);
        var unchanged = await ownerView.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(unchanged);
        Assert.Equal("Original", unchanged.Name);
    }

    [Fact]
    public async Task DeleteTask_WhenProjectOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"task-delete-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"task-delete-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");
        var task = await CreateTaskAsync(ownerToken, project.Id, "Protected");

        var response = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{project.Id}/tasks/{task.Id}",
            otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var ownerView = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{task.Id}",
            ownerToken);
        Assert.Equal(HttpStatusCode.OK, ownerView.StatusCode);
    }

    [Fact]
    public async Task ListTasks_WhenProjectOwnedByAnotherUser_ReturnsForbidden()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"task-list-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"task-list-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");
        await CreateTaskAsync(ownerToken, project.Id, "Private");

        var response = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks",
            otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTask_WhenTaskBelongsToDifferentProject_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-cross-get-{Guid.NewGuid():N}@example.com");
        var projectA = await CreateProjectAsync(token, "A");
        var projectB = await CreateProjectAsync(token, "B");
        var taskInA = await CreateTaskAsync(token, projectA.Id, "In A");

        var response = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{projectB.Id}/tasks/{taskInA.Id}",
            token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTask_WhenTaskBelongsToDifferentProject_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-cross-update-{Guid.NewGuid():N}@example.com");
        var projectA = await CreateProjectAsync(token, "A");
        var projectB = await CreateProjectAsync(token, "B");
        var taskInA = await CreateTaskAsync(token, projectA.Id, "In A");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{projectB.Id}/tasks/{taskInA.Id}",
            token,
            new UpdateTaskRequest("Wrong Project"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var ownerView = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{projectA.Id}/tasks/{taskInA.Id}",
            token);
        var unchanged = await ownerView.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(unchanged);
        Assert.Equal("In A", unchanged.Name);
    }

    [Fact]
    public async Task DeleteTask_WhenTaskBelongsToDifferentProject_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-cross-delete-{Guid.NewGuid():N}@example.com");
        var projectA = await CreateProjectAsync(token, "A");
        var projectB = await CreateProjectAsync(token, "B");
        var taskInA = await CreateTaskAsync(token, projectA.Id, "In A");

        var response = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{projectB.Id}/tasks/{taskInA.Id}",
            token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var ownerView = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{projectA.Id}/tasks/{taskInA.Id}",
            token);
        Assert.Equal(HttpStatusCode.OK, ownerView.StatusCode);
    }

    [Fact]
    public async Task GetTask_WhenProjectMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-missing-project-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{Guid.NewGuid()}/tasks/{Guid.NewGuid()}",
            token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetTask_WhenTaskMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-missing-task-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{Guid.NewGuid()}",
            token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListTasks_WhenProjectHasNoTasks_ReturnsEmptyList()
    {
        var token = await RegisterAndGetTokenAsync($"task-empty-list-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Empty Host");

        var response = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}/tasks", token);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var listed = await response.Content.ReadFromJsonAsync<List<TaskResponse>>();
        Assert.NotNull(listed);
        Assert.Empty(listed);
    }

    [Fact]
    public async Task CreateTask_TrimsLeadingAndTrailingWhitespace()
    {
        var token = await RegisterAndGetTokenAsync($"task-trim-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("  Trimmed Task  "));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(created);
        Assert.Equal("Trimmed Task", created.Name);
    }

    [Fact]
    public async Task CreateTask_ReturnsLocationHeaderForCreatedResource()
    {
        var token = await RegisterAndGetTokenAsync($"task-location-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("Location Task"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        Assert.Contains($"/projects/{project.Id}/tasks/", response.Headers.Location!.ToString(), StringComparison.Ordinal);

        var created = await response.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(created);
        Assert.EndsWith(created.Id.ToString(), response.Headers.Location!.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Bearer")]
    [InlineData("Bearer not-a-valid-jwt")]
    public async Task TaskEndpoints_WithInvalidBearer_ReturnUnauthorized(string authorization)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/projects/00000000-0000-0000-0000-000000000001/tasks");
        request.Headers.TryAddWithoutValidation("Authorization", authorization);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTask_WhenMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-missing-update-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}/tasks/{Guid.NewGuid()}",
            token,
            new UpdateTaskRequest("Ghost"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTask_WhenProjectMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-missing-project-update-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{Guid.NewGuid()}/tasks/{Guid.NewGuid()}",
            token,
            new UpdateTaskRequest("Ghost"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTask_WhenMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-missing-delete-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{project.Id}/tasks/{Guid.NewGuid()}",
            token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListTasks_WhenProjectMissing_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-missing-project-list-{Guid.NewGuid():N}@example.com");

        var response = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{Guid.NewGuid()}/tasks", token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTask_WhenAlreadyDeleted_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-double-delete-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");
        var task = await CreateTaskAsync(token, project.Id, "Disposable");

        var firstDelete = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{project.Id}/tasks/{task.Id}",
            token);
        Assert.Equal(HttpStatusCode.NoContent, firstDelete.StatusCode);

        var secondDelete = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{project.Id}/tasks/{task.Id}",
            token);
        Assert.Equal(HttpStatusCode.NotFound, secondDelete.StatusCode);
    }

    [Fact]
    public async Task ListTasks_ReturnsMultipleTasksInProject()
    {
        var token = await RegisterAndGetTokenAsync($"task-multi-list-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var first = await CreateTaskAsync(token, project.Id, "First");
        var second = await CreateTaskAsync(token, project.Id, "Second");

        var listResponse = await SendAuthorizedAsync(HttpMethod.Get, $"/projects/{project.Id}/tasks", token);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listed = await listResponse.Content.ReadFromJsonAsync<List<TaskResponse>>();
        Assert.NotNull(listed);
        Assert.Equal(2, listed.Count);
        Assert.Contains(listed, t => t.Id == first.Id && t.Name == "First");
        Assert.Contains(listed, t => t.Id == second.Id && t.Name == "Second");
    }

    [Fact]
    public async Task GetTask_WhenProjectOwnedByAnotherUser_ReturnsForbiddenProblemDetails()
    {
        var ownerToken = await RegisterAndGetTokenAsync($"task-problem-owner-{Guid.NewGuid():N}@example.com");
        var otherToken = await RegisterAndGetTokenAsync($"task-problem-other-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(ownerToken, "Owner Project");
        var task = await CreateTaskAsync(ownerToken, project.Id, "Private Task");

        var response = await SendAuthorizedAsync(
            HttpMethod.Get,
            $"/projects/{project.Id}/tasks/{task.Id}",
            otherToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status403Forbidden, problem.Status);
        Assert.Equal("Forbidden", problem.Title);
        Assert.Equal("You are not authorized to access this project.", problem.Detail);
    }

    [Fact]
    public async Task CreateTask_WithNameTooLong_ReturnsBadRequest()
    {
        var token = await RegisterAndGetTokenAsync($"task-too-long-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");
        var tooLongName = new string('b', DomainTask.MaxNameLength + 1);

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest(tooLongName));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTask_TrimsLeadingAndTrailingWhitespace()
    {
        var token = await RegisterAndGetTokenAsync($"task-update-trim-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");
        var task = await CreateTaskAsync(token, project.Id, "Original");

        var response = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}/tasks/{task.Id}",
            token,
            new UpdateTaskRequest("  Trimmed Update  "));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updated = await response.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Trimmed Update", updated.Name);
    }

    [Fact]
    public async Task UpdateTask_WhenAlreadyDeleted_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-update-deleted-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");
        var task = await CreateTaskAsync(token, project.Id, "Gone Soon");

        var deleteResponse = await SendAuthorizedAsync(
            HttpMethod.Delete,
            $"/projects/{project.Id}/tasks/{task.Id}",
            token);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updateResponse = await SendAuthorizedAsync(
            HttpMethod.Put,
            $"/projects/{project.Id}/tasks/{task.Id}",
            token,
            new UpdateTaskRequest("Too Late"));

        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);
    }

    [Fact]
    public async Task CreateTask_WhenProjectWasDeleted_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync($"task-deleted-project-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Ephemeral Host");

        var deleteProject = await SendAuthorizedAsync(HttpMethod.Delete, $"/projects/{project.Id}", token);
        Assert.Equal(HttpStatusCode.NoContent, deleteProject.StatusCode);

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("Orphan Task"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateTask_ResponseIncludesTimestamps()
    {
        var token = await RegisterAndGetTokenAsync($"task-timestamps-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Host");

        var response = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("Timestamped"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<TaskResponse>();
        Assert.NotNull(created);
        Assert.NotEqual(default, created.CreatedAt);
        Assert.NotEqual(default, created.UpdatedAt);
        Assert.True(created.UpdatedAt >= created.CreatedAt);
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

    private async Task<TaskResponse> CreateTaskAsync(string token, Guid projectId, string name)
    {
        var createResponse = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{projectId}/tasks",
            token,
            new CreateTaskRequest(name));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<TaskResponse>();
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

public sealed class TaskCreateRateLimitTests : IClassFixture<TaskCreateRateLimitWebApplicationFactory>
{
    private readonly HttpClient _client;

    public TaskCreateRateLimitTests(TaskCreateRateLimitWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateTask_ExceedingPermitLimit_ReturnsTooManyRequestsWithProblemDetails()
    {
        var token = await RegisterAndGetTokenAsync($"task-rate-{Guid.NewGuid():N}@example.com");
        var project = await CreateProjectAsync(token, "Rate Host");

        var first = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("Rate Task A"));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("Rate Task B"));
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);

        var limited = await SendAuthorizedAsync(
            HttpMethod.Post,
            $"/projects/{project.Id}/tasks",
            token,
            new CreateTaskRequest("Rate Task C"));
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);

        var problem = await limited.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(StatusCodes.Status429TooManyRequests, problem.Status);
        Assert.Equal("Too many requests", problem.Title);
        Assert.Equal("Rate limit exceeded. Please try again later.", problem.Detail);
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

public sealed class TaskCreateRateLimitWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public TaskCreateRateLimitWebApplicationFactory()
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
            TaskEndpointWebApplicationFactory.RemoveEfCoreRegistrations(services);

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
}

public sealed class TaskEndpointWebApplicationFactory : WebApplicationFactory<Program>, IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    public TaskEndpointWebApplicationFactory()
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

    internal static void RemoveEfCoreRegistrations(IServiceCollection services)
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
