namespace FlowForge.Application.Projects;

public sealed class ProjectNotFoundException : Exception
{
    public ProjectNotFoundException(Guid projectId)
        : base($"Project with id '{projectId}' was not found.")
    {
        ProjectId = projectId;
    }

    public Guid ProjectId { get; }
}
