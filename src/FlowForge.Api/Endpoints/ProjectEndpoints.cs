using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlowForge.Api.Exceptions;
using FlowForge.Api.Logging;
using FlowForge.Api.RateLimiting;
using FlowForge.Api.Validation;
using FlowForge.Application.Projects;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using FluentValidation;
using Swashbuckle.AspNetCore.Annotations;

namespace FlowForge.Api.Endpoints;

public static class ProjectEndpoints
{
    public static RouteGroupBuilder MapProjectEndpoints(this WebApplication app)
    {
        var projects = app.MapGroup("/projects")
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.FixedWindow)
            .WithTags("Projects");

        projects.MapPost("/", CreateProjectAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Create a project",
                description: "Creates a new project owned by the authenticated user."));

        projects.MapGet("/", ListProjectsAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "List projects",
                description: "Returns all projects owned by the authenticated user."));

        projects.MapGet("/{id:guid}", GetProjectByIdAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Get a project by id",
                description: "Returns a single project when it exists and is owned by the authenticated user."));

        projects.MapPut("/{id:guid}", UpdateProjectAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Update a project",
                description: "Renames a project owned by the authenticated user."));

        projects.MapDelete("/{id:guid}", DeleteProjectAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Delete a project",
                description: "Deletes a project owned by the authenticated user."));

        return projects;
    }

    private static async Task<IResult> CreateProjectAsync(
        CreateProjectRequest request,
        ClaimsPrincipal user,
        IValidator<CreateProjectRequest> validator,
        IProjectService projectService,
        ILogger<ProjectEndpointLogs> logger,
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

        var project = await projectService.CreateAsync(ownerIdResult.OwnerId!, request.Name, cancellationToken);
        logger.LogInformation(
            "Create project endpoint succeeded for {ProjectId} and owner {OwnerId}",
            project.Id,
            ownerIdResult.OwnerId!.Value);
        return Results.Created($"/projects/{project.Id}", ToResponse(project));
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

        var project = await projectService.GetByIdAsync(id, ownerIdResult.OwnerId!, cancellationToken);
        return Results.Ok(ToResponse(project));
    }

    private static async Task<IResult> UpdateProjectAsync(
        Guid id,
        UpdateProjectRequest request,
        ClaimsPrincipal user,
        IValidator<UpdateProjectRequest> validator,
        IProjectService projectService,
        ILogger<ProjectEndpointLogs> logger,
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

        var project = await projectService.UpdateAsync(id, ownerIdResult.OwnerId!, request.Name, cancellationToken);
        logger.LogInformation(
            "Update project endpoint succeeded for {ProjectId} and owner {OwnerId}",
            project.Id,
            ownerIdResult.OwnerId!.Value);
        return Results.Ok(ToResponse(project));
    }

    private static async Task<IResult> DeleteProjectAsync(
        Guid id,
        ClaimsPrincipal user,
        IProjectService projectService,
        ILogger<ProjectEndpointLogs> logger,
        CancellationToken cancellationToken)
    {
        var ownerIdResult = TryGetOwnerId(user);
        if (ownerIdResult.Error is not null)
        {
            return ownerIdResult.Error;
        }

        await projectService.DeleteAsync(id, ownerIdResult.OwnerId!, cancellationToken);
        logger.LogInformation(
            "Delete project endpoint succeeded for {ProjectId} and owner {OwnerId}",
            id,
            ownerIdResult.OwnerId!.Value);
        return Results.NoContent();
    }

    private static ProjectResponse ToResponse(Project project) =>
        new(project.Id, project.Name, project.OwnerId.Value, project.CreatedAt, project.UpdatedAt);

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
/// Request body for creating a project.
/// </summary>
/// <param name="Name">Display name of the project.</param>
public sealed record CreateProjectRequest(string Name);

/// <summary>
/// Request body for updating a project.
/// </summary>
/// <param name="Name">Updated display name of the project.</param>
public sealed record UpdateProjectRequest(string Name);

/// <summary>
/// Project resource returned by project endpoints.
/// </summary>
/// <param name="Id">Unique identifier of the project.</param>
/// <param name="Name">Display name of the project.</param>
/// <param name="OwnerId">Unique identifier of the owning user.</param>
/// <param name="CreatedAt">UTC timestamp when the project was created.</param>
/// <param name="UpdatedAt">UTC timestamp when the project was last updated.</param>
public sealed record ProjectResponse(
    Guid Id,
    string Name,
    Guid OwnerId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
