using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;

namespace FlowForge.Infrastructure.Persistence.Repositories;

/// <summary>
/// In-memory <see cref="ITaskRepository"/> for tests and local development.
/// Mirrors Prisma client semantics: lookups return null when missing;
/// create/update/delete throw when unique constraints or records are violated.
/// Name uniqueness is scoped per project, matching project-scoped task lookups.
/// </summary>
public class InMemoryTaskRepository : ITaskRepository
{
    private readonly Dictionary<Guid, DomainTask> _tasksById = new();
    private readonly Dictionary<string, DomainTask> _tasksByProjectAndName = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public System.Threading.Tasks.Task<DomainTask?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            _tasksById.TryGetValue(id, out var task);
            return System.Threading.Tasks.Task.FromResult(task);
        }
    }

    public System.Threading.Tasks.Task<DomainTask?> GetByIdForProjectAsync(
        Guid id,
        ProjectId projectId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(projectId);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (_tasksById.TryGetValue(id, out var task) && task.ProjectId == projectId)
            {
                return System.Threading.Tasks.Task.FromResult<DomainTask?>(task);
            }

            return System.Threading.Tasks.Task.FromResult<DomainTask?>(null);
        }
    }

    public System.Threading.Tasks.Task<IReadOnlyList<DomainTask>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            IReadOnlyList<DomainTask> tasks = _tasksById.Values.ToList();
            return System.Threading.Tasks.Task.FromResult(tasks);
        }
    }

    public System.Threading.Tasks.Task<IReadOnlyList<DomainTask>> GetAllByProjectAsync(
        ProjectId projectId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(projectId);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            IReadOnlyList<DomainTask> tasks = _tasksById.Values
                .Where(task => task.ProjectId == projectId)
                .ToList();
            return System.Threading.Tasks.Task.FromResult(tasks);
        }
    }

    public System.Threading.Tasks.Task AddAsync(
        DomainTask task,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(task);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (_tasksById.ContainsKey(task.Id))
            {
                throw new InvalidOperationException($"A task with id '{task.Id}' already exists.");
            }

            var nameKey = ProjectNameKey(task.ProjectId, task.Name);
            if (_tasksByProjectAndName.ContainsKey(nameKey))
            {
                throw new InvalidOperationException(
                    $"A task with name '{task.Name}' already exists in project '{task.ProjectId.Value}'.");
            }

            _tasksById[task.Id] = task;
            _tasksByProjectAndName[nameKey] = task;
        }

        return System.Threading.Tasks.Task.CompletedTask;
    }

    public System.Threading.Tasks.Task UpdateAsync(
        DomainTask task,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(task);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (!_tasksById.TryGetValue(task.Id, out var existing))
            {
                throw new InvalidOperationException($"Task with id '{task.Id}' was not found.");
            }

            var newNameKey = ProjectNameKey(task.ProjectId, task.Name);
            var existingNameKey = ProjectNameKey(existing.ProjectId, existing.Name);

            if (!string.Equals(existingNameKey, newNameKey, StringComparison.Ordinal)
                && _tasksByProjectAndName.ContainsKey(newNameKey))
            {
                throw new InvalidOperationException(
                    $"A task with name '{task.Name}' already exists in project '{task.ProjectId.Value}'.");
            }

            if (!string.Equals(existingNameKey, newNameKey, StringComparison.Ordinal))
            {
                _tasksByProjectAndName.Remove(existingNameKey);
                _tasksByProjectAndName[newNameKey] = task;
            }

            _tasksById[task.Id] = task;
        }

        return System.Threading.Tasks.Task.CompletedTask;
    }

    public System.Threading.Tasks.Task DeleteAsync(
        DomainTask task,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(task);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (!_tasksById.Remove(task.Id))
            {
                throw new InvalidOperationException($"Task with id '{task.Id}' was not found.");
            }

            _tasksByProjectAndName.Remove(ProjectNameKey(task.ProjectId, task.Name));
        }

        return System.Threading.Tasks.Task.CompletedTask;
    }

    public System.Threading.Tasks.Task<DomainTask?> FindByNameForProjectAsync(
        string name,
        ProjectId projectId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(projectId);
        cancellationToken.ThrowIfCancellationRequested();

        var nameKey = ProjectNameKey(projectId, name.Trim());

        lock (_sync)
        {
            _tasksByProjectAndName.TryGetValue(nameKey, out var task);
            return System.Threading.Tasks.Task.FromResult(task);
        }
    }

    private static string ProjectNameKey(ProjectId projectId, string name) =>
        $"{projectId.Value}:{name}";
}
