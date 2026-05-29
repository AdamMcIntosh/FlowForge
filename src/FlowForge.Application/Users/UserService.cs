using FlowForge.Application.Common.Interfaces;
using FlowForge.Domain.Users;
using Microsoft.Extensions.Logging;

namespace FlowForge.Application.Users;

public class UserService(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    ILogger<UserService> logger) : IUserService
{
    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        userRepository.GetByIdAsync(id, cancellationToken);

    public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default) =>
        userRepository.GetAllAsync(cancellationToken);

    public async Task<User> CreateAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = new User(Email.Create(email));
        await userRepository.AddAsync(user, cancellationToken);
        return user;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new InvalidOperationException($"User with id '{id}' was not found.");

        await userRepository.DeleteAsync(user, cancellationToken);
        logger.LogInformation("User deleted with {UserId}", id);
    }

    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        userRepository.FindByEmailAsync(Email.Create(email), cancellationToken);

    public async Task<AuthResult> RegisterAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default)
    {
        var emailValue = Email.Create(email);

        if (await userRepository.FindByEmailAsync(emailValue, cancellationToken) is not null)
        {
            throw new DuplicateEmailException(emailValue.Value);
        }

        var passwordHash = PasswordHash.Create(passwordHasher.HashPassword(password));
        var user = new User(emailValue, passwordHash);

        try
        {
            await userRepository.AddAsync(user, cancellationToken);
        }
        catch (Exception)
        {
            if (await userRepository.FindByEmailAsync(emailValue, cancellationToken) is not null)
            {
                throw new DuplicateEmailException(emailValue.Value);
            }

            throw;
        }

        logger.LogInformation("User registered with {UserId}", user.Id);
        return CreateAuthResult(user);
    }

    public async Task<AuthResult> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default)
    {
        var emailValue = Email.Create(email);
        var user = await userRepository.FindByEmailAsync(emailValue, cancellationToken);

        if (user?.PasswordHash is null
            || !passwordHasher.VerifyPassword(password, user.PasswordHash.Value))
        {
            logger.LogWarning("Login failed for invalid credentials");
            throw new InvalidCredentialsException();
        }

        logger.LogInformation("User logged in with {UserId}", user.Id);
        return CreateAuthResult(user);
    }

    private AuthResult CreateAuthResult(User user)
    {
        var accessToken = jwtTokenService.GenerateAccessToken(user.Id.ToString());
        return new AuthResult(accessToken, user.Id, user.Email.Value);
    }
}
