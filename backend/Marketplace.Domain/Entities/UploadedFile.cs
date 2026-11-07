using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class UploadedFile
{
    public int Id { get; set; }
    public int UploaderId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string RelativeUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public FileCategory Category { get; set; } = FileCategory.ProductImage;
    public bool IsPrivate { get; set; } = false;
    public bool IsLegalHold { get; set; } = false;
    public DateTime? RetentionExpiresAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public bool IsDeleted { get; set; } = false;

    public User Uploader { get; set; } = null!;
}
