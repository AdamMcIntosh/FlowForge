using DomainTask = FlowForge.Domain.Tasks.Task;
using FlowForge.Domain.Projects;
using FlowForge.Tests.Fixtures;
using TaskId = FlowForge.Domain.Tasks.TaskId;

namespace FlowForge.Tests;

[Collection(nameof(InMemoryTaskRepositoryCollection))]
public class InMemoryTaskRepositoryTests(InMemoryTaskRepositoryFixture fixture)
{
    private static ProjectId CreateProjectId() => ProjectId.New();

    [Fact]
    public async Task AddAsync_ThenGetByIdAsync_ReturnsTask()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var task = new DomainTask(projectId, "Alpha");

        await repository.AddAsync(task);

        var found = await repository.GetByIdAsync(task.Id);

        Assert.NotNull(found);
        Assert.Equal(task.Id, found.Id);
        Assert.Equal(task.Name, found.Name);
        Assert.Equal(projectId, found.ProjectId);
    }

    [Fact]
    public async Task AddAsync_ThenFindByNameForProjectAsync_ReturnsTask()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var task = new DomainTask(projectId, "Beta");

        await repository.AddAsync(task);

        var found = await repository.FindByNameForProjectAsync("Beta", projectId);

        Assert.NotNull(found);
        Assert.Equal(task.Id, found.Id);
    }

    [Fact]
    public async Task FindByNameForProjectAsync_TrimsSearchName()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var task = new DomainTask(projectId, "Gamma");
        await repository.AddAsync(task);

        var found = await repository.FindByNameForProjectAsync("  Gamma  ", projectId);

        Assert.NotNull(found);
        Assert.Equal(task.Id, found.Id);
    }

    [Fact]
    public async Task GetAllByProjectAsync_ReturnsOnlyTasksForProject()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var otherProjectId = CreateProjectId();
        var owned = new DomainTask(projectId, "Owned");
        var other = new DomainTask(otherProjectId, "Other");

        await repository.AddAsync(owned);
        await repository.AddAsync(other);

        var tasks = await repository.GetAllByProjectAsync(projectId);

        Assert.Single(tasks);
        Assert.Equal(owned.Id, tasks[0].Id);
    }

    [Fact]
    public async Task GetByIdForProjectAsync_WhenProjectMatches_ReturnsTask()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var task = new DomainTask(projectId, "Mine");
        await repository.AddAsync(task);

        var found = await repository.GetByIdForProjectAsync(task.Id, projectId);

        Assert.NotNull(found);
        Assert.Equal(task.Id, found.Id);
    }

    [Fact]
    public async Task GetByIdForProjectAsync_WhenProjectDoesNotMatch_ReturnsNull()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var task = new DomainTask(projectId, "Not Yours");
        await repository.AddAsync(task);

        var found = await repository.GetByIdForProjectAsync(task.Id, CreateProjectId());

        Assert.Null(found);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllTasks()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var first = new DomainTask(CreateProjectId(), "One");
        var second = new DomainTask(CreateProjectId(), "Two");

        await repository.AddAsync(first);
        await repository.AddAsync(second);

        var tasks = await repository.GetAllAsync();

        Assert.Equal(2, tasks.Count);
        Assert.Contains(tasks, task => task.Id == first.Id);
        Assert.Contains(tasks, task => task.Id == second.Id);
    }

    [Fact]
    public async Task UpdateAsync_ReplacesStoredTask()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var task = new DomainTask(CreateProjectId(), "Update Me");
        await repository.AddAsync(task);

        task.UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(5);
        await repository.UpdateAsync(task);

        var found = await repository.GetByIdAsync(task.Id);

        Assert.NotNull(found);
        Assert.Equal(task.UpdatedAt, found.UpdatedAt);
    }

    [Fact]
    public async Task DeleteAsync_RemovesTask()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        var task = new DomainTask(projectId, "Delete Me");
        await repository.AddAsync(task);

        await repository.DeleteAsync(task);

        Assert.Null(await repository.GetByIdAsync(task.Id));
        Assert.Null(await repository.FindByNameForProjectAsync(task.Name, projectId));
    }

    [Fact]
    public async Task GetByIdAsync_WhenMissing_ReturnsNull()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);

        var found = await repository.GetByIdAsync(Guid.NewGuid());

        Assert.Null(found);
    }

    [Fact]
    public async Task AddAsync_WhenDuplicateNameInSameProject_Throws()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        await repository.AddAsync(new DomainTask(projectId, "Duplicate"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.AddAsync(new DomainTask(projectId, "Duplicate")));
    }

    [Fact]
    public async Task AddAsync_WhenSameNameInDifferentProjects_Succeeds()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var firstProjectId = CreateProjectId();
        var secondProjectId = CreateProjectId();

        await repository.AddAsync(new DomainTask(firstProjectId, "Shared Name"));
        await repository.AddAsync(new DomainTask(secondProjectId, "Shared Name"));

        var tasks = await repository.GetAllAsync();

        Assert.Equal(2, tasks.Count);
    }

    [Fact]
    public async Task AddAsync_WhenDuplicateId_Throws()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var taskId = TaskId.New();
        var projectId = CreateProjectId();
        await repository.AddAsync(new DomainTask(taskId, projectId, "First"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.AddAsync(new DomainTask(taskId, projectId, "Second")));
    }

    [Fact]
    public async Task UpdateAsync_WhenMissing_Throws()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var task = new DomainTask(CreateProjectId(), "Missing");

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateAsync(task));
    }

    [Fact]
    public async Task UpdateAsync_WhenRenamingToDuplicateNameInProject_Throws()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var projectId = CreateProjectId();
        await repository.AddAsync(new DomainTask(projectId, "First"));
        var second = new DomainTask(projectId, "Second");
        await repository.AddAsync(second);

        second.Rename("First");

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateAsync(second));
    }

    [Fact]
    public async Task DeleteAsync_WhenMissing_Throws()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveTaskRepository(scope);
        var task = new DomainTask(CreateProjectId(), "Missing");

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.DeleteAsync(task));
    }
}
