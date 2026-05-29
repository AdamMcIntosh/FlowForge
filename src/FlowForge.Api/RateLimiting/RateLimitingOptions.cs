namespace FlowForge.Api.RateLimiting;

internal sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public int PermitLimit { get; init; } = 100;

    public int? AuthenticatedPermitLimit { get; init; }

    public int? AnonymousPermitLimit { get; init; }

    public int WindowSeconds { get; init; } = 60;

    public bool TrustForwardedHeaders { get; init; }

    public int ResolveAuthenticatedPermitLimit() =>
        AuthenticatedPermitLimit ?? PermitLimit;

    public int ResolveAnonymousPermitLimit() =>
        AnonymousPermitLimit ?? PermitLimit;

    public static RateLimitingOptions FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection(SectionName);
        return new RateLimitingOptions
        {
            PermitLimit = section.GetValue(nameof(PermitLimit), 100),
            AuthenticatedPermitLimit = section.GetValue<int?>(nameof(AuthenticatedPermitLimit)),
            AnonymousPermitLimit = section.GetValue<int?>(nameof(AnonymousPermitLimit)),
            WindowSeconds = section.GetValue(nameof(WindowSeconds), 60),
            TrustForwardedHeaders = section.GetValue(nameof(TrustForwardedHeaders), false),
        };
    }
}
