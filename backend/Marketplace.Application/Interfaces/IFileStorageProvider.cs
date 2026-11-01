namespace Marketplace.Application.Interfaces;

public interface IFileStorageProvider
{
    /// <summary>
    /// Persists cleaned image bytes to storage (public or secure private).
    /// </summary>
    /// <param name="cleanBytes">Clean bytes with EXIF/GPS stripped.</param>
    /// <param name="fileName">Unique file name.</param>
    /// <param name="subFolder">Optional subfolder (e.g., "reviews", "returns").</param>
    /// <param name="isPrivate">Whether this file contains private user data (PDPL 151/2020).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Relative URL or identifier to access the file.</returns>
    Task<string> SaveFileAsync(
        byte[] cleanBytes,
        string fileName,
        string? subFolder,
        bool isPrivate,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a stream for an authorized private file download.
    /// </summary>
    Task<Stream?> GetPrivateFileStreamAsync(
        string fileName,
        string? subFolder = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a private file exists in storage.
    /// </summary>
    Task<bool> PrivateFileExistsAsync(
        string fileName,
        string? subFolder = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a file from storage.
    /// </summary>
    Task<bool> DeleteFileAsync(
        string relativePathOrFileName,
        bool isPrivate,
        CancellationToken cancellationToken = default);
}
