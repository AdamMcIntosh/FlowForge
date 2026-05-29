namespace FlowForge.Api.Authentication;

public static class JwtSecretValidator
{
    public const int MinimumLength = 32;
    public const int MinimumDistinctCharacters = 8;

    private static readonly string[] ProductionPlaceholderSecrets =
    [
        "FlowForge-Dev-Secret-Key-At-Least-32-Chars!",
        "your-local-secret-at-least-32-characters-long",
        "REPLACE_WITH_SECRET_FROM_STORE_MIN_32_CHARS",
    ];

    public static string Validate(string? secret, bool isProduction)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("Jwt:Secret is required.");
        }

        if (secret.Length < MinimumLength)
        {
            throw new InvalidOperationException(
                $"Jwt:Secret must be at least {MinimumLength} characters long.");
        }

        if (secret.Distinct().Count() < MinimumDistinctCharacters)
        {
            throw new InvalidOperationException(
                $"Jwt:Secret must contain at least {MinimumDistinctCharacters} distinct characters for sufficient entropy.");
        }

        if (isProduction && ProductionPlaceholderSecrets.Contains(secret, StringComparer.Ordinal))
        {
            throw new InvalidOperationException(
                "Jwt:Secret must be supplied via environment or a secret store in Production; development placeholder values are not allowed.");
        }

        return secret;
    }
}
