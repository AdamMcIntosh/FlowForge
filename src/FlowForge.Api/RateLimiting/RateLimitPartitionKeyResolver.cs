using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;

namespace FlowForge.Api.RateLimiting;

internal static class RateLimitPartitionKeyResolver
{
    internal const string AuthenticatedPrefix = "sub:";
    internal const string AnonymousPrefix = "ip:";

    public static string Resolve(HttpContext httpContext)
    {
        var user = httpContext.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var sub = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrWhiteSpace(sub))
            {
                return $"{AuthenticatedPrefix}{sub}";
            }
        }

        var clientIp = GetClientIpAddress(httpContext);
        return $"{AnonymousPrefix}{clientIp}";
    }

    public static bool IsAuthenticatedPartition(string partitionKey) =>
        partitionKey.StartsWith(AuthenticatedPrefix, StringComparison.Ordinal);

    internal static string GetClientIpAddress(HttpContext httpContext)
    {
        var ip = httpContext.Connection.RemoteIpAddress;
        if (ip is null)
        {
            return "unknown";
        }

        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (IPAddress.IsLoopback(ip))
        {
            return "127.0.0.1";
        }

        return ip.ToString();
    }
}
