using FlowForge.Api.Endpoints;
using FlowForge.Domain.Projects;
using FluentValidation;

namespace FlowForge.Api.Validation;

public sealed class CreateProjectRequestValidator : AbstractValidator<CreateProjectRequest>
{
    public CreateProjectRequestValidator()
    {
        RuleFor(x => x.Name).ValidName("Project", Project.MaxNameLength);
    }
}
