using FlowForge.Domain.Users;

namespace FlowForge.Application.Users;

public interface IUserService
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<User> CreateAsync(string email, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<AuthResult> RegisterAsync(string email, string password, CancellationToken cancellationToken = default);

    Task<AuthResult> LoginAsync(string email, string password, CancellationToken cancellationToken = default);
}
