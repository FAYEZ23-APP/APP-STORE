using System.Text.RegularExpressions;
using Marketplace.API.Extensions;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController : ControllerBase
{
    private static readonly Regex ValidFileNameRegex = new(
        @"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly IFileStorageProvider _storageProvider;
    private readonly IImageUploadService _imageUploadService;
    private readonly IUnitOfWork _uow;

    public FilesController(
        IFileStorageProvider storageProvider,
        IImageUploadService imageUploadService,
        IUnitOfWork uow)
    {
        _storageProvider = storageProvider;
        _imageUploadService = imageUploadService;
        _uow = uow;
    }

    /// <summary>
    /// Serves private return evidence and dispute documents with strict PDPL Law 151/2020 access control.
    /// Only accessible by: Admin, the Uploader (Buyer), or the counterparty Seller involved in the return.
    /// </summary>
    [HttpGet("private/{fileName}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrivateFile(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || !ValidFileNameRegex.IsMatch(fileName.Trim()))
        {
            return BadRequest(new { error = "Invalid private file identifier." });
        }

        var safeFileName = fileName.Trim();
        var currentUserId = User.GetUserId();
        var isAdmin = User.IsInRole("Admin");

        // Locate database metadata record
        var fileRecord = (await _uow.UploadedFiles.FindAsync(
            f => f.FileName == safeFileName || f.RelativeUrl == $"/api/files/private/{safeFileName}")).FirstOrDefault();

        if (fileRecord == null)
        {
            return NotFound(new { error = "Private file not found." });
        }

        // Authorization check under PDPL Law 151/2020:
        // 1. Admin has supervisory audit access.
        // 2. The original uploader (e.g. Buyer who opened the return).
        // 3. The Seller involved in the specific ReturnRequest where this evidence is attached.
        var isAuthorized = isAdmin || fileRecord.UploaderId == currentUserId;

        if (!isAuthorized)
        {
            var matchingReturn = (await _uow.ReturnRequests.FindAsync(
                r => r.DefectImageUrl != null &&
                     (r.DefectImageUrl.Contains(safeFileName) || r.DefectImageUrl == fileRecord.RelativeUrl))).FirstOrDefault();

            if (matchingReturn != null && (matchingReturn.SellerId == currentUserId || matchingReturn.BuyerId == currentUserId))
            {
                isAuthorized = true;
            }
        }

        if (!isAuthorized)
        {
            return Forbid();
        }

        var stream = await _storageProvider.GetPrivateFileStreamAsync(safeFileName, "returns");
        if (stream == null)
        {
            return NotFound(new { error = "File content is not available in private storage." });
        }

        var extension = Path.GetExtension(safeFileName).ToLowerInvariant();
        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return File(stream, contentType, enableRangeProcessing: true);
    }

    /// <summary>
    /// Upload private return defect evidence (PDPL Law 151/2020 private storage).
    /// </summary>
    [HttpPost("private/return-evidence")]
    [Authorize(Roles = "Buyer")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadReturnEvidence(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No evidence file provided." });
        }

        var buyerId = User.GetUserId();
        await using var stream = file.OpenReadStream();
        var result = await _imageUploadService.ProcessAndSavePrivateImageAsync(
            buyerId,
            stream,
            file.FileName,
            file.Length,
            subFolder: "returns");

        return Ok(new
        {
            url = result.Url,
            fileName = result.FileName,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }
}
