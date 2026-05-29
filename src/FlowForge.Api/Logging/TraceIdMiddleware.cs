using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace FlowForge.Api.Logging;

public sealed class TraceIdMiddleware(RequestDelegate next, ILoggerFactory loggerFactory)
{
    private static readonly ActivitySource ActivitySource = new("FlowForge.Api");

    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = ResolveTraceId(context);
        context.SetTraceId(traceId);

        var activity = Activity.Current ?? ActivitySource.StartActivity("HTTP Request");
        activity?.SetTag(TraceIdConstants.ActivityTagName, traceId);

        context.Response.OnStarting(() =>
        {
            context.Response.Headers[TraceIdConstants.CorrelationIdHeader] = traceId;
            return Task.CompletedTask;
        });

        var scopeState = new Dictionary<string, object>
        {
            [TraceIdConstants.ScopePropertyName] = traceId,
        };

        var requestLogger = loggerFactory.CreateLogger(TraceIdLoggingExtensions.RequestLoggerCategory);

        using (requestLogger.BeginScope(scopeState))
        {
            if (activity is not null)
            {
                using (activity)
                {
                    await next(context);
                }
            }
            else
            {
                await next(context);
            }
        }
    }

    private static string ResolveTraceId(HttpContext context)
    {
        if (TryGetHeaderValue(context, TraceIdConstants.CorrelationIdHeader, out var correlationId))
        {
            return correlationId;
        }

        if (TryGetHeaderValue(context, TraceIdConstants.RequestIdHeader, out var requestId))
        {
            return requestId;
        }

        return Guid.NewGuid().ToString("N");
    }

    private static bool TryGetHeaderValue(HttpContext context, string headerName, out string value)
    {
        value = string.Empty;

        if (!context.Request.Headers.TryGetValue(headerName, out var headerValues))
        {
            return false;
        }

        var candidate = headerValues.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return false;
        }

        value = candidate.Trim();
        return true;
    }
}
