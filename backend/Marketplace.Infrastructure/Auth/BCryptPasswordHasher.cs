using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Infrastructure.Auth;

/// <summary>
/// BCrypt (BCrypt.Net-Next) password hasher. Salt is generated automatically per hash; verification uses the
/// library's constant-time comparison. Work factor is configurable via <c>Auth:BCryptWorkFactor</c>.
/// </summary>
public class BCryptPasswordHasher : IPasswordHasher
{
    public const int DefaultWorkFactor = 12;
    public const int MinWorkFactor = 10;
    public const int MaxWorkFactor = 15;

    private readonly int _workFactor;

    public BCryptPasswordHasher() : this(DefaultWorkFactor) { }

    public BCryptPasswordHasher(IConfiguration configuration)
        : this(configuration.GetValue("Auth:BCryptWorkFactor", DefaultWorkFactor)) { }

    public BCryptPasswordHasher(int workFactor)
    {
        _workFactor = Math.Clamp(workFactor, MinWorkFactor, MaxWorkFactor);
    }

    public int WorkFactor => _workFactor;

    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, _workFactor);

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrWhiteSpace(hash) || !IsBcryptHash(hash))
            return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (Exception ex) when (ex is BCrypt.Net.SaltParseException || ex is ArgumentException || ex is FormatException)
        {
            return false;
        }
    }

    public bool NeedsRehash(string hash)
    {
        if (string.IsNullOrWhiteSpace(hash) || !IsBcryptHash(hash)) return false;
        try
        {
            // $2b$12$... -> cost is chars 4..5
            var cost = int.Parse(hash.AsSpan(4, 2));
            var legacyPrefix = hash[2] != 'a' && hash[2] != 'b';
            return cost < _workFactor || legacyPrefix;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsBcryptHash(string hash) =>
        hash.Length == 60 &&
        hash[0] == '$' && hash[1] == '2' &&
        (hash[2] == 'a' || hash[2] == 'b' || hash[2] == 'x' || hash[2] == 'y') &&
        hash[3] == '$' && hash[6] == '$';
}
