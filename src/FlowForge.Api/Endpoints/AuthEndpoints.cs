using FlowForge.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace FlowForge.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/")
            .AllowAnonymous();

        auth.MapPost("/register", RegisterAsync);
        auth.MapPost("/login", LoginAsync);

        return auth;
    }

    private static async Task<IResult> RegisterAsync(
        AuthRequest request,
        IUserService userService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new ProblemDetails
            {
                Title = "Invalid request",
                Detail = "Email and password are required.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        try
        {
            var result = await userService.RegisterAsync(request.Email, request.Password, cancellationToken);
            return Results.Created("/register", ToResponse(result));
        }
        catch (DuplicateEmailException ex)
        {
            return Results.Conflict(new ProblemDetails
            {
                Title = "Duplicate email",
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict,
            });
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ProblemDetails
            {
                Title = "Invalid request",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest,
            });
        }
    }

    private static async Task<IResult> LoginAsync(
        AuthRequest request,
        IUserService userService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new ProblemDetails
            {
                Title = "Invalid request",
                Detail = "Email and password are required.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        try
        {
            var result = await userService.LoginAsync(request.Email, request.Password, cancellationToken);
            return Results.Ok(ToResponse(result));
        }
        catch (InvalidCredentialsException ex)
        {
            return Results.Json(
                new ProblemDetails
                {
                    Title = "Invalid credentials",
                    Detail = ex.Message,
                    Status = StatusCodes.Status401Unauthorized,
                },
                statusCode: StatusCodes.Status401Unauthorized);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ProblemDetails
            {
                Title = "Invalid request",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest,
            });
        }
    }

    private static AuthResponse ToResponse(AuthResult result) =>
        new(result.AccessToken, result.UserId, result.Email);
}

public sealed record AuthRequest(string Email, string Password);

public sealed record AuthResponse(string AccessToken, Guid UserId, string Email);
