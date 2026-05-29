using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using FlowForge.Infrastructure.Persistence.Repositories;

namespace FlowForge.Tests;

public class InMemoryProjectRepositoryTests
{
    private static InMemoryProjectRepository CreateRepository() => new();

    private static UserId CreateOwnerId() => UserId.New();

    [Fact]
    public async Task AddAsync_ThenGetByIdAsync_ReturnsProject()
    {
        var repository = CreateRepository();
        var ownerId = CreateOwnerId();
        var project = new Project(ownerId, "Alpha");

        await repository.AddAsync(project);

        var found = await repository.GetByIdAsync(project.Id);

        Assert.NotNull(found);
        Assert.Equal(project.Id, found.Id);
        Assert.Equal(project.Name, found.Name);
        Assert.Equal(ownerId, found.OwnerId);
    }

    [Fact]
    public async Task AddAsync_ThenFindByNameAsync_ReturnsProject()
    {
        var repository = CreateRepository();
        var project = new Project(CreateOwnerId(), "Beta");

        await repository.AddAsync(project);

        var found = await repository.FindByNameAsync("Beta");

        Assert.NotNull(found);
        Assert.Equal(project.Id, found.Id);
    }

    [Fact]
    public async Task FindByNameAsync_TrimsSearchName()
    {
        var repository = CreateRepository();
        var project = new Project(CreateOwnerId(), "Gamma");
        await repository.AddAsync(project);

        var found = await repository.FindByNameAsync("  Gamma  ");

        Assert.NotNull(found);
        Assert.Equal(project.Id, found.Id);
    }

    [Fact]
    public async Task GetAllByOwnerAsync_ReturnsOnlyProjectsForOwner()
    {
        var repository = CreateRepository();
        var ownerId = CreateOwnerId();
        var otherOwnerId = CreateOwnerId();
        var owned = new Project(ownerId, "Owned");
        var other = new Project(otherOwnerId, "Other");

        await repository.AddAsync(owned);
        await repository.AddAsync(other);

        var projects = await repository.GetAllByOwnerAsync(ownerId);

        Assert.Single(projects);
        Assert.Equal(owned.Id, projects[0].Id);
    }

    [Fact]
    public async Task GetByIdForOwnerAsync_WhenOwnerMatches_ReturnsProject()
    {
        var repository = CreateRepository();
        var ownerId = CreateOwnerId();
        var project = new Project(ownerId, "Mine");
        await repository.AddAsync(project);

        var found = await repository.GetByIdForOwnerAsync(project.Id, ownerId);

        Assert.NotNull(found);
        Assert.Equal(project.Id, found.Id);
    }

    [Fact]
    public async Task GetByIdForOwnerAsync_WhenOwnerDoesNotMatch_ReturnsNull()
    {
        var repository = CreateRepository();
        var ownerId = CreateOwnerId();
        var project = new Project(ownerId, "Not Yours");
        await repository.AddAsync(project);

        var found = await repository.GetByIdForOwnerAsync(project.Id, CreateOwnerId());

        Assert.Null(found);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllProjects()
    {
        var repository = CreateRepository();
        var first = new Project(CreateOwnerId(), "One");
        var second = new Project(CreateOwnerId(), "Two");

        await repository.AddAsync(first);
        await repository.AddAsync(second);

        var projects = await repository.GetAllAsync();

        Assert.Equal(2, projects.Count);
        Assert.Contains(projects, project => project.Id == first.Id);
        Assert.Contains(projects, project => project.Id == second.Id);
    }

    [Fact]
    public async Task UpdateAsync_ReplacesStoredProject()
    {
        var repository = CreateRepository();
        var project = new Project(CreateOwnerId(), "Update Me");
        await repository.AddAsync(project);

        project.UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(5);
        await repository.UpdateAsync(project);

        var found = await repository.GetByIdAsync(project.Id);

        Assert.NotNull(found);
        Assert.Equal(project.UpdatedAt, found.UpdatedAt);
    }

    [Fact]
    public async Task DeleteAsync_RemovesProject()
    {
        var repository = CreateRepository();
        var project = new Project(CreateOwnerId(), "Delete Me");
        await repository.AddAsync(project);

        await repository.DeleteAsync(project);

        Assert.Null(await repository.GetByIdAsync(project.Id));
        Assert.Null(await repository.FindByNameAsync(project.Name));
    }

    [Fact]
    public async Task GetByIdAsync_WhenMissing_ReturnsNull()
    {
        var repository = CreateRepository();

        var found = await repository.GetByIdAsync(Guid.NewGuid());

        Assert.Null(found);
    }

    [Fact]
    public async Task AddAsync_WhenDuplicateName_Throws()
    {
        var repository = CreateRepository();
        await repository.AddAsync(new Project(CreateOwnerId(), "Duplicate"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.AddAsync(new Project(CreateOwnerId(), "Duplicate")));
    }

    [Fact]
    public async Task DeleteAsync_WhenMissing_Throws()
    {
        var repository = CreateRepository();
        var project = new Project(CreateOwnerId(), "Missing");

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.DeleteAsync(project));
    }
}
