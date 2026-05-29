using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;

namespace FlowForge.Application.Projects;

public class ProjectService(IProjectRepository projectRepository) : IProjectService
{
    public Task<Project> GetByIdAsync(Guid id, UserId ownerId, CancellationToken cancellationToken = default) =>
        GetOwnedProjectAsync(id, ownerId, cancellationToken);

    public Task<IReadOnlyList<Project>> GetAllAsync(UserId ownerId, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(ownerId);
        return projectRepository.GetAllByOwnerAsync(ownerId, cancellationToken);
    }

    public async Task<Project> CreateAsync(UserId ownerId, string name, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(ownerId);

        var project = new Project(ownerId, name);
        await projectRepository.AddAsync(project, cancellationToken);
        return project;
    }

    public async Task<Project> UpdateAsync(
        Guid id,
        UserId ownerId,
        string name,
        CancellationToken cancellationToken = default)
    {
        var project = await GetOwnedProjectAsync(id, ownerId, cancellationToken);
        project.Rename(name);
        await projectRepository.UpdateAsync(project, cancellationToken);
        return project;
    }

    public async Task DeleteAsync(Guid id, UserId ownerId, CancellationToken cancellationToken = default)
    {
        var project = await GetOwnedProjectAsync(id, ownerId, cancellationToken);
        await projectRepository.DeleteAsync(project, cancellationToken);
    }

    public Task<Project?> GetByNameAsync(string name, CancellationToken cancellationToken = default) =>
        projectRepository.FindByNameAsync(name, cancellationToken);

    private async Task<Project> GetOwnedProjectAsync(
        Guid id,
        UserId ownerId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ownerId);

        var project = await projectRepository.GetByIdAsync(id, cancellationToken);

        if (project is null)
        {
            throw new ProjectNotFoundException(id);
        }

        if (project.OwnerId != ownerId)
        {
            throw new UnauthorizedProjectAccessException(id);
        }

        return project;
    }
}
