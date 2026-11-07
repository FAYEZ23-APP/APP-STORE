using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Privacy;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/admin/privacy")]
[Authorize(Roles = "Admin")]
public class PrivacyAdminController : ControllerBase
{
    private readonly IPrivacyService _privacyService;
    private readonly IPrivacyIncidentService _incidentService;
    private readonly IPrivacyProcessingRegisterService _registerService;
    private readonly IThirdPartyProcessorDeletionService _processorService;

    public PrivacyAdminController(
        IPrivacyService privacyService,
        IPrivacyIncidentService incidentService,
        IPrivacyProcessingRegisterService registerService,
        IThirdPartyProcessorDeletionService processorService)
    {
        _privacyService = privacyService;
        _incidentService = incidentService;
        _registerService = registerService;
        _processorService = processorService;
    }

    /// <summary>List all data subject privacy requests with statutory 6-working-day SLA tracking.</summary>
    [HttpGet("requests")]
    [ProducesResponseType(typeof(IEnumerable<AdminPrivacyRequestResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<AdminPrivacyRequestResponse>>> GetPrivacyRequests(
        [FromQuery] string? status = null,
        [FromQuery] bool? overdueOnly = null)
    {
        var result = await _privacyService.GetAdminPrivacyRequestsAsync(status, overdueOnly);
        return Ok(result);
    }

    /// <summary>Review, approve, reject, or place a data subject request on legal hold.</summary>
    [HttpPost("requests/{id:int}/review")]
    [ProducesResponseType(typeof(AdminPrivacyRequestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminPrivacyRequestResponse>> ReviewPrivacyRequest(
        int id,
        [FromBody] ReviewPrivacyRequestInput input)
    {
        var adminId = User.GetUserId();
        var result = await _privacyService.ReviewPrivacyRequestAsync(id, adminId, input);
        return Ok(result);
    }

    /// <summary>Log a privacy/security incident with statutory 72-hour Center notification tracking.</summary>
    [HttpPost("incidents")]
    [ProducesResponseType(typeof(PrivacyIncidentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PrivacyIncidentResponse>> CreateIncident([FromBody] CreatePrivacyIncidentRequest request)
    {
        var adminId = User.GetUserId();
        var incident = await _incidentService.CreateIncidentAsync(adminId, request);
        return CreatedAtAction(nameof(GetIncidentById), new { id = incident.Id }, incident);
    }

    /// <summary>List security and privacy breach incidents.</summary>
    [HttpGet("incidents")]
    [ProducesResponseType(typeof(IEnumerable<PrivacyIncidentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<PrivacyIncidentResponse>>> GetIncidents([FromQuery] string? status = null)
    {
        var result = await _incidentService.GetIncidentsAsync(status);
        return Ok(result);
    }

    /// <summary>Get details of a specific privacy incident.</summary>
    [HttpGet("incidents/{id:int}")]
    [ProducesResponseType(typeof(PrivacyIncidentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PrivacyIncidentResponse>> GetIncidentById(int id)
    {
        var result = await _incidentService.GetIncidentByIdAsync(id);
        return Ok(result);
    }

    /// <summary>Generate official regulatory notification dossier for the Personal Data Protection Center.</summary>
    [HttpGet("incidents/{id:int}/report")]
    [ProducesResponseType(typeof(PrivacyIncidentCenterReport), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PrivacyIncidentCenterReport>> GetCenterReport(int id)
    {
        var report = await _incidentService.GenerateCenterReportAsync(id);
        return Ok(report);
    }

    /// <summary>Update incident remediation, containment, and notification status.</summary>
    [HttpPut("incidents/{id:int}")]
    [ProducesResponseType(typeof(PrivacyIncidentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PrivacyIncidentResponse>> UpdateIncident(
        int id,
        [FromBody] UpdatePrivacyIncidentRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _incidentService.UpdateIncidentAsync(id, adminId, request);
        return Ok(result);
    }

    /// <summary>Retrieve electronic personal data processing register (PDPL 151/2020 Article 8).</summary>
    [HttpGet("processing-register")]
    [ProducesResponseType(typeof(PrivacyProcessingRegisterResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PrivacyProcessingRegisterResponse>> GetProcessingRegister()
    {
        var register = await _registerService.GetRegisterAsync();
        return Ok(register);
    }

    /// <summary>Retry a failed third-party processor deletion job.</summary>
    [HttpPost("processor-deletion/{id:int}/retry")]
    [ProducesResponseType(typeof(ProcessorDeletionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProcessorDeletionResult>> RetryProcessorDeletion(int id)
    {
        var result = await _processorService.RetryProcessorDeletionAsync(id);
        return Ok(result);
    }
}
