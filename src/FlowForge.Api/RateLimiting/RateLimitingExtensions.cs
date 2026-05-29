using System.Globalization;
using System.Threading.RateLimiting;
using FlowForge.Api.Logging;
using Microsoft.AspNetCore.RateLimiting;

namespace FlowForge.Api.RateLimiting;

public static class RateLimitPolicies
{
    public const string FixedWindow = "FixedWindow";
}

public static class RateLimitingExtensions
{
    public static IServiceCollection AddFlowForgeRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var permitLimit = configuration.GetValue("RateLimiting:PermitLimit", 100);
        var windowSeconds = configuration.GetValue("RateLimiting:WindowSeconds", 60);

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }

                var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Title = "Too many requests",
                    Detail = "Rate limit exceeded. Please try again later.",
                    Status = StatusCodes.Status429TooManyRequests,
                    Instance = context.HttpContext.Request.Path,
                };
                problem.Extensions["traceId"] = context.HttpContext.GetTraceId();

                await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
            };

            options.AddFixedWindowLimiter(RateLimitPolicies.FixedWindow, limiterOptions =>
            {
                limiterOptions.PermitLimit = permitLimit;
                limiterOptions.Window = TimeSpan.FromSeconds(windowSeconds);
                limiterOptions.QueueLimit = 0;
            });
        });

        return services;
    }
}
