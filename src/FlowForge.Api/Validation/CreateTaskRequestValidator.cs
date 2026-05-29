using FlowForge.Api.Endpoints;
using FluentValidation;
using DomainTask = FlowForge.Domain.Tasks.Task;

namespace FlowForge.Api.Validation;

public sealed class CreateTaskRequestValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskRequestValidator()
    {
        RuleFor(x => x.Name).ValidName("Task", DomainTask.MaxNameLength);
    }
}
