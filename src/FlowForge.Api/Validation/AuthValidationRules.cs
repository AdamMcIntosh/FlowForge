using System.Text.RegularExpressions;
using FluentValidation;

namespace FlowForge.Api.Validation;

internal static partial class AuthValidationRules
{
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
            .WithMessage("Password is required.");
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();
}
