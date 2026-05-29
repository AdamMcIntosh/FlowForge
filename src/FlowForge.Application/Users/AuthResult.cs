namespace FlowForge.Application.Users;

public sealed record AuthResult(string AccessToken, Guid UserId, string Email);
