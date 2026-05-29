using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlowForge.Api.Exceptions;
using FlowForge.Api.Logging;
using FlowForge.Api.RateLimiting;
using FlowForge.Api.Validation;
using FlowForge.Application.Tasks;
using FlowForge.Domain.Users;
using FluentValidation;
using Swashbuckle.AspNetCore.Annotations;
using DomainTask = FlowForge.Domain.Tasks.Task;

namespace FlowForge.Api.Endpoints;

public static class TaskEndpoints
{
    public static RouteGroupBuilder MapTaskEndpoints(this WebApplication app)
    {
        var tasks = app.MapGroup("/projects/{projectId:guid}/tasks")
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.FixedWindow)
            .WithTags("Tasks");

        tasks.MapPost("/", CreateTaskAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Create a task",
                description: "Creates a task in the specified project when the authenticated user owns the project."));

        tasks.MapGet("/", ListTasksAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "List tasks",
                description: "Returns all tasks in the specified project when the authenticated user owns the project."));

        tasks.MapGet("/{taskId:guid}", GetTaskByIdAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Get a task by id",
                description: "Returns a single task when it exists in the owned project."));

        tasks.MapPut("/{taskId:guid}", UpdateTaskAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Update a task",
                description: "Renames a task in the specified project when the authenticated user owns the project."));

        tasks.MapDelete("/{taskId:guid}", DeleteTaskAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Delete a task",
                description: "Deletes a task from the specified project when the authenticated user owns the project."));

        return tasks;
    }

    private static async Task<IResult> CreateTaskAsync(
        Guid projectId,
        CreateTaskRequest request,
        ClaimsPrincipal user,
        IValidator<CreateTaskRequest> validator,
        ITaskService taskService,
        ILogger<TaskEndpointLogs> logger,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        var validationResult = await validator.ValidateAsync(request, cancellationToken);
        if (validationResult.ToProblemDetailsResult() is { } validationError)
        {
            return validationError;
        }

        var task = await taskService.CreateAsync(projectId, ownerIdResult.OwnerId!, request.Name, cancellationToken);
        logger.LogInformation(
            "Create task endpoint succeeded for {TaskId} in project {ProjectId} and owner {OwnerId}",
            task.Id,
            projectId,
            ownerIdResult.OwnerId!.Value);
        return Results.Created($"/projects/{projectId}/tasks/{task.Id}", ToResponse(task));
    }

    private static async Task<IResult> ListTasksAsync(
        Guid projectId,
        ClaimsPrincipal user,
        ITaskService taskService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        var tasks = await taskService.GetAllAsync(projectId, ownerIdResult.OwnerId!, cancellationToken);
        return Results.Ok(tasks.Select(ToResponse));
    }

    private static async Task<IResult> GetTaskByIdAsync(
        Guid projectId,
        Guid taskId,
        ClaimsPrincipal user,
        ITaskService taskService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        var task = await taskService.GetByIdAsync(projectId, taskId, ownerIdResult.OwnerId!, cancellationToken);
        return Results.Ok(ToResponse(task));
    }

    private static async Task<IResult> UpdateTaskAsync(
        Guid projectId,
        Guid taskId,
        UpdateTaskRequest request,
        ClaimsPrincipal user,
        IValidator<UpdateTaskRequest> validator,
        ITaskService taskService,
        ILogger<TaskEndpointLogs> logger,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        var validationResult = await validator.ValidateAsync(request, cancellationToken);
        if (validationResult.ToProblemDetailsResult() is { } validationError)
        {
            return validationError;
        }

        var task = await taskService.UpdateAsync(
            projectId,
            taskId,
            ownerIdResult.OwnerId!,
            request.Name,
            cancellationToken);
        logger.LogInformation(
            "Update task endpoint succeeded for {TaskId} in project {ProjectId} and owner {OwnerId}",
            task.Id,
            projectId,
            ownerIdResult.OwnerId!.Value);
        return Results.Ok(ToResponse(task));
    }

    private static async Task<IResult> DeleteTaskAsync(
        Guid projectId,
        Guid taskId,
        ClaimsPrincipal user,
        ITaskService taskService,
        ILogger<TaskEndpointLogs> logger,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        await taskService.DeleteAsync(projectId, taskId, ownerIdResult.OwnerId!, cancellationToken);
        logger.LogInformation(
            "Delete task endpoint succeeded for {TaskId} in project {ProjectId} and owner {OwnerId}",
            taskId,
            projectId,
            ownerIdResult.OwnerId!.Value);
        return Results.NoContent();
    }

    private static TaskResponse ToResponse(DomainTask task) =>
        new(task.Id, task.ProjectId.Value, task.Name, task.CreatedAt, task.UpdatedAt);

    private static (UserId? OwnerId, IResult? Error) TryGetOwnerId(ClaimsPrincipal user)
    {
        var subClaim = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(subClaim) || !Guid.TryParse(subClaim, out var userId))
        {
            return (null, ProblemDetailsResults.Unauthorized("The access token is missing a valid subject claim."));
        }

        return (UserId.From(userId), null);
    }
}

/// <summary>
/// Request body for creating a task.
/// </summary>
/// <param name="Name">Display name of the task.</param>
public sealed record CreateTaskRequest(string Name);

/// <summary>
/// Request body for updating a task.
/// </summary>
/// <param name="Name">Updated display name of the task.</param>
public sealed record UpdateTaskRequest(string Name);

/// <summary>
/// Task resource returned by task endpoints.
/// </summary>
/// <param name="Id">Unique identifier of the task.</param>
/// <param name="ProjectId">Unique identifier of the parent project.</param>
/// <param name="Name">Display name of the task.</param>
/// <param name="CreatedAt">UTC timestamp when the task was created.</param>
/// <param name="UpdatedAt">UTC timestamp when the task was last updated.</param>
public sealed record TaskResponse(
    Guid Id,
    Guid ProjectId,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
