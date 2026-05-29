namespace FlowForge.Api.Logging;

public static class TraceIdConstants
{
    public const string HttpContextItemKey = "TraceId";

    public const string CorrelationIdHeader = "X-Correlation-Id";

    public const string RequestIdHeader = "X-Request-Id";

    public const string ActivityTagName = "flowforge.trace_id";

    public const string ScopePropertyName = "TraceId";
}
