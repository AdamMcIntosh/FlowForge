using FlowForge.Api.RateLimiting;
using Microsoft.Extensions.Configuration;

namespace FlowForge.Tests;

public sealed class RateLimitingOptionsTests
{
    [Fact]
    public void FromConfiguration_WhenSpecificLimitsMissing_FallsBackToPermitLimit()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimiting:PermitLimit"] = "42",
                ["RateLimiting:WindowSeconds"] = "30",
            })
            .Build();

        var options = RateLimitingOptions.FromConfiguration(configuration);

        Assert.Equal(42, options.ResolveAuthenticatedPermitLimit());
        Assert.Equal(42, options.ResolveAnonymousPermitLimit());
        Assert.Equal(30, options.WindowSeconds);
        Assert.False(options.TrustForwardedHeaders);
    }

    [Fact]
    public void FromConfiguration_WhenSpecificLimitsProvided_UsesPartitionLimits()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimiting:PermitLimit"] = "100",
                ["RateLimiting:AuthenticatedPermitLimit"] = "80",
                ["RateLimiting:AnonymousPermitLimit"] = "15",
                ["RateLimiting:TrustForwardedHeaders"] = "true",
            })
            .Build();

        var options = RateLimitingOptions.FromConfiguration(configuration);

        Assert.Equal(80, options.ResolveAuthenticatedPermitLimit());
        Assert.Equal(15, options.ResolveAnonymousPermitLimit());
        Assert.True(options.TrustForwardedHeaders);
    }
}
