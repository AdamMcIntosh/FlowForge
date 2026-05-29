using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;

namespace FlowForge.Infrastructure.Persistence.Repositories;

/// <summary>
/// In-memory <see cref="IProjectRepository"/> for tests and local development.
/// Mirrors Prisma client semantics: lookups return null when missing;
/// create/update/delete throw when unique constraints or records are violated.
/// </summary>
public class InMemoryProjectRepository : IProjectRepository
{
    private readonly Dictionary<Guid, Project> _projectsById = new();
    private readonly Dictionary<string, Project> _projectsByName = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            _projectsById.TryGetValue(id, out var project);
            return Task.FromResult(project);
        }
    }

    public Task<Project?> GetByIdForOwnerAsync(
        Guid id,
        UserId ownerId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(ownerId);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (_projectsById.TryGetValue(id, out var project) && project.OwnerId == ownerId)
            {
                return Task.FromResult<Project?>(project);
            }

            return Task.FromResult<Project?>(null);
        }
    }

    public Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            IReadOnlyList<Project> projects = _projectsById.Values.ToList();
            return Task.FromResult(projects);
        }
    }

    public Task<IReadOnlyList<Project>> GetAllByOwnerAsync(
        UserId ownerId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(ownerId);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            IReadOnlyList<Project> projects = _projectsById.Values
                .Where(project => project.OwnerId == ownerId)
                .ToList();
            return Task.FromResult(projects);
        }
    }

    public Task AddAsync(Project project, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(project);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (_projectsById.ContainsKey(project.Id))
            {
                throw new InvalidOperationException($"A project with id '{project.Id}' already exists.");
            }

            var nameKey = project.Name;
            if (_projectsByName.ContainsKey(nameKey))
            {
                throw new InvalidOperationException($"A project with name '{nameKey}' already exists.");
            }

            _projectsById[project.Id] = project;
            _projectsByName[nameKey] = project;
        }

        return Task.CompletedTask;
    }

    public Task UpdateAsync(Project project, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(project);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (!_projectsById.TryGetValue(project.Id, out var existing))
            {
                throw new InvalidOperationException($"Project with id '{project.Id}' was not found.");
            }

            var newNameKey = project.Name;
            var existingNameKey = existing.Name;

            if (!string.Equals(existingNameKey, newNameKey, StringComparison.Ordinal)
                && _projectsByName.ContainsKey(newNameKey))
            {
                throw new InvalidOperationException($"A project with name '{newNameKey}' already exists.");
            }

            if (!string.Equals(existingNameKey, newNameKey, StringComparison.Ordinal))
            {
                _projectsByName.Remove(existingNameKey);
                _projectsByName[newNameKey] = project;
            }

            _projectsById[project.Id] = project;
        }

        return Task.CompletedTask;
    }

    public Task DeleteAsync(Project project, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(project);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (!_projectsById.Remove(project.Id))
            {
                throw new InvalidOperationException($"Project with id '{project.Id}' was not found.");
            }

            _projectsByName.Remove(project.Name);
        }

        return Task.CompletedTask;
    }

    public Task<Project?> FindByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        cancellationToken.ThrowIfCancellationRequested();

        var nameKey = name.Trim();

        lock (_sync)
        {
            _projectsByName.TryGetValue(nameKey, out var project);
            return Task.FromResult(project);
        }
    }
}
