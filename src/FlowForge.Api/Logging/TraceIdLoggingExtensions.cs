using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace FlowForge.Api.Logging;

public static class TraceIdLoggingExtensions
{
    public const string RequestLoggerCategory = "FlowForge.Request";

    public static IServiceCollection AddFlowForgeTraceIdLogging(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();

        services.AddLogging(logging =>
        {
            logging.Configure(options =>
            {
                options.ActivityTrackingOptions =
                    ActivityTrackingOptions.TraceId
                    | ActivityTrackingOptions.SpanId;
            });
        });

        return services;
    }

    public static IApplicationBuilder UseFlowForgeTraceId(this IApplicationBuilder app) =>
        app.UseMiddleware<TraceIdMiddleware>();
}
