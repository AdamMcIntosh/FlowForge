using FlowForge.Application.Users;
using FlowForge.Domain.Users;
using FlowForge.Tests.Fixtures;
using System.IdentityModel.Tokens.Jwt;

namespace FlowForge.Tests;

[Collection(nameof(UserServiceEfCoreCollection))]
public class UserServiceIntegrationTests(UserServiceEfCoreFixture fixture)
{
    [Fact]
    public async Task CreateAsync_ThenGetByEmailAsync_ReturnsUser()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        var created = await userService.CreateAsync("alice@example.com");
        var found = await userService.GetByEmailAsync("alice@example.com");

        Assert.NotNull(found);
        Assert.Equal(created.Id, found.Id);
        Assert.Equal(created.Email, found.Email);
    }

    [Fact]
    public async Task GetByEmailAsync_WhenMissing_ReturnsNull()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        var found = await userService.GetByEmailAsync("missing@example.com");

        Assert.Null(found);
    }

    [Fact]
    public async Task CreateAsync_ThenGetByEmailAsync_WithDifferentCasing_FindsSameUser()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        var created = await userService.CreateAsync("Bob@Example.COM");
        var found = await userService.GetByEmailAsync("bob@example.com");

        Assert.NotNull(found);
        Assert.Equal(created.Id, found.Id);
        Assert.Equal(Email.Create("bob@example.com"), found.Email);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateEmail_Throws()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        await userService.CreateAsync("dup@example.com");

        await Assert.ThrowsAnyAsync<Exception>(() =>
            userService.CreateAsync("dup@example.com"));
    }

    [Fact]
    public async Task RegisterAsync_ThenLoginAsync_ReturnsJwtWithUniqueJti()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        var registered = await userService.RegisterAsync("auth@example.com", "SecurePass123!");
        var loggedIn = await userService.LoginAsync("auth@example.com", "SecurePass123!");

        Assert.False(string.IsNullOrWhiteSpace(registered.AccessToken));
        Assert.Equal(registered.UserId, loggedIn.UserId);
        Assert.Equal("auth@example.com", registered.Email);
        Assert.Equal(registered.Email, loggedIn.Email);

        var handler = new JwtSecurityTokenHandler();
        var registeredJti = handler.ReadJwtToken(registered.AccessToken).Claims
            .Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
        var loggedInJti = handler.ReadJwtToken(loggedIn.AccessToken).Claims
            .Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;

        Assert.False(string.IsNullOrWhiteSpace(registeredJti));
        Assert.False(string.IsNullOrWhiteSpace(loggedInJti));
        Assert.NotEqual(registeredJti, loggedInJti);
    }

    [Fact]
    public async Task RegisterAsync_WithDuplicateEmail_ThrowsDuplicateEmailException()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        await userService.RegisterAsync("dup-auth@example.com", "SecurePass123!");

        await Assert.ThrowsAsync<DuplicateEmailException>(() =>
            userService.RegisterAsync("dup-auth@example.com", "OtherPass456!"));
    }

    [Fact]
    public async Task LoginAsync_WithWrongPassword_ThrowsInvalidCredentialsException()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        await userService.RegisterAsync("wrong-pass@example.com", "SecurePass123!");

        await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            userService.LoginAsync("wrong-pass@example.com", "WrongPass456!"));
    }

    [Fact]
    public async Task LoginAsync_WhenUserMissing_ThrowsInvalidCredentialsException()
    {
        using var scope = fixture.CreateScope();
        var userService = fixture.ResolveUserService(scope);

        await Assert.ThrowsAsync<InvalidCredentialsException>(() =>
            userService.LoginAsync("missing-auth@example.com", "SecurePass123!"));
    }
}
