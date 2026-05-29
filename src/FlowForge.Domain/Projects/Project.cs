using FlowForge.Domain.Common;
using FlowForge.Domain.Users;

namespace FlowForge.Domain.Projects;

public class Project : BaseEntity
{
    public const int MaxNameLength = 200;

    public ProjectId ProjectId { get; private set; } = null!;

    public UserId OwnerId { get; private set; } = null!;

    public string Name { get; private set; } = null!;

    private Project()
    {
    }

    public Project(UserId ownerId, string name)
        : this(ProjectId.New(), ownerId, name)
    {
    }

    public Project(ProjectId projectId, UserId ownerId, string name)
    {
        ArgumentNullException.ThrowIfNull(projectId);
        ArgumentNullException.ThrowIfNull(ownerId);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        var trimmedName = name.Trim();

        if (trimmedName.Length > MaxNameLength)
        {
            throw new ArgumentException("Project name is too long.", nameof(name));
        }

        ProjectId = projectId;
        OwnerId = ownerId;
        Id = projectId.Value;
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
            throw new ArgumentException("Project name is too long.", nameof(name));
        }

        Name = trimmedName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
