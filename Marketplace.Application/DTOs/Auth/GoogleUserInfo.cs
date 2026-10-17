namespace Marketplace.Application.DTOs.Auth;

public class GoogleUserInfo
{
    public string GoogleId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? PictureUrl { get; set; }
    public bool EmailVerified { get; set; }
}
