using FluentValidation;

namespace FlowForge.Api.Validation;

internal static class NameValidationRules
{
    public static IRuleBuilderOptions<T, string> ValidName<T>(
        this IRuleBuilder<T, string> ruleBuilder,
        string entityLabel,
        int maxLength)
    {
        return ruleBuilder
            .Must(name => !string.IsNullOrWhiteSpace(name))
            .WithMessage($"{entityLabel} name is required.")
            .Must(name => name.Trim().Length <= maxLength)
            .WithMessage($"{entityLabel} name is too long.");
    }
}
