using FlowForge.Api.Endpoints;
using FluentValidation;
using DomainTask = FlowForge.Domain.Tasks.Task;

namespace FlowForge.Api.Validation;

public sealed class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        RuleFor(x => x.Name).ValidName("Task", DomainTask.MaxNameLength);
    }
}
