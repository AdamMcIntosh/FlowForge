using FlowForge.Application.Projects;
using FlowForge.Domain.Users;
using FlowForge.Tests.Fixtures;

namespace FlowForge.Tests;

[Collection(nameof(UserServiceEfCoreCollection))]
public class ProjectServiceIntegrationTests(UserServiceEfCoreFixture fixture)
{
    [Fact]
    public async Task CreateAsync_ThenGetByIdAsync_ReturnsProjectForOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();

        var created = await projectService.CreateAsync(ownerId, "Alpha");
        var found = await projectService.GetByIdAsync(created.Id, ownerId);

        Assert.Equal(created.Id, found.Id);
        Assert.Equal("Alpha", found.Name);
        Assert.Equal(ownerId, found.OwnerId);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsOnlyProjectsForOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();
        var otherOwnerId = UserId.New();

        var owned = await projectService.CreateAsync(ownerId, "Mine");
        await projectService.CreateAsync(otherOwnerId, "Theirs");

        var projects = await projectService.GetAllAsync(ownerId);

        Assert.Single(projects);
        Assert.Equal(owned.Id, projects[0].Id);
    }

    [Fact]
    public async Task GetByIdAsync_WhenOwnerDoesNotMatch_ThrowsUnauthorizedProjectAccessException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();
        var created = await projectService.CreateAsync(ownerId, "Private");

        await Assert.ThrowsAsync<UnauthorizedProjectAccessException>(() =>
            projectService.GetByIdAsync(created.Id, UserId.New()));
    }

    [Fact]
    public async Task GetByIdAsync_WhenMissing_ThrowsProjectNotFoundException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);

        await Assert.ThrowsAsync<ProjectNotFoundException>(() =>
            projectService.GetByIdAsync(Guid.NewGuid(), UserId.New()));
    }

    [Fact]
    public async Task UpdateAsync_RenamesProjectForOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();
        var created = await projectService.CreateAsync(ownerId, "Old Name");

        var updated = await projectService.UpdateAsync(created.Id, ownerId, "New Name");
        var found = await projectService.GetByIdAsync(created.Id, ownerId);

        Assert.Equal("New Name", updated.Name);
        Assert.Equal("New Name", found.Name);
    }

    [Fact]
    public async Task UpdateAsync_WhenOwnerDoesNotMatch_ThrowsUnauthorizedProjectAccessException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();
        var created = await projectService.CreateAsync(ownerId, "Protected");

        await Assert.ThrowsAsync<UnauthorizedProjectAccessException>(() =>
            projectService.UpdateAsync(created.Id, UserId.New(), "Hacked"));
    }

    [Fact]
    public async Task DeleteAsync_RemovesProjectForOwner()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();
        var created = await projectService.CreateAsync(ownerId, "Delete Me");

        await projectService.DeleteAsync(created.Id, ownerId);

        await Assert.ThrowsAsync<ProjectNotFoundException>(() =>
            projectService.GetByIdAsync(created.Id, ownerId));
    }

    [Fact]
    public async Task DeleteAsync_WhenOwnerDoesNotMatch_ThrowsUnauthorizedProjectAccessException()
    {
        using var scope = fixture.CreateScope();
        var projectService = fixture.ResolveProjectService(scope);
        var ownerId = UserId.New();
        var created = await projectService.CreateAsync(ownerId, "Keep Me");

        await Assert.ThrowsAsync<UnauthorizedProjectAccessException>(() =>
            projectService.DeleteAsync(created.Id, UserId.New()));
    }
}
