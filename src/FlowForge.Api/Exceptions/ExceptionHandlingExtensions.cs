using System.Text.Json;
using FlowForge.Api.Logging;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;

namespace FlowForge.Api.Exceptions;

public static class ExceptionHandlingExtensions
{
    public static IServiceCollection AddFlowForgeExceptionHandling(this IServiceCollection services)
    {
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Extensions["traceId"] = context.HttpContext.GetTraceId();
            };
        });

        services.AddExceptionHandler<GlobalExceptionHandler>();

        return services;
    }

    public static JwtBearerEvents CreateJwtBearerProblemDetailsEvents() =>
        new()
        {
            OnChallenge = async context =>
            {
                if (context.Response.HasStarted)
                {
                    return;
                }

                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/problem+json";

                var problem = new ProblemDetails
                {
                    Title = "Unauthorized",
                    Detail = "Authentication is required to access this resource.",
                    Status = StatusCodes.Status401Unauthorized,
                    Instance = context.Request.Path,
                };
                problem.Extensions["traceId"] = context.HttpContext.GetTraceId();

                await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
            },
            OnForbidden = async context =>
            {
                if (context.Response.HasStarted)
                {
                    return;
                }

                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/problem+json";

                var problem = new ProblemDetails
                {
                    Title = "Forbidden",
                    Detail = "You are not authorized to perform this action.",
                    Status = StatusCodes.Status403Forbidden,
                    Instance = context.Request.Path,
                };
                problem.Extensions["traceId"] = context.HttpContext.GetTraceId();

                await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
            },
        };
}
