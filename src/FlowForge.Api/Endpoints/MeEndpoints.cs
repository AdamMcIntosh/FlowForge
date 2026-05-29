using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FlowForge.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace FlowForge.Api.Endpoints;

public static class MeEndpoints
{
    public static RouteGroupBuilder MapMeEndpoints(this WebApplication app)
    {
        var me = app.MapGroup("/")
            .RequireAuthorization();

        me.MapGet("/me", GetMeAsync);

        return me;
    }

    private static async Task<IResult> GetMeAsync(
        ClaimsPrincipal user,
        IUserService userService,
        CancellationToken cancellationToken = default)
    {
        var subClaim = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(subClaim) || !Guid.TryParse(subClaim, out var userId))
        {
            return Results.Json(
                new ProblemDetails
                {
                    Title = "Unauthorized",
                    Detail = "The access token is missing a valid subject claim.",
                    Status = StatusCodes.Status401Unauthorized,
                },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var foundUser = await userService.GetByIdAsync(userId, cancellationToken);

        if (foundUser is null)
        {
            return Results.NotFound(new ProblemDetails
            {
                Title = "User not found",
                Detail = "No user exists for the authenticated subject.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        return Results.Ok(new MeResponse(foundUser.Id, foundUser.Email.Value));
    }
}

public sealed record MeResponse(Guid Id, string Email);
