using System.Text.RegularExpressions;
using FlowForge.Domain.Common;

namespace FlowForge.Domain.Users;

public sealed partial class Email : ValueObject
{
    private static readonly Regex EmailPattern = MyRegex();

    public string Value { get; }

    private Email(string value) => Value = value;

    public static Email Create(string rawEmail)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawEmail);

        var normalized = rawEmail.Trim().ToLowerInvariant();

        if (normalized.Length > 320)
        {
            throw new ArgumentException("Email address is too long.", nameof(rawEmail));
        }

        if (!EmailPattern.IsMatch(normalized))
        {
            throw new ArgumentException("Email address format is invalid.", nameof(rawEmail));
        }

        return new Email(normalized);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.CultureInvariant)]
    private static partial Regex MyRegex();
}
