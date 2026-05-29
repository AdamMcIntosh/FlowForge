using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;

namespace FlowForge.Application.Projects;

public interface IProjectService
{
    Task<Project> GetByIdAsync(Guid id, UserId ownerId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Project>> GetAllAsync(UserId ownerId, CancellationToken cancellationToken = default);

    Task<Project> CreateAsync(UserId ownerId, string name, CancellationToken cancellationToken = default);

    Task<Project> UpdateAsync(Guid id, UserId ownerId, string name, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, UserId ownerId, CancellationToken cancellationToken = default);

    Task<Project?> GetByNameAsync(string name, CancellationToken cancellationToken = default);
}
