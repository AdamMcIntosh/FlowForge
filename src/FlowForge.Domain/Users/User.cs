using FlowForge.Domain.Common;

namespace FlowForge.Domain.Users;

public class User : BaseEntity
{
    public UserId UserId { get; private set; } = null!;

    public Email Email { get; private set; } = null!;

    public PasswordHash? PasswordHash { get; private set; }

    private User()
    {
    }

    public User(Email email)
        : this(UserId.New(), email)
    {
    }

    public User(Email email, PasswordHash passwordHash)
        : this(UserId.New(), email, passwordHash)
    {
    }

    public User(UserId userId, Email email)
    {
        ArgumentNullException.ThrowIfNull(userId);
        ArgumentNullException.ThrowIfNull(email);

        UserId = userId;
        Id = userId.Value;
        Email = email;
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public User(UserId userId, Email email, PasswordHash passwordHash)
        : this(userId, email)
    {
        ArgumentNullException.ThrowIfNull(passwordHash);

        PasswordHash = passwordHash;
    }

    public void SetPasswordHash(PasswordHash passwordHash)
    {
        ArgumentNullException.ThrowIfNull(passwordHash);

        PasswordHash = passwordHash;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
