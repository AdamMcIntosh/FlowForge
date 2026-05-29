using FlowForge.Api.Logging;
using FlowForge.Api.RateLimiting;
using FlowForge.Api.Validation;
using FlowForge.Application.Users;
using FluentValidation;
using Swashbuckle.AspNetCore.Annotations;

namespace FlowForge.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/")
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.FixedWindow)
            .WithTags("Auth");

        auth.MapPost("/register", RegisterAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Register a new user",
                description: "Creates an account with email and password. Returns a JWT access token on success."));

        auth.MapPost("/login", LoginAsync)
            .WithMetadata(new SwaggerOperationAttribute(
                summary: "Log in",
                description: "Authenticates with email and password. Returns a JWT access token on success."));

        return auth;
    }

    private static async Task<IResult> RegisterAsync(
        AuthRequest request,
        IValidator<AuthRequest> validator,
        IUserService userService,
        ILogger<AuthEndpointLogs> logger,
        CancellationToken cancellationToken)
    {
        var validationResult = await validator.ValidateAsync(request, cancellationToken);
        if (validationResult.ToProblemDetailsResult() is { } validationError)
        {
            return validationError;
        }

        var result = await userService.RegisterAsync(request.Email, request.Password, cancellationToken);
        logger.LogInformation("Register endpoint succeeded for {UserId}", result.UserId);
        return Results.Created("/register", ToResponse(result));
    }

    private static async Task<IResult> LoginAsync(
        AuthRequest request,
        IValidator<AuthRequest> validator,
        IUserService userService,
        ILogger<AuthEndpointLogs> logger,
        CancellationToken cancellationToken)
    {
        var validationResult = await validator.ValidateAsync(request, cancellationToken);
        if (validationResult.ToProblemDetailsResult() is { } validationError)
        {
            return validationError;
        }

        var result = await userService.LoginAsync(request.Email, request.Password, cancellationToken);
        logger.LogInformation("Login endpoint succeeded for {UserId}", result.UserId);
        return Results.Ok(ToResponse(result));
    }

    private static AuthResponse ToResponse(AuthResult result) =>
        new(result.AccessToken, result.UserId, result.Email);
}

/// <summary>
/// Credentials for register and login requests.
/// </summary>
/// <param name="Email">User email address.</param>
/// <param name="Password">User password.</param>
public sealed record AuthRequest(string Email, string Password);

/// <summary>
/// Authentication response containing a JWT access token and user identity.
/// </summary>
/// <param name="AccessToken">JWT bearer token for authenticated requests.</param>
/// <param name="UserId">Unique identifier of the authenticated user.</param>
/// <param name="Email">Email address of the authenticated user.</param>
public sealed record AuthResponse(string AccessToken, Guid UserId, string Email);
