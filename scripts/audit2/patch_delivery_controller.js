const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.API/Controllers/DeliveryController.cs', 'utf8');

const target = '    /// <summary>Calculate per-seller parcel delivery quotes (cost and ETA) for a set of items and destination.</summary>';
const pudoMethod = `    /// <summary>List PUDO pickup hubs and smart lockers across Egyptian regions with optional distance calculation.</summary>
    [HttpGet("pudo-points")]
    [ProducesResponseType(typeof(IReadOnlyList<PudoPointDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PudoPointDto>>> GetPudoPoints(
        [FromQuery] string? city = null,
        [FromQuery] double? lat = null,
        [FromQuery] double? lng = null)
    {
        var points = await _deliveryProvider.GetPudoPointsAsync(city, lat, lng);
        return Ok(points);
    }

    /// <summary>Calculate per-seller parcel delivery quotes (cost and ETA) for a set of items and destination.</summary>`;

if (!content.includes('pudo-points')) {
    content = content.replace(target, pudoMethod);
    fs.writeFileSync('backend/Marketplace.API/Controllers/DeliveryController.cs', content, 'utf8');
    console.log('DeliveryController.cs updated with pudo-points.');
}
