using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using FlowForge.Api.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace FlowForge.Tests;

public sealed class RateLimitPartitionKeyResolverTests
{
    [Fact]
    public void Resolve_WhenAnonymous_UsesClientIpPartition()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");

        var partitionKey = RateLimitPartitionKeyResolver.Resolve(context);

        Assert.Equal($"{RateLimitPartitionKeyResolver.AnonymousPrefix}203.0.113.10", partitionKey);
    }

    [Fact]
    public void Resolve_WhenAuthenticated_UsesSubClaimPartition()
    {
        var userId = Guid.NewGuid();
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            ], authenticationType: "Bearer")),
        };
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");

        var partitionKey = RateLimitPartitionKeyResolver.Resolve(context);

        Assert.Equal($"{RateLimitPartitionKeyResolver.AuthenticatedPrefix}{userId}", partitionKey);
    }

    [Fact]
    public void Resolve_WhenAuthenticatedWithoutSub_FallsBackToClientIp()
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([], authenticationType: "Bearer")),
        };
        context.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.4");

        var partitionKey = RateLimitPartitionKeyResolver.Resolve(context);

        Assert.Equal($"{RateLimitPartitionKeyResolver.AnonymousPrefix}198.51.100.4", partitionKey);
    }

    [Fact]
    public void Resolve_WhenIpIsMissing_UsesUnknownPartition()
    {
        var context = new DefaultHttpContext();

        var partitionKey = RateLimitPartitionKeyResolver.Resolve(context);

        Assert.Equal($"{RateLimitPartitionKeyResolver.AnonymousPrefix}unknown", partitionKey);
    }
}
