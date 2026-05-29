using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FlowForge.Infrastructure.Persistence.Repositories;

public class TaskRepository(FlowForgeDbContext context, ILogger<TaskRepository> logger) : ITaskRepository
{
    public async System.Threading.Tasks.Task<DomainTask?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await context.Tasks
            .FirstOrDefaultAsync(task => task.Id == id, cancellationToken);
    }

    public async System.Threading.Tasks.Task<DomainTask?> GetByIdForProjectAsync(
        Guid id,
        ProjectId projectId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(projectId);

        return await context.Tasks
            .FirstOrDefaultAsync(
                task => task.Id == id && task.ProjectId == projectId,
                cancellationToken);
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<DomainTask>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await context.Tasks
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<DomainTask>> GetAllByProjectAsync(
        ProjectId projectId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(projectId);

        return await context.Tasks
            .AsNoTracking()
            .Where(task => task.ProjectId == projectId)
            .ToListAsync(cancellationToken);
    }

    public async System.Threading.Tasks.Task AddAsync(
        DomainTask task,
        CancellationToken cancellationToken = default)
    {
        await context.Tasks.AddAsync(task, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
        logger.LogDebug("Persisted task add for {TaskId} in project {ProjectId}", task.Id, task.ProjectId.Value);
    }

    public async System.Threading.Tasks.Task UpdateAsync(
        DomainTask task,
        CancellationToken cancellationToken = default)
    {
        context.Tasks.Update(task);
        await context.SaveChangesAsync(cancellationToken);
        logger.LogDebug("Persisted task update for {TaskId} in project {ProjectId}", task.Id, task.ProjectId.Value);
    }

    public async System.Threading.Tasks.Task DeleteAsync(
        DomainTask task,
        CancellationToken cancellationToken = default)
    {
        context.Tasks.Remove(task);
        await context.SaveChangesAsync(cancellationToken);
        logger.LogDebug("Persisted task delete for {TaskId} in project {ProjectId}", task.Id, task.ProjectId.Value);
    }

    public async System.Threading.Tasks.Task<DomainTask?> FindByNameForProjectAsync(
        string name,
        ProjectId projectId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(projectId);

        var trimmedName = name.Trim();

        return await context.Tasks
            .FirstOrDefaultAsync(
                task => task.ProjectId == projectId && task.Name == trimmedName,
                cancellationToken);
    }
}
