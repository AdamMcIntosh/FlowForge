namespace FlowForge.Application.Projects;

public sealed class UnauthorizedProjectAccessException : Exception
{
    public UnauthorizedProjectAccessException(Guid projectId)
        : base($"You are not authorized to access project '{projectId}'.")
    {
        ProjectId = projectId;
    }

    public Guid ProjectId { get; }
}
