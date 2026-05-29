using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlowForge.Application.Projects;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using Microsoft.AspNetCore.Mvc;

namespace FlowForge.Api.Endpoints;

public static class ProjectEndpoints
{
    public static RouteGroupBuilder MapProjectEndpoints(this WebApplication app)
    {
        var projects = app.MapGroup("/projects")
            .RequireAuthorization();

        projects.MapPost("/", CreateProjectAsync);
        projects.MapGet("/", ListProjectsAsync);
        projects.MapGet("/{id:guid}", GetProjectByIdAsync);
        projects.MapPut("/{id:guid}", UpdateProjectAsync);
        projects.MapDelete("/{id:guid}", DeleteProjectAsync);

        return projects;
    }

    private static async Task<IResult> CreateProjectAsync(
        CreateProjectRequest request,
        ClaimsPrincipal user,
        IProjectService projectService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Project name is required.");
        }

        try
        {
            var project = await projectService.CreateAsync(ownerIdResult.OwnerId!, request.Name, cancellationToken);
            return Results.Created($"/projects/{project.Id}", ToResponse(project));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> ListProjectsAsync(
        ClaimsPrincipal user,
        IProjectService projectService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        var projects = await projectService.GetAllAsync(ownerIdResult.OwnerId!, cancellationToken);
        return Results.Ok(projects.Select(ToResponse));
    }

    private static async Task<IResult> GetProjectByIdAsync(
        Guid id,
        ClaimsPrincipal user,
        IProjectService projectService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        try
        {
            var project = await projectService.GetByIdAsync(id, ownerIdResult.OwnerId!, cancellationToken);
            return Results.Ok(ToResponse(project));
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
    }

    private static async Task<IResult> UpdateProjectAsync(
        Guid id,
        UpdateProjectRequest request,
        ClaimsPrincipal user,
        IProjectService projectService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Project name is required.");
        }

        try
        {
            var project = await projectService.UpdateAsync(id, ownerIdResult.OwnerId!, request.Name, cancellationToken);
            return Results.Ok(ToResponse(project));
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message);
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

    private static async Task<IResult> DeleteProjectAsync(
        Guid id,
        ClaimsPrincipal user,
        IProjectService projectService,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        try
        {
            await projectService.DeleteAsync(id, ownerIdResult.OwnerId!, cancellationToken);
            return Results.NoContent();
        }
        catch (ProjectNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (UnauthorizedProjectAccessException ex)
        {
            return Forbidden(ex.Message);
        }
    }

    private static ProjectResponse ToResponse(Project project) =>
        new(project.Id, project.Name, project.OwnerId.Value, project.CreatedAt, project.UpdatedAt);

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

    private static IResult NotFound(string detail) =>
        Results.NotFound(new ProblemDetails
        {
            Title = "Project not found",
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

public sealed record CreateProjectRequest(string Name);

public sealed record UpdateProjectRequest(string Name);

public sealed record ProjectResponse(
    Guid Id,
    string Name,
    Guid OwnerId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
