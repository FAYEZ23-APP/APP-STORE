namespace Marketplace.Domain.Entities;

/// <summary>
/// Refresh token record. Only a SHA-256 hash of the raw token is stored. Tokens belong to a rotation
/// <see cref="FamilyId"/> (one family per login/session); every refresh consumes the presented token and issues a
/// successor in the same family. Presenting an already-consumed/revoked token = replay => whole family revoked.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public int? ReplacedByTokenId { get; set; }

    /// <summary>Session (rotation family) identifier shared by every token descended from one login.</summary>
    public Guid FamilyId { get; set; } = Guid.NewGuid();

    /// <summary>Set (atomically) when the token is successfully exchanged for a successor.</summary>
    public DateTime? ConsumedAt { get; set; }

    /// <summary>Why the token was revoked (Logout, LogoutAll, PasswordChange, ReuseDetected, Expired, DeviceLimit, ...).</summary>
    public string? RevokeReason { get; set; }

    public User User { get; set; } = null!;
    public RefreshToken? ReplacedByToken { get; set; }
}
