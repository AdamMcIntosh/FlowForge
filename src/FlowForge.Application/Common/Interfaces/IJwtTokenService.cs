namespace FlowForge.Application.Common.Interfaces;

public interface IJwtTokenService
{
    string GenerateAccessToken(string subject, IEnumerable<string>? roles = null);
}
