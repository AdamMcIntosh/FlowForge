namespace FlowForge.Application.Users;

public sealed class DuplicateEmailException : Exception
{
    public DuplicateEmailException(string email)
        : base($"A user with email '{email}' already exists.")
    {
        Email = email;
    }

    public string Email { get; }
}
