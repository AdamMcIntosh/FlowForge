using FlowForge.Domain.Common;
using FlowForge.Domain.Projects;

namespace FlowForge.Domain.Tasks;

public class Task : BaseEntity
{
    public const int MaxNameLength = 200;

    public TaskId TaskId { get; private set; } = null!;

    public ProjectId ProjectId { get; private set; } = null!;

    public string Name { get; private set; } = null!;

    private Task()
    {
    }

    public Task(ProjectId projectId, string name)
        : this(TaskId.New(), projectId, name)
    {
    }

    public Task(TaskId taskId, ProjectId projectId, string name)
    {
        ArgumentNullException.ThrowIfNull(taskId);
        ArgumentNullException.ThrowIfNull(projectId);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        var trimmedName = name.Trim();

        if (trimmedName.Length > MaxNameLength)
        {
            throw new ArgumentException("Task name is too long.", nameof(name));
        }

        TaskId = taskId;
        ProjectId = projectId;
        Id = taskId.Value;
        Name = trimmedName;
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public void Rename(string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        var trimmedName = name.Trim();

        if (trimmedName.Length > MaxNameLength)
        {
            throw new ArgumentException("Task name is too long.", nameof(name));
        }

        Name = trimmedName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
