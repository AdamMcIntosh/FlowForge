using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlowForge.Application.Projects;
using FlowForge.Application.Tasks;
using FlowForge.Domain.Users;
using Microsoft.AspNetCore.Mvc;
using DomainTask = FlowForge.Domain.Tasks.Task;

namespace FlowForge.Api.Endpoints;

public static class TaskEndpoints
{
    public static RouteGroupBuilder MapTaskEndpoints(this WebApplication app)
    {
        var tasks = app.MapGroup("/projects/{projectId:guid}/tasks")
            .RequireAuthorization();

        tasks.MapPost("/", CreateTaskAsync);
        tasks.MapGet("/", ListTasksAsync);
        tasks.MapGet("/{taskId:guid}", GetTaskByIdAsync);
        tasks.MapPut("/{taskId:guid}", UpdateTaskAsync);
        tasks.MapDelete("/{taskId:guid}", DeleteTaskAsync);

        return tasks;
    }

    private static async Task<IResult> CreateTaskAsync(
        Guid projectId,
        CreateTaskRequest request,
        ClaimsPrincipal user,
        ITaskService taskService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Task name is required.");
        }

        try
        {
            var task = await taskService.CreateAsync(projectId, ownerIdResult.OwnerId!, request.Name, cancellationToken);
            return Results.Created($"/projects/{projectId}/tasks/{task.Id}", ToResponse(task));
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message, "Project not found");
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
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

        try
        {
            var tasks = await taskService.GetAllAsync(projectId, ownerIdResult.OwnerId!, cancellationToken);
            return Results.Ok(tasks.Select(ToResponse));
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message, "Project not found");
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
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

        try
        {
            var task = await taskService.GetByIdAsync(projectId, taskId, ownerIdResult.OwnerId!, cancellationToken);
            return Results.Ok(ToResponse(task));
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message, "Project not found");
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
        catch (TaskNotFoundException ex)
        {
            return NotFound(ex.Message, "Task not found");
        }
    }

    private static async Task<IResult> UpdateTaskAsync(
        Guid projectId,
        Guid taskId,
        UpdateTaskRequest request,
        ClaimsPrincipal user,
        ITaskService taskService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Task name is required.");
        }

        try
        {
            var task = await taskService.UpdateAsync(
                projectId,
                taskId,
                ownerIdResult.OwnerId!,
                request.Name,
                cancellationToken);
            return Results.Ok(ToResponse(task));
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message, "Project not found");
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
        catch (TaskNotFoundException ex)
        {
            return NotFound(ex.Message, "Task not found");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> DeleteTaskAsync(
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

        try
        {
            await taskService.DeleteAsync(projectId, taskId, ownerIdResult.OwnerId!, cancellationToken);
            return Results.NoContent();
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message, "Project not found");
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
        catch (TaskNotFoundException ex)
        {
            return NotFound(ex.Message, "Task not found");
        }
    }

    private static TaskResponse ToResponse(DomainTask task) =>
        new(task.Id, task.ProjectId.Value, task.Name, task.CreatedAt, task.UpdatedAt);

    private static (UserId? OwnerId, IResult? Error) TryGetOwnerId(ClaimsPrincipal user)
    {
        var subClaim = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(subClaim) || !Guid.TryParse(subClaim, out var userId))
        {
            return (null, Results.Json(
                new ProblemDetails
                {
                    Title = "Unauthorized",
                    Detail = "The access token is missing a valid subject claim.",
                    Status = StatusCodes.Status401Unauthorized,
                },
                statusCode: StatusCodes.Status401Unauthorized));
        }

        return (UserId.From(userId), null);
    }

    private static IResult BadRequest(string detail) =>
        Results.BadRequest(new ProblemDetails
        {
            Title = "Invalid request",
            Detail = detail,
            Status = StatusCodes.Status400BadRequest,
        });

    private static IResult NotFound(string detail, string title) =>
        Results.NotFound(new ProblemDetails
        {
            Title = title,
            Detail = detail,
            Status = StatusCodes.Status404NotFound,
        });

    private static IResult Forbidden(string detail) =>
        Results.Json(
            new ProblemDetails
            {
                Title = "Forbidden",
                Detail = detail,
                Status = StatusCodes.Status403Forbidden,
            },
            statusCode: StatusCodes.Status403Forbidden);
}

public sealed record CreateTaskRequest(string Name);

public sealed record UpdateTaskRequest(string Name);

public sealed record TaskResponse(
    Guid Id,
    Guid ProjectId,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
