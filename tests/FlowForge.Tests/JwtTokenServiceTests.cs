using System.IdentityModel.Tokens.Jwt;
using FlowForge.Infrastructure.Authentication;
using Microsoft.Extensions.Configuration;

namespace FlowForge.Tests;

public class JwtTokenServiceTests
{
    [Fact]
    public void GenerateAccessToken_IncludesUniqueJtiClaim()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "FlowForge",
                ["Jwt:Audience"] = "FlowForge",
                ["Jwt:Secret"] = "FlowForge-Dev-Secret-Key-At-Least-32-Chars!",
                ["Jwt:ExpiryMinutes"] = "60",
            })
            .Build();

        var service = new JwtTokenService(configuration);

        var firstToken = service.GenerateAccessToken("user-123");
        var secondToken = service.GenerateAccessToken("user-123");

        var handler = new JwtSecurityTokenHandler();
        var firstJti = handler.ReadJwtToken(firstToken).Claims.Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
        var secondJti = handler.ReadJwtToken(secondToken).Claims.Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;

        Assert.NotEqual(firstJti, secondJti);
        Assert.False(string.IsNullOrWhiteSpace(firstJti));
        Assert.False(string.IsNullOrWhiteSpace(secondJti));
    }
}
