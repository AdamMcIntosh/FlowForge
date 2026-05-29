using FlowForge.Api.Endpoints;
using FlowForge.Domain.Projects;
using FluentValidation;

namespace FlowForge.Api.Validation;

public sealed class UpdateProjectRequestValidator : AbstractValidator<UpdateProjectRequest>
{
    public UpdateProjectRequestValidator()
    {
        RuleFor(x => x.Name).ValidName("Project", Project.MaxNameLength);
    }
}
