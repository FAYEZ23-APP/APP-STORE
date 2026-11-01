namespace Marketplace.Application.Common;

public class StorageSettings
{
    public const string SectionName = "Storage";

    /// <summary>
    /// Storage provider: "Local" (default) or "S3" (S3 / Cloudflare R2).
    /// </summary>
    public string Provider { get; set; } = "Local";

    /// <summary>
    /// Relative or absolute path for public files (e.g., product images). Default: "wwwroot/uploads".
    /// </summary>
    public string LocalPublicPath { get; set; } = "wwwroot/uploads";

    /// <summary>
    /// Relative or absolute path for private files (e.g., return evidence). Default: "App_Data/private-uploads".
    /// </summary>
    public string LocalPrivatePath { get; set; } = "App_Data/private-uploads";

    // S3 / Cloudflare R2 options
    public string? S3ServiceUrl { get; set; }
    public string? S3BucketName { get; set; }
    public string? S3AccessKey { get; set; }
    public string? S3SecretKey { get; set; }
    public string? S3Region { get; set; } = "auto";
}
