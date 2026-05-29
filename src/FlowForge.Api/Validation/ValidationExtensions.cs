using FluentValidation;
using FluentValidation.Results;

namespace FlowForge.Api.Validation;

public static class ValidationExtensions
{
    public static IServiceCollection AddFlowForgeValidation(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<CreateProjectRequestValidator>();
        return services;
    }

    public static IResult? ToProblemDetailsResult(this ValidationResult validationResult)
    {
        if (validationResult.IsValid)
        {
            return null;
        }

        var detail = validationResult.Errors[0].ErrorMessage;
        return Exceptions.ProblemDetailsResults.BadRequest(detail);
    }
}
