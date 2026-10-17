using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Wallet;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/wallet")]
[Authorize(Roles = "Seller")]
public class WalletController : ControllerBase
{
    private readonly IWalletService _walletService;

    public WalletController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    /// <summary>Get current seller's wallet balance and recent transactions. (Seller only)</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(VendorWalletResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VendorWalletResponse>> GetMyWallet()
    {
        var sellerId = User.GetUserId();
        var wallet = await _walletService.GetSellerWalletAsync(sellerId);
        return Ok(wallet);
    }

    /// <summary>Submit a payout request for available balance. (Seller only)</summary>
    [HttpPost("payout-request")]
    [ProducesResponseType(typeof(PayoutRequestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PayoutRequestResponse>> RequestPayout([FromBody] CreatePayoutRequest request)
    {
        var sellerId = User.GetUserId();
        var payout = await _walletService.RequestPayoutAsync(sellerId, request);
        return Ok(payout);
    }

    /// <summary>Get current seller's payout request history. (Seller only)</summary>
    [HttpGet("payouts")]
    [ProducesResponseType(typeof(IEnumerable<PayoutRequestResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<PayoutRequestResponse>>> GetMyPayouts()
    {
        var sellerId = User.GetUserId();
        var payouts = await _walletService.GetSellerPayoutRequestsAsync(sellerId);
        return Ok(payouts);
    }
}
