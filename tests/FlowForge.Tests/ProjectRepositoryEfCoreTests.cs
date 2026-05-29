using FlowForge.Domain.Projects;
using FlowForge.Domain.Users;
using FlowForge.Tests.Fixtures;

namespace FlowForge.Tests;

[Collection(nameof(UserServiceEfCoreCollection))]
public class ProjectRepositoryEfCoreTests(UserServiceEfCoreFixture fixture)
{
    [Fact]
    public async Task AddAsync_ThenGetByIdAsync_PersistsOwnerId()
    {
        using var scope = fixture.CreateScope();
        var repository = fixture.ResolveProjectRepository(scope);
        var ownerId = UserId.New();
        var project = new Project(ownerId, "EF Owner Test");

        await repository.AddAsync(project);

        var found = await repository.GetByIdAsync(project.Id);

        Assert.NotNull(found);
        Assert.Equal(ownerId, found.OwnerId);
        Assert.Equal(project.Name, found.Name);
    }
}
