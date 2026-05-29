using FlowForge.Domain.Projects;

namespace FlowForge.Domain.Tasks;

public interface ITaskRepository
{
    System.Threading.Tasks.Task<Task?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<Task?> GetByIdForProjectAsync(
        Guid id,
        ProjectId projectId,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<IReadOnlyList<Task>> GetAllAsync(CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<IReadOnlyList<Task>> GetAllByProjectAsync(
        ProjectId projectId,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task AddAsync(Task task, CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task UpdateAsync(Task task, CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task DeleteAsync(Task task, CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<Task?> FindByNameForProjectAsync(
        string name,
        ProjectId projectId,
        CancellationToken cancellationToken = default);
}
