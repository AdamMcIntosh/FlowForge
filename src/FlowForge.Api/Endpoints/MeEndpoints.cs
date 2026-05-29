using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlowForge.Api.Exceptions;
using FlowForge.Api.Logging;
using FlowForge.Api.RateLimiting;
using FlowForge.Application.Users;
using Swashbuckle.AspNetCore.Annotations;

namespace FlowForge.Api.Endpoints;

public static class MeEndpoints
{
    public static RouteGroupBuilder MapMeEndpoints(this WebApplication app)
    {
        var me = app.MapGroup("/")
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitPolicies.FixedWindow)
            .WithTags("Me");

        me.MapGet("/me", GetMeAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Get current user",
                description: "Returns the authenticated user's id and email from the JWT subject claim."));

        return me;
    }

    private static async Task<IResult> GetMeAsync(
        ClaimsPrincipal user,
        IUserService userService,
        ILogger<MeEndpointLogs> logger,
        CancellationToken cancellationToken = default)
    {
        var subClaim = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(subClaim) || !Guid.TryParse(subClaim, out var userId))
        {
            return ProblemDetailsResults.Unauthorized("The access token is missing a valid subject claim.");
        }

        var foundUser = await userService.GetByIdAsync(userId, cancellationToken);

        if (foundUser is null)
        {
            logger.LogWarning("Me endpoint user not found for {UserId}", userId);
            return ProblemDetailsResults.NotFound("User not found", "No user exists for the authenticated subject.");
        }

        logger.LogInformation("Me endpoint returned profile for {UserId}", foundUser.Id);
        return Results.Ok(new MeResponse(foundUser.Id, foundUser.Email.Value));
    }
}

/// <summary>
/// Profile information for the authenticated user.
/// </summary>
/// <param name="Id">Unique identifier of the user.</param>
/// <param name="Email">Email address of the user.</param>
public sealed record MeResponse(Guid Id, string Email);
