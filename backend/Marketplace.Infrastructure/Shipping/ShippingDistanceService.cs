using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Shipping;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Shipping;

public class ShippingDistanceService : IShippingDistanceService
{
    private readonly HttpClient _httpClient;
    private readonly GoogleMapsSettings _settings;
    private readonly ILogger<ShippingDistanceService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ShippingDistanceService(
        HttpClient httpClient,
        IOptions<GoogleMapsSettings> settings,
        ILogger<ShippingDistanceService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    /// <summary>
    /// Calculates straight-line distance in kilometers using the Haversine formula.
    /// </summary>
    public double CalculateHaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371.0;

        double dLat = ToRadians(lat2 - lat1);
        double dLon = ToRadians(lon2 - lon1);

        double radLat1 = ToRadians(lat1);
        double radLat2 = ToRadians(lat2);

        double a = Math.Sin(dLat / 2.0) * Math.Sin(dLat / 2.0) +
                   Math.Cos(radLat1) * Math.Cos(radLat2) *
                   Math.Sin(dLon / 2.0) * Math.Sin(dLon / 2.0);

        double c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
        double distance = earthRadiusKm * c;

        return Math.Round(distance, 2);
    }

    /// <summary>
    /// Gets actual road distance using Google Distance Matrix API with automatic fallback to Haversine formula.
    /// </summary>
    public async Task<RoadDistanceResult> GetActualRoadDistanceAsync(
        double destLat,
        double destLng,
        double? originLat = null,
        double? originLng = null,
        CancellationToken cancellationToken = default)
    {
        double fromLat = originLat ?? _settings.WarehouseLatitude;
        double fromLng = originLng ?? _settings.WarehouseLongitude;

        if (string.IsNullOrWhiteSpace(_settings.ServerApiKey) ||
            _settings.ServerApiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Google Maps ServerApiKey is missing or set to default placeholder. Falling back to Haversine distance.");
            return CreateHaversineFallbackResult(fromLat, fromLng, destLat, destLng);
        }

        try
        {
            string originStr = string.Create(CultureInfo.InvariantCulture, $"{fromLat},{fromLng}");
            string destStr = string.Create(CultureInfo.InvariantCulture, $"{destLat},{destLng}");
            string requestUri = $"https://maps.googleapis.com/maps/api/distancematrix/json?origins={originStr}&destinations={destStr}&mode=driving&language=ar&key={_settings.ServerApiKey}";

            using var response = await _httpClient.GetAsync(requestUri, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google Distance Matrix API request failed with HTTP {StatusCode}. Falling back to Haversine.", response.StatusCode);
                return CreateHaversineFallbackResult(fromLat, fromLng, destLat, destLng);
            }

            var jsonStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var result = await JsonSerializer.DeserializeAsync<GoogleDistanceMatrixResponse>(jsonStream, JsonOptions, cancellationToken);

            if (result == null || !string.Equals(result.Status, "OK", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Google Distance Matrix API returned status '{Status}': {ErrorMessage}. Falling back to Haversine.",
                    result?.Status, result?.ErrorMessage ?? "Unknown status");
                return CreateHaversineFallbackResult(fromLat, fromLng, destLat, destLng);
            }

            var element = result.Rows.FirstOrDefault()?.Elements.FirstOrDefault();
            if (element == null || !string.Equals(element.Status, "OK", StringComparison.OrdinalIgnoreCase) || element.Distance == null || element.Duration == null)
            {
                _logger.LogWarning("Google Distance Matrix API element returned status '{ElementStatus}'. Falling back to Haversine.",
                    element?.Status ?? "Empty element");
                return CreateHaversineFallbackResult(fromLat, fromLng, destLat, destLng);
            }

            double distanceKm = Math.Round(element.Distance.Value / 1000.0, 2);
            string durationText = element.Duration.Text;
            int durationSeconds = (int)element.Duration.Value;

            return new RoadDistanceResult
            {
                DistanceKm = distanceKm,
                DurationText = durationText,
                DurationSeconds = durationSeconds,
                IsFallback = false,
                Source = "GoogleDistanceMatrix"
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "Exception while contacting Google Distance Matrix API. Falling back to Haversine distance calculation.");
            return CreateHaversineFallbackResult(fromLat, fromLng, destLat, destLng);
        }
    }

    /// <summary>
    /// Calculates shipping fee based on actual road distance, base fee, and cost per kilometer.
    /// </summary>
    public async Task<ShippingFeeCalculationResponse> CalculateShippingFeeAsync(
        double destLat,
        double destLng,
        double? originLat = null,
        double? originLng = null,
        CancellationToken cancellationToken = default)
    {
        var roadResult = await GetActualRoadDistanceAsync(destLat, destLng, originLat, originLng, cancellationToken);

        decimal baseFee = _settings.BaseShippingFee;
        decimal costPerKm = _settings.CostPerKm;
        decimal distanceCost = Math.Round(Convert.ToDecimal(roadResult.DistanceKm) * costPerKm, 2);
        decimal totalShippingCost = Math.Round(baseFee + distanceCost, 2);

        return new ShippingFeeCalculationResponse
        {
            DistanceKm = roadResult.DistanceKm,
            EstimatedTime = roadResult.DurationText,
            TotalShippingCost = totalShippingCost,
            BaseShippingFee = baseFee,
            DistanceCost = distanceCost,
            IsRoadDistance = !roadResult.IsFallback,
            Source = roadResult.Source
        };
    }

    private RoadDistanceResult CreateHaversineFallbackResult(double fromLat, double fromLng, double destLat, double destLng)
    {
        double distanceKm = CalculateHaversineDistance(fromLat, fromLng, destLat, destLng);
        var (durationText, durationSeconds) = EstimateDuration(distanceKm);

        return new RoadDistanceResult
        {
            DistanceKm = distanceKm,
            DurationText = durationText,
            DurationSeconds = durationSeconds,
            IsFallback = true,
            Source = "HaversineFallback"
        };
    }

    private static (string Text, int Seconds) EstimateDuration(double distanceKm)
    {
        const double avgSpeedKmPerHour = 35.0;
        int travelMinutes = (int)Math.Ceiling((distanceKm / avgSpeedKmPerHour) * 60.0);
        int totalMinutes = Math.Max(15, travelMinutes + 10);
        int seconds = totalMinutes * 60;

        string text = totalMinutes < 60
            ? $"{totalMinutes} دقيقة تقريباً"
            : $"{totalMinutes / 60} ساعة و {totalMinutes % 60} دقيقة تقريباً";

        return (text, seconds);
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    private sealed class GoogleDistanceMatrixResponse
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("error_message")]
        public string? ErrorMessage { get; set; }

        [JsonPropertyName("rows")]
        public List<GoogleDistanceMatrixRow> Rows { get; set; } = new();
    }

    private sealed class GoogleDistanceMatrixRow
    {
        [JsonPropertyName("elements")]
        public List<GoogleDistanceMatrixElement> Elements { get; set; } = new();
    }

    private sealed class GoogleDistanceMatrixElement
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("distance")]
        public GoogleDistanceMatrixValue? Distance { get; set; }

        [JsonPropertyName("duration")]
        public GoogleDistanceMatrixValue? Duration { get; set; }
    }

    private sealed class GoogleDistanceMatrixValue
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;

        [JsonPropertyName("value")]
        public long Value { get; set; }
    }
}
