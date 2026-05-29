using FlowForge.Application.Projects;
using FlowForge.Application.Tasks;
using FlowForge.Domain.Users;
using FlowForge.Tests.Fixtures;

namespace FlowForge.Tests;

[Collection(nameof(UserServiceEfCoreCollection))]
public class TaskServiceIntegrationTests(UserServiceEfCoreFixture fixture)
{
    [Fact]
    public async Task CreateAsync_ThenGetByIdAsync_ReturnsTaskForProjectOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();

        var project = await projectService.CreateAsync(ownerId, "Alpha");
        var created = await taskService.CreateAsync(project.Id, ownerId, "First Task");
        var found = await taskService.GetByIdAsync(project.Id, created.Id, ownerId);

        Assert.Equal(created.Id, found.Id);
        Assert.Equal("First Task", found.Name);
        Assert.Equal(project.ProjectId, found.ProjectId);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsOnlyTasksForProject()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();

        var project = await projectService.CreateAsync(ownerId, "Task Bucket");
        var first = await taskService.CreateAsync(project.Id, ownerId, "One");
        await taskService.CreateAsync(project.Id, ownerId, "Two");

        var tasks = await taskService.GetAllAsync(project.Id, ownerId);

        Assert.Equal(2, tasks.Count);
        Assert.Contains(tasks, t => t.Id == first.Id && t.Name == "One");
        Assert.Contains(tasks, t => t.Name == "Two");
    }

    [Fact]
    public async Task GetAllAsync_IsolatesTasksByProjectForSameOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();

        var projectA = await projectService.CreateAsync(ownerId, "Project A");
        var projectB = await projectService.CreateAsync(ownerId, "Project B");
        var taskInA = await taskService.CreateAsync(projectA.Id, ownerId, "Only In A");
        await taskService.CreateAsync(projectB.Id, ownerId, "Only In B");

        var tasksInA = await taskService.GetAllAsync(projectA.Id, ownerId);

        Assert.Single(tasksInA);
        Assert.Equal(taskInA.Id, tasksInA[0].Id);
    }

    [Fact]
    public async Task GetByIdAsync_WhenOwnerDoesNotMatchProject_ThrowsUnauthorizedProjectAccessException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var project = await projectService.CreateAsync(ownerId, "Private");
        var task = await taskService.CreateAsync(project.Id, ownerId, "Secret");

        await Assert.ThrowsAsync<UnauthorizedProjectAccessException>(() =>
            taskService.GetByIdAsync(project.Id, task.Id, UserId.New()));
    }

    [Fact]
    public async Task GetByIdAsync_WhenProjectMissing_ThrowsProjectNotFoundException()
    {
        using var scope = fixture.CreateScope();
        var taskService = fixture.ResolveTaskService(scope);

        await Assert.ThrowsAsync<ProjectNotFoundException>(() =>
            taskService.GetByIdAsync(Guid.NewGuid(), Guid.NewGuid(), UserId.New()));
    }

    [Fact]
    public async Task GetByIdAsync_WhenTaskMissing_ThrowsTaskNotFoundException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var project = await projectService.CreateAsync(ownerId, "Empty");

        await Assert.ThrowsAsync<TaskNotFoundException>(() =>
            taskService.GetByIdAsync(project.Id, Guid.NewGuid(), ownerId));
    }

    [Fact]
    public async Task GetByIdAsync_WhenTaskBelongsToDifferentProject_ThrowsTaskNotFoundException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var projectA = await projectService.CreateAsync(ownerId, "A");
        var projectB = await projectService.CreateAsync(ownerId, "B");
        var taskInA = await taskService.CreateAsync(projectA.Id, ownerId, "Scoped");

        await Assert.ThrowsAsync<TaskNotFoundException>(() =>
            taskService.GetByIdAsync(projectB.Id, taskInA.Id, ownerId));
    }

    [Fact]
    public async Task UpdateAsync_RenamesTaskForProjectOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var project = await projectService.CreateAsync(ownerId, "Rename Host");
        var created = await taskService.CreateAsync(project.Id, ownerId, "Old Name");

        var updated = await taskService.UpdateAsync(project.Id, created.Id, ownerId, "New Name");
        var found = await taskService.GetByIdAsync(project.Id, created.Id, ownerId);

        Assert.Equal("New Name", updated.Name);
        Assert.Equal("New Name", found.Name);
    }

    [Fact]
    public async Task UpdateAsync_WhenOwnerDoesNotMatch_ThrowsUnauthorizedProjectAccessException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var project = await projectService.CreateAsync(ownerId, "Protected");
        var task = await taskService.CreateAsync(project.Id, ownerId, "Keep");

        await Assert.ThrowsAsync<UnauthorizedProjectAccessException>(() =>
            taskService.UpdateAsync(project.Id, task.Id, UserId.New(), "Hacked"));
    }

    [Fact]
    public async Task DeleteAsync_RemovesTaskForProjectOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var project = await projectService.CreateAsync(ownerId, "Delete Host");
        var created = await taskService.CreateAsync(project.Id, ownerId, "Gone");

        await taskService.DeleteAsync(project.Id, created.Id, ownerId);

        await Assert.ThrowsAsync<TaskNotFoundException>(() =>
            taskService.GetByIdAsync(project.Id, created.Id, ownerId));
    }

    [Fact]
    public async Task DeleteAsync_WhenOwnerDoesNotMatch_ThrowsUnauthorizedProjectAccessException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var taskService = fixture.ResolveTaskService(scope);
        var ownerId = UserId.New();
        var project = await projectService.CreateAsync(ownerId, "Keep");
        var task = await taskService.CreateAsync(project.Id, ownerId, "Stay");

        await Assert.ThrowsAsync<UnauthorizedProjectAccessException>(() =>
            taskService.DeleteAsync(project.Id, task.Id, UserId.New()));
    }
}
