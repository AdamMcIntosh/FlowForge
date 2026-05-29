using FlowForge.Domain.Users;
using DomainTask = FlowForge.Domain.Tasks.Task;

namespace FlowForge.Application.Tasks;

public interface ITaskService
{
    System.Threading.Tasks.Task<DomainTask> GetByIdAsync(
        Guid projectId,
        Guid taskId,
        UserId ownerId,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<IReadOnlyList<DomainTask>> GetAllAsync(
        Guid projectId,
        UserId ownerId,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<DomainTask> CreateAsync(
        Guid projectId,
        UserId ownerId,
        string name,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<DomainTask> UpdateAsync(
        Guid projectId,
        Guid taskId,
        UserId ownerId,
        string name,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task DeleteAsync(
        Guid projectId,
        Guid taskId,
        UserId ownerId,
        CancellationToken cancellationToken = default);
}
