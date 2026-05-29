using System.Globalization;
using System.Threading.RateLimiting;
using FlowForge.Api.Logging;
using Microsoft.AspNetCore.HttpOverrides;
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
        var rateLimitOptions = RateLimitingOptions.FromConfiguration(configuration);

        if (rateLimitOptions.TrustForwardedHeaders)
        {
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.ForwardLimit = 1;
            });
        }

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

            options.AddPolicy(RateLimitPolicies.FixedWindow, httpContext =>
            {
                var partitionKey = RateLimitPartitionKeyResolver.Resolve(httpContext);
                var isAuthenticated = RateLimitPartitionKeyResolver.IsAuthenticatedPartition(partitionKey);
                var permitLimit = isAuthenticated
                    ? rateLimitOptions.ResolveAuthenticatedPermitLimit()
                    : rateLimitOptions.ResolveAnonymousPermitLimit();

                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = permitLimit,
                        Window = TimeSpan.FromSeconds(rateLimitOptions.WindowSeconds),
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });
        });

        return services;
    }

    public static WebApplication UseFlowForgeForwardedHeaders(
        this WebApplication app,
        IConfiguration configuration)
    {
        var rateLimitOptions = RateLimitingOptions.FromConfiguration(configuration);
        if (rateLimitOptions.TrustForwardedHeaders)
        {
            app.UseForwardedHeaders();
        }

        return app;
    }
}
