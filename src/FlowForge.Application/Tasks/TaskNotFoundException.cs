namespace FlowForge.Application.Tasks;

public sealed class TaskNotFoundException : Exception
{
    public TaskNotFoundException(Guid taskId)
        : base($"Task with id '{taskId}' was not found.")
    {
        TaskId = taskId;
    }

    public Guid TaskId { get; }
}
