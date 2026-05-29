using FlowForge.Domain.Common;

namespace FlowForge.Domain.Projects;

public sealed class ProjectId : ValueObject
{
    public Guid Value { get; }

    private ProjectId(Guid value) => Value = value;

    public static ProjectId New() => new(Guid.NewGuid());

    public static ProjectId From(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Project id cannot be empty.", nameof(value));
        }

        return new ProjectId(value);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value.ToString();
}
