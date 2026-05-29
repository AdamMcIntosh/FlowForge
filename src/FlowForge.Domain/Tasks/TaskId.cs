using FlowForge.Domain.Common;

namespace FlowForge.Domain.Tasks;

public sealed class TaskId : ValueObject
{
    public Guid Value { get; }

    private TaskId(Guid value) => Value = value;

    public static TaskId New() => new(Guid.NewGuid());

    public static TaskId From(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Task id cannot be empty.", nameof(value));
        }

        return new TaskId(value);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value.ToString();
}
