using FlowForge.Domain.Users;

namespace FlowForge.Infrastructure.Persistence.Repositories;

/// <summary>
/// In-memory <see cref="IUserRepository"/> for tests and local development.
/// Mirrors Prisma client semantics: lookups return null when missing;
/// create/update/delete throw when unique constraints or records are violated.
/// </summary>
public class InMemoryUserRepository : IUserRepository
{
    private readonly Dictionary<Guid, User> _usersById = new();
    private readonly Dictionary<string, User> _usersByEmail = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            _usersById.TryGetValue(id, out var user);
            return Task.FromResult(user);
        }
    }

    public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            IReadOnlyList<User> users = _usersById.Values.ToList();
            return Task.FromResult(users);
        }
    }

    public Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(user);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (_usersById.ContainsKey(user.Id))
            {
                throw new InvalidOperationException($"A user with id '{user.Id}' already exists.");
            }

            var emailKey = user.Email.Value;
            if (_usersByEmail.ContainsKey(emailKey))
            {
                throw new InvalidOperationException($"A user with email '{emailKey}' already exists.");
            }

            _usersById[user.Id] = user;
            _usersByEmail[emailKey] = user;
        }

        return Task.CompletedTask;
    }

    public Task UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(user);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (!_usersById.TryGetValue(user.Id, out var existing))
            {
                throw new InvalidOperationException($"User with id '{user.Id}' was not found.");
            }

            var newEmailKey = user.Email.Value;
            var existingEmailKey = existing.Email.Value;

            if (!string.Equals(existingEmailKey, newEmailKey, StringComparison.Ordinal)
                && _usersByEmail.ContainsKey(newEmailKey))
            {
                throw new InvalidOperationException($"A user with email '{newEmailKey}' already exists.");
            }

            if (!string.Equals(existingEmailKey, newEmailKey, StringComparison.Ordinal))
            {
                _usersByEmail.Remove(existingEmailKey);
                _usersByEmail[newEmailKey] = user;
            }

            _usersById[user.Id] = user;
        }

        return Task.CompletedTask;
    }

    public Task DeleteAsync(User user, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(user);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            if (!_usersById.Remove(user.Id))
            {
                throw new InvalidOperationException($"User with id '{user.Id}' was not found.");
            }

            _usersByEmail.Remove(user.Email.Value);
        }

        return Task.CompletedTask;
    }

    public Task<User?> FindByEmailAsync(Email email, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(email);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_sync)
        {
            _usersByEmail.TryGetValue(email.Value, out var user);
            return Task.FromResult(user);
        }
    }
}
