namespace FlowForge.Api.Logging;

public static class TraceIdHttpContextExtensions
{
    public static string GetTraceId(this HttpContext context)
    {
        if (context.Items.TryGetValue(TraceIdConstants.HttpContextItemKey, out var value)
            && value is string traceId
            && !string.IsNullOrWhiteSpace(traceId))
        {
            return traceId;
        }

        return context.TraceIdentifier;
    }

    public static void SetTraceId(this HttpContext context, string traceId)
    {
        context.Items[TraceIdConstants.HttpContextItemKey] = traceId;
        context.TraceIdentifier = traceId;
    }
}
