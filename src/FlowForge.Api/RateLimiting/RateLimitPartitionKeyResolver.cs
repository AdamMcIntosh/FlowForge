using System.IdentityModel.Tokens.Jwt;
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

        var ip = httpContext.Connection.RemoteIpAddress;
        if (ip is not null)
        {
            if (ip.IsIPv4MappedToIPv6)
            {
                ip = ip.MapToIPv4();
            }

            return $"{AnonymousPrefix}{ip}";
        }

        return $"{AnonymousPrefix}unknown";
    }
}
