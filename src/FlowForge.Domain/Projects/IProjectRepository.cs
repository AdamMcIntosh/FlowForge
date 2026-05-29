using FlowForge.Domain.Users;

namespace FlowForge.Domain.Projects;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Project?> GetByIdForOwnerAsync(Guid id, UserId ownerId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Project>> GetAllByOwnerAsync(UserId ownerId, CancellationToken cancellationToken = default);

    Task AddAsync(Project project, CancellationToken cancellationToken = default);

    Task UpdateAsync(Project project, CancellationToken cancellationToken = default);

    Task DeleteAsync(Project project, CancellationToken cancellationToken = default);

    Task<Project?> FindByNameAsync(string name, CancellationToken cancellationToken = default);
}
