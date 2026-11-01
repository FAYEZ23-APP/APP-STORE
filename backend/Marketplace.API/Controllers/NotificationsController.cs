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

    /// <summary>Get paginated list of user notifications with unread count.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(NotificationsListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<NotificationsListResponse>> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        var userId = User.GetUserId();
        var result = await _notificationService.GetUserNotificationsAsync(userId, page, pageSize);
        return Ok(result);
    }

    /// <summary>Get live unread notifications count for badges.</summary>
    [HttpGet("unread-count")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> GetUnreadCount()
    {
        var userId = User.GetUserId();
        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(new { unreadCount = count });
    }

    /// <summary>Mark a single notification as read.</summary>
    [HttpPut("{id:int}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> MarkAsRead([FromRoute] int id)
    {
        var userId = User.GetUserId();
        var success = await _notificationService.MarkAsReadAsync(userId, id);
        if (!success)
            return NotFound(new { error = "الإشعار غير موجود." });

        return Ok(new { success = true, message = "تم تحديد الإشعار كمقروء." });
    }

    /// <summary>Mark all user notifications as read.</summary>
    [HttpPut("read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> MarkAllAsRead()
    {
        var userId = User.GetUserId();
        var count = await _notificationService.MarkAllAsReadAsync(userId);
        return Ok(new { success = true, markedCount = count, message = "تم تحديد جميع الإشعارات كمقروءة." });
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

    /// <summary>Unregister a device push token (e.g. on logout).</summary>
    [HttpDelete("devices")]
    [HttpPost("unregister-token")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UnregisterToken([FromBody] UnregisterDeviceTokenRequest request)
    {
        var userId = User.GetUserId();
        await _notificationService.UnregisterDeviceTokenAsync(userId, request.DeviceToken);
        return Ok(new { success = true, message = "تم إلغاء تسجيل رمز الجهاز بنجاح." });
    }
}
