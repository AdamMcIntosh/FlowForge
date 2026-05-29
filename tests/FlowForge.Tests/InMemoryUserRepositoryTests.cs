using FlowForge.Domain.Users;
using FlowForge.Infrastructure.Persistence.Repositories;

namespace FlowForge.Tests;

public class InMemoryUserRepositoryTests
{
    private static InMemoryUserRepository CreateRepository() => new();

    [Fact]
    public async Task AddAsync_ThenGetByIdAsync_ReturnsUser()
    {
        var repository = CreateRepository();
        var user = new User(Email.Create("alice@example.com"));

        await repository.AddAsync(user);

        var found = await repository.GetByIdAsync(user.Id);

        Assert.NotNull(found);
        Assert.Equal(user.Id, found.Id);
        Assert.Equal(user.Email, found.Email);
    }

    [Fact]
    public async Task AddAsync_ThenFindByEmailAsync_ReturnsUser()
    {
        var repository = CreateRepository();
        var email = Email.Create("bob@example.com");
        var user = new User(email);

        await repository.AddAsync(user);

        var found = await repository.FindByEmailAsync(email);

        Assert.NotNull(found);
        Assert.Equal(user.Id, found.Id);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllUsers()
    {
        var repository = CreateRepository();
        var first = new User(Email.Create("one@example.com"));
        var second = new User(Email.Create("two@example.com"));

        await repository.AddAsync(first);
        await repository.AddAsync(second);

        var users = await repository.GetAllAsync();

        Assert.Equal(2, users.Count);
        Assert.Contains(users, user => user.Id == first.Id);
        Assert.Contains(users, user => user.Id == second.Id);
    }

    [Fact]
    public async Task UpdateAsync_ReplacesStoredUser()
    {
        var repository = CreateRepository();
        var user = new User(Email.Create("update@example.com"));
        await repository.AddAsync(user);

        user.UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(5);
        await repository.UpdateAsync(user);

        var found = await repository.GetByIdAsync(user.Id);

        Assert.NotNull(found);
        Assert.Equal(user.UpdatedAt, found.UpdatedAt);
    }

    [Fact]
    public async Task DeleteAsync_RemovesUser()
    {
        var repository = CreateRepository();
        var user = new User(Email.Create("delete@example.com"));
        await repository.AddAsync(user);

        await repository.DeleteAsync(user);

        Assert.Null(await repository.GetByIdAsync(user.Id));
        Assert.Null(await repository.FindByEmailAsync(user.Email));
    }

    [Fact]
    public async Task GetByIdAsync_WhenMissing_ReturnsNull()
    {
        var repository = CreateRepository();

        var found = await repository.GetByIdAsync(Guid.NewGuid());

        Assert.Null(found);
    }

    [Fact]
    public async Task AddAsync_WhenDuplicateEmail_Throws()
    {
        var repository = CreateRepository();
        await repository.AddAsync(new User(Email.Create("dup@example.com")));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.AddAsync(new User(Email.Create("dup@example.com"))));
    }

    [Fact]
    public async Task DeleteAsync_WhenMissing_Throws()
    {
        var repository = CreateRepository();
        var user = new User(Email.Create("missing@example.com"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.DeleteAsync(user));
    }
}
