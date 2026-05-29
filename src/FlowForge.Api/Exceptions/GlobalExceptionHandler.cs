using FlowForge.Api.Logging;
using FlowForge.Application.Projects;
using FlowForge.Application.Tasks;
using FlowForge.Application.Users;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace FlowForge.Api.Exceptions;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, title, detail, logLevel) = MapException(exception);

        var traceId = httpContext.GetTraceId();

        if (logLevel == LogLevel.Error)
        {
            logger.LogError(
                exception,
                "Unexpected error processing {Method} {Path}",
                httpContext.Request.Method,
                httpContext.Request.Path.Value);
        }
        else
        {
            logger.Log(
                logLevel,
                "Request failed with {ExceptionType} for {Method} {Path}",
                exception.GetType().Name,
                httpContext.Request.Method,
                httpContext.Request.Path.Value);
        }

        var problem = new ProblemDetails
        {
            Title = title,
            Detail = detail,
            Status = statusCode,
            Instance = httpContext.Request.Path,
        };
        problem.Extensions["traceId"] = traceId;

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);

        return true;
    }

    private static (int StatusCode, string Title, string Detail, LogLevel LogLevel) MapException(Exception exception) =>
        exception switch
        {
            DuplicateEmailException =>
                (StatusCodes.Status409Conflict, "Duplicate email", "A user with this email already exists.", LogLevel.Warning),
            InvalidCredentialsException =>
                (StatusCodes.Status401Unauthorized, "Invalid credentials", "Invalid email or password.", LogLevel.Warning),
            ProjectNotFoundException =>
                (StatusCodes.Status404NotFound, "Project not found", "The requested project was not found.", LogLevel.Warning),
            UnauthorizedProjectAccessException =>
                (StatusCodes.Status403Forbidden, "Forbidden", "You are not authorized to access this project.", LogLevel.Warning),
            TaskNotFoundException =>
                (StatusCodes.Status404NotFound, "Task not found", "The requested task was not found.", LogLevel.Warning),
            ArgumentException argumentException =>
                (StatusCodes.Status400BadRequest, "Invalid request", argumentException.Message, LogLevel.Warning),
            _ =>
                (StatusCodes.Status500InternalServerError, "Internal server error", "An unexpected error occurred.", LogLevel.Error),
        };
}
