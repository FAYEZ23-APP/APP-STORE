namespace Marketplace.Application.Interfaces;

public interface IPasswordHasher
{
    string Hash(string password);

    /// <summary>
    /// Constant-time verification. Returns false (never throws) for null/empty/unrecognised hash formats.
    /// </summary>
    bool Verify(string password, string hash);

    /// <summary>
    /// True when the stored hash is a recognised BCrypt hash whose work factor is lower than the configured one
    /// (or when it uses a legacy BCrypt prefix). Call only after a successful <see cref="Verify"/>.
    /// </summary>
    bool NeedsRehash(string hash);
}
