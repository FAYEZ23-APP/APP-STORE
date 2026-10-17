using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Notifications;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    /// <summary>Register or update device push token for push notifications (Expo / FCM).</summary>
    [HttpPost("register-token")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RegisterToken([FromBody] RegisterDeviceTokenRequest request)
    {
        var userId = User.GetUserId();
        await _notificationService.RegisterDeviceTokenAsync(userId, request);
        return Ok(new { success = true, message = "تم تسجيل رمز الجهاز بنجاح." });
    }
}
