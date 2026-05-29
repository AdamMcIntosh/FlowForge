using FlowForge.Api.Endpoints;
using FluentValidation;

namespace FlowForge.Api.Validation;

public sealed class AuthRequestValidator : AbstractValidator<AuthRequest>
{
    public AuthRequestValidator()
    {
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.Password).ValidPassword();
    }
}
