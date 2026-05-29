using FlowForge.Application.Projects;
using FlowForge.Domain.Projects;
using FlowForge.Domain.Tasks;
using FlowForge.Domain.Users;
using DomainTask = FlowForge.Domain.Tasks.Task;

namespace FlowForge.Application.Tasks;

public class TaskService(IProjectService projectService, ITaskRepository taskRepository) : ITaskService
{
    public async System.Threading.Tasks.Task<DomainTask> GetByIdAsync(
        Guid projectId,
        Guid taskId,
        UserId ownerId,
        CancellationToken cancellationToken = default)
    {
        var project = await projectService.GetByIdAsync(projectId, ownerId, cancellationToken);
        return await GetTaskForProjectAsync(taskId, project.ProjectId, cancellationToken);
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<DomainTask>> GetAllAsync(
        Guid projectId,
        UserId ownerId,
        CancellationToken cancellationToken = default)
    {
        var project = await projectService.GetByIdAsync(projectId, ownerId, cancellationToken);
        return await taskRepository.GetAllByProjectAsync(project.ProjectId, cancellationToken);
    }

    public async System.Threading.Tasks.Task<DomainTask> CreateAsync(
        Guid projectId,
        UserId ownerId,
        string name,
        CancellationToken cancellationToken = default)
    {
        var project = await projectService.GetByIdAsync(projectId, ownerId, cancellationToken);
        var task = new DomainTask(project.ProjectId, name);
        await taskRepository.AddAsync(task, cancellationToken);
        return task;
    }

    public async System.Threading.Tasks.Task<DomainTask> UpdateAsync(
        Guid projectId,
        Guid taskId,
        UserId ownerId,
        string name,
        CancellationToken cancellationToken = default)
    {
        var project = await projectService.GetByIdAsync(projectId, ownerId, cancellationToken);
        var task = await GetTaskForProjectAsync(taskId, project.ProjectId, cancellationToken);
        task.Rename(name);
        await taskRepository.UpdateAsync(task, cancellationToken);
        return task;
    }

    public async System.Threading.Tasks.Task DeleteAsync(
        Guid projectId,
        Guid taskId,
        UserId ownerId,
        CancellationToken cancellationToken = default)
    {
        var project = await projectService.GetByIdAsync(projectId, ownerId, cancellationToken);
        var task = await GetTaskForProjectAsync(taskId, project.ProjectId, cancellationToken);
        await taskRepository.DeleteAsync(task, cancellationToken);
    }

    private async System.Threading.Tasks.Task<DomainTask> GetTaskForProjectAsync(
        Guid taskId,
        ProjectId projectId,
        CancellationToken cancellationToken)
    {
        var task = await taskRepository.GetByIdForProjectAsync(taskId, projectId, cancellationToken);

        if (task is null)
        {
            throw new TaskNotFoundException(taskId);
        }

        return task;
    }
}
