using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    /// <summary>Create a new order (Checkout). (Buyer only)</summary>
    [HttpPost]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderResponse>> CreateOrder(CreateOrderRequest request)
    {
        var buyerId = User.GetUserId();
        var order = await _orderService.CreateOrderAsync(buyerId, request);
        return StatusCode(StatusCodes.Status201Created, order);
    }

    /// <summary>Get all orders for the logged-in buyer. (Buyer only)</summary>
    [HttpGet("mine")]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(IEnumerable<OrderResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<OrderResponse>>> GetMyOrders()
    {
        var buyerId = User.GetUserId();
        var orders = await _orderService.GetBuyerOrdersAsync(buyerId);
        return Ok(orders);
    }

    /// <summary>Get all orders containing products belonging to the logged-in seller. (Seller only)</summary>
    [HttpGet("seller")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(IEnumerable<SellerOrderResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<SellerOrderResponse>>> GetSellerOrders()
    {
        var sellerId = User.GetUserId();
        var orders = await _orderService.GetSellerOrdersAsync(sellerId);
        return Ok(orders);
    }

    /// <summary>Update the status of an order. Must contain a product belonging to the seller. (Seller only)</summary>
    [HttpPut("{id:int}/status")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdateOrderStatus(int id, UpdateOrderStatusRequest request)
    {
        var sellerId = User.GetUserId();
        await _orderService.UpdateOrderStatusAsync(sellerId, id, request.Status);
        return NoContent();
    }
}
