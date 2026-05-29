using FlowForge.Domain.Common;

namespace FlowForge.Domain.Users;

public sealed class PasswordHash : ValueObject
{
    public const int MaxLength = 512;

    public string Value { get; }

    private PasswordHash(string value) => Value = value;

    public static PasswordHash Create(string hash)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(hash);

        if (hash.Length > MaxLength)
        {
            throw new ArgumentException("Password hash is too long.", nameof(hash));
        }

        return new PasswordHash(hash);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
}
