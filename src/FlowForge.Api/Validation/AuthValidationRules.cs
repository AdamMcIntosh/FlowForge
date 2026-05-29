using System.Text.RegularExpressions;
using FluentValidation;

namespace FlowForge.Api.Validation;

internal static partial class AuthValidationRules
{
    private const int MinPasswordLength = 12;
    private const int MaxPasswordLength = 128;
    private const int MaxEmailLength = 320;

    public static IRuleBuilderOptions<T, string> ValidEmail<T>(this IRuleBuilder<T, string> ruleBuilder)
    {
        return ruleBuilder
            .Must(email => !string.IsNullOrWhiteSpace(email))
            .WithMessage("Email is required.")
            .Must(email => string.IsNullOrWhiteSpace(email) || email.Trim().Length <= MaxEmailLength)
            .WithMessage("Email address is too long.")
            .Must(email => string.IsNullOrWhiteSpace(email) || EmailPattern().IsMatch(email.Trim().ToLowerInvariant()))
            .WithMessage("Email address format is invalid.");
    }

    public static IRuleBuilderOptions<T, string> ValidPassword<T>(this IRuleBuilder<T, string> ruleBuilder)
    {
        return ruleBuilder
            .Must(password => !string.IsNullOrWhiteSpace(password))
            .WithMessage("Password is required.")
            .Must(password => string.IsNullOrWhiteSpace(password) || password.Length >= MinPasswordLength)
            .WithMessage($"Password must be at least {MinPasswordLength} characters long.")
            .Must(password => string.IsNullOrWhiteSpace(password) || password.Length <= MaxPasswordLength)
            .WithMessage($"Password must be at most {MaxPasswordLength} characters long.")
            .Must(password => string.IsNullOrWhiteSpace(password) || UppercasePattern().IsMatch(password))
            .WithMessage("Password must contain at least one uppercase letter.")
            .Must(password => string.IsNullOrWhiteSpace(password) || LowercasePattern().IsMatch(password))
            .WithMessage("Password must contain at least one lowercase letter.")
            .Must(password => string.IsNullOrWhiteSpace(password) || DigitPattern().IsMatch(password))
            .WithMessage("Password must contain at least one digit.")
            .Must(password => string.IsNullOrWhiteSpace(password) || SpecialCharacterPattern().IsMatch(password))
            .WithMessage("Password must contain at least one special character.");
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"[A-Z]", RegexOptions.CultureInvariant)]
    private static partial Regex UppercasePattern();

    [GeneratedRegex(@"[a-z]", RegexOptions.CultureInvariant)]
    private static partial Regex LowercasePattern();

    [GeneratedRegex(@"\d", RegexOptions.CultureInvariant)]
    private static partial Regex DigitPattern();

    [GeneratedRegex(@"[^a-zA-Z0-9]", RegexOptions.CultureInvariant)]
    private static partial Regex SpecialCharacterPattern();
}
