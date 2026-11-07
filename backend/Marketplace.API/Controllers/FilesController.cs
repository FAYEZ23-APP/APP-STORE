using System.Text.RegularExpressions;
using Marketplace.API.Extensions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController : ControllerBase
{
    private static readonly Regex ValidFileNameRegex = new(
        @"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp|pdf)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly IFileStorageProvider _storageProvider;
    private readonly IImageUploadService _imageUploadService;
    private readonly IFileRetentionService _retentionService;
    private readonly IUnitOfWork _uow;
    private readonly ILogger<FilesController> _logger;

    public FilesController(
        IFileStorageProvider storageProvider,
        IImageUploadService imageUploadService,
        IFileRetentionService retentionService,
        IUnitOfWork uow,
        ILogger<FilesController> logger)
    {
        _storageProvider = storageProvider;
        _imageUploadService = imageUploadService;
        _retentionService = retentionService;
        _uow = uow;
        _logger = logger;
    }

    /// <summary>
    /// Serves private return evidence and dispute documents with strict PDPL Law 151/2020 access control.
    /// Only accessible by: Admin, the Uploader (Buyer/Participant), or the counterparty Seller involved in the return.
    /// </summary>
    [HttpGet("private/{fileName}")]
    [EnableRateLimiting("download-policy")]
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
        var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Unknown";
        var isAdmin = User.IsInRole("Admin");
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // Locate database metadata record
        var fileRecord = (await _uow.UploadedFiles.FindAsync(
            f => !f.IsDeleted && (f.FileName == safeFileName || f.RelativeUrl == $"/api/files/private/{safeFileName}"))).FirstOrDefault();

        if (fileRecord == null)
        {
            _logger.LogWarning("[SECURITY AUDIT] Private file download 404: '{FileName}' not found or deleted. Requested by User {UserId} ({Role}) from IP {IP}",
                safeFileName, currentUserId, userRole, clientIp);
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
            _logger.LogWarning("[SECURITY AUDIT WARNING] Unauthorized download attempt: User {UserId} (Role: {Role}) attempted to access private file '{FileName}' from IP {IP}",
                currentUserId, userRole, safeFileName, clientIp);
            return Forbid();
        }

        var stream = await _storageProvider.GetPrivateFileStreamAsync(safeFileName, "returns");
        if (stream == null)
        {
            stream = await _storageProvider.GetPrivateFileStreamAsync(safeFileName, "disputes");
        }

        if (stream == null)
        {
            _logger.LogWarning("[SECURITY AUDIT] Private file content not found in storage: '{FileName}'. User {UserId} ({Role}) from IP {IP}",
                safeFileName, currentUserId, userRole, clientIp);
            return NotFound(new { error = "File content is not available in private storage." });
        }

        _logger.LogInformation("[SECURITY AUDIT] Private file download authorized: User {UserId} ({Role}) downloaded '{FileName}' (Category: {Category}, Size: {Size} bytes) from IP {IP}",
            currentUserId, userRole, safeFileName, fileRecord.Category, fileRecord.SizeBytes, clientIp);

        var extension = Path.GetExtension(safeFileName).ToLowerInvariant();
        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };

        return File(stream, contentType, enableRangeProcessing: true);
    }

    /// <summary>
    /// Upload private return defect evidence (PDPL Law 151/2020 private storage).
    /// </summary>
    [HttpPost("private/return-evidence")]
    [Authorize(Roles = "Buyer")]
    [EnableRateLimiting("upload-policy")]
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
            subFolder: "returns",
            clientContentType: file.ContentType,
            category: FileCategory.ReturnEvidence);

        return Ok(new
        {
            url = result.Url,
            fileName = result.FileName,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }

    /// <summary>
    /// Upload private dispute documents or evidence (images or PDF, PDPL Law 151/2020 private storage).
    /// </summary>
    [HttpPost("private/dispute-evidence")]
    [EnableRateLimiting("upload-policy")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadDisputeEvidence(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No dispute document provided." });
        }

        var userId = User.GetUserId();
        await using var stream = file.OpenReadStream();
        var result = await _imageUploadService.ProcessAndSavePrivateDocumentAsync(
            userId,
            stream,
            file.FileName,
            file.Length,
            subFolder: "disputes",
            clientContentType: file.ContentType,
            category: FileCategory.DisputeEvidence);

        return Ok(new
        {
            url = result.Url,
            fileName = result.FileName,
            contentType = result.ContentType,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }

    /// <summary>
    /// Apply or lift legal/operational hold on a dispute document (Admin only).
    /// </summary>
    [HttpPut("private/{fileName}/hold")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetLegalHold(string fileName, [FromBody] LegalHoldRequest request)
    {
        if (string.IsNullOrWhiteSpace(fileName) || !ValidFileNameRegex.IsMatch(fileName.Trim()))
        {
            return BadRequest(new { error = "Invalid file identifier." });
        }

        var adminId = User.GetUserId();
        var success = await _retentionService.SetLegalHoldAsync(fileName.Trim(), request.IsHold, adminId);
        if (!success)
        {
            return NotFound(new { error = "File not found or already deleted." });
        }

        return Ok(new { fileName = fileName.Trim(), isLegalHold = request.IsHold });
    }
}

public class LegalHoldRequest
{
    public bool IsHold { get; set; }
}
