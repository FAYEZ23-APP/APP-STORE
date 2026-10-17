using System.Collections.Concurrent;
using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Enums;

namespace Marketplace.Infrastructure.Delivery;

/// <summary>
/// Local deterministic fake delivery provider for Egypt (simulating Egyptian carriers like Bosta/Aramex).
/// Does not call any external network service and never logs personal data.
/// </summary>
public class FakeDeliveryProvider : IDeliveryProvider
{
    private static long _trackingSequence = 100000;

    private static readonly IReadOnlyList<DeliveryCityDto> Cities = new List<DeliveryCityDto>
    {
        new() { Name = "القاهرة", Region = "محافظة القاهرة" },
        new() { Name = "الجيزة", Region = "محافظة الجيزة" },
        new() { Name = "الإسكندرية", Region = "محافظة الإسكندرية" },
        new() { Name = "المنصورة", Region = "محافظة الدقهلية" },
        new() { Name = "طنطا", Region = "محافظة الغربية" }
    };

    private static readonly IReadOnlyList<PickupPointDto> PickupPoints = new List<PickupPointDto>
    {
        // القاهرة
        new()
        {
            Id = "CAI-PVZ-1",
            City = "القاهرة",
            Name = "نقطة استلام تجريبية رقم ١ (بوسطة - مدينة نصر)",
            Address = "شارع عباس العقاد، مدينة نصر، القاهرة",
            WorkHours = "09:00–22:00"
        },
        new()
        {
            Id = "CAI-PVZ-2",
            City = "القاهرة",
            Name = "نقطة استلام تجريبية رقم ٢ (بوسطة - المعادي)",
            Address = "شارع النصر، المعادي الجديدة، القاهرة",
            WorkHours = "10:00–22:00"
        },
        new()
        {
            Id = "CAI-PVZ-3",
            City = "القاهرة",
            Name = "نقطة استلام تجريبية رقم ٣ (بوسطة - التجمع الخامس)",
            Address = "شارع التسعين الشمالي، التجمع الخامس، القاهرة",
            WorkHours = "09:00–22:00"
        },

        // الجيزة
        new()
        {
            Id = "GIZ-PVZ-1",
            City = "الجيزة",
            Name = "نقطة استلام تجريبية رقم ١ (بوسطة - المهندسين)",
            Address = "شارع جامعة الدول العربية، المهندسين، الجيزة",
            WorkHours = "09:00–22:00"
        },
        new()
        {
            Id = "GIZ-PVZ-2",
            City = "الجيزة",
            Name = "نقطة استلام تجريبية رقم ٢ (بوسطة - الدقي)",
            Address = "شارع مصدق، الدقي، الجيزة",
            WorkHours = "10:00–22:00"
        },
        new()
        {
            Id = "GIZ-PVZ-3",
            City = "الجيزة",
            Name = "نقطة استلام تجريبية رقم ٣ (بوسطة - 6 أكتوبر)",
            Address = "المحور المركزي، الحي المتميز، 6 أكتوبر",
            WorkHours = "09:00–22:00"
        },

        // الإسكندرية
        new()
        {
            Id = "ALX-PVZ-1",
            City = "الإسكندرية",
            Name = "نقطة استلام تجريبية رقم ١ (بوسطة - سموحة)",
            Address = "ميدان فيكتور عمانويل، سموحة، الإسكندرية",
            WorkHours = "09:00–22:00"
        },
        new()
        {
            Id = "ALX-PVZ-2",
            City = "الإسكندرية",
            Name = "نقطة استلام تجريبية رقم ٢ (بوسطة - ميامي)",
            Address = "شارع جمال عبد الناصر، ميامي، الإسكندرية",
            WorkHours = "09:00–22:00"
        },
        new()
        {
            Id = "ALX-PVZ-3",
            City = "الإسكندرية",
            Name = "نقطة استلام تجريبية رقم ٣ (بوسطة - رشدي)",
            Address = "شارع سوريا، رشدي، الإسكندرية",
            WorkHours = "10:00–22:00"
        },

        // المنصورة
        new()
        {
            Id = "MNS-PVZ-1",
            City = "المنصورة",
            Name = "نقطة استلام تجريبية رقم ١ (بوسطة - المنصورة)",
            Address = "شارع المشاية السفلية، المنصورة",
            WorkHours = "09:00–21:00"
        },

        // طنطا
        new()
        {
            Id = "TNT-PVZ-1",
            City = "طنطا",
            Name = "نقطة استلام تجريبية رقم ١ (بوسطة - طنطا)",
            Address = "شارع الجيش، طنطا",
            WorkHours = "09:00–21:00"
        }
    };

    private static readonly ConcurrentDictionary<string, ShipmentStatus> ShipmentStatuses = new(StringComparer.OrdinalIgnoreCase);

    public Task<IReadOnlyList<DeliveryCityDto>> GetCitiesAsync(string? query = null)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Task.FromResult(Cities);

        var q = query.Trim();
        var filtered = Cities
            .Where(c => c.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                        c.Region.Contains(q, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return Task.FromResult<IReadOnlyList<DeliveryCityDto>>(filtered);
    }

    public Task<IReadOnlyList<PickupPointDto>> GetPickupPointsAsync(string? city = null)
    {
        if (string.IsNullOrWhiteSpace(city))
            return Task.FromResult(PickupPoints);

        var normalizedCity = city.Trim();
        var filtered = PickupPoints
            .Where(p => string.Equals(p.City, normalizedCity, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return Task.FromResult<IReadOnlyList<PickupPointDto>>(filtered);
    }

    public Task<PickupPointDto?> GetPickupPointByIdAsync(string pickupPointId)
    {
        if (string.IsNullOrWhiteSpace(pickupPointId))
            return Task.FromResult<PickupPointDto?>(null);

        var point = PickupPoints.FirstOrDefault(p =>
            string.Equals(p.Id, pickupPointId.Trim(), StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(point);
    }

    public Task<bool> IsValidCityAsync(string city)
    {
        if (string.IsNullOrWhiteSpace(city))
            return Task.FromResult(false);

        bool exists = Cities.Any(c => string.Equals(c.Name, city.Trim(), StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(exists);
    }

    public Task<DeliveryTariffQuoteDto> CalculateTariffAsync(DeliveryTariffRequest request)
    {
        var from = (request.FromCity ?? "القاهرة").Trim();
        var to = (request.ToCity ?? "القاهرة").Trim();

        decimal baseCost;
        int etaMin;
        int etaMax;

        // Intra-city / Greater Cairo (القاهرة <-> الجيزة)
        if (string.Equals(from, to, StringComparison.OrdinalIgnoreCase) ||
            (IsCity(from, "القاهرة") && IsCity(to, "الجيزة")) ||
            (IsCity(from, "الجيزة") && IsCity(to, "القاهرة")))
        {
            baseCost = 45m;
            etaMin = 1;
            etaMax = 2;
        }
        else if ((IsGreaterCairo(from) && IsCity(to, "الإسكندرية")) ||
                 (IsCity(from, "الإسكندرية") && IsGreaterCairo(to)))
        {
            baseCost = 60m;
            etaMin = 2;
            etaMax = 3;
        }
        else if ((IsGreaterCairo(from) && (IsCity(to, "المنصورة") || IsCity(to, "طنطا"))) ||
                 ((IsCity(from, "المنصورة") || IsCity(from, "طنطا")) && IsGreaterCairo(to)))
        {
            baseCost = 65m;
            etaMin = 2;
            etaMax = 3;
        }
        else
        {
            // Inter-governorate
            baseCost = 75m;
            etaMin = 3;
            etaMax = 4;
        }

        // Deterministic weight surcharge: +10 EGP per started kg above 1000g
        int weightGrams = Math.Max(1, request.TotalWeightGrams);
        int extraKg = (int)Math.Ceiling(Math.Max(0, weightGrams - 1000) / 1000.0);
        decimal weightSurcharge = extraKg * 10m;

        // Courier (Doorstep delivery) surcharge: +25 EGP
        decimal methodSurcharge = request.DeliveryMethod == DeliveryMethod.Courier ? 25m : 0m;
        if (request.DeliveryMethod == DeliveryMethod.Courier)
        {
            etaMax += 1;
        }

        return Task.FromResult(new DeliveryTariffQuoteDto
        {
            Cost = baseCost + weightSurcharge + methodSurcharge,
            EtaMinDays = etaMin,
            EtaMaxDays = etaMax
        });
    }

    public async Task<CarrierShipmentCreationResult> CreateShipmentAsync(CreateCarrierShipmentRequest request)
    {
        var quote = await CalculateTariffAsync(new DeliveryTariffRequest
        {
            FromCity = request.FromCity,
            ToCity = request.ToCity,
            DeliveryMethod = request.DeliveryMethod,
            TotalWeightGrams = request.TotalWeightGrams
        });

        long seq = Interlocked.Increment(ref _trackingSequence);
        string cityCode = GetCityCode(request.ToCity);
        string trackingNumber = $"BOSTA-EG-{cityCode}-{request.SellerId}-{seq}";

        ShipmentStatuses[trackingNumber] = ShipmentStatus.Created;

        return new CarrierShipmentCreationResult
        {
            TrackingNumber = trackingNumber,
            DeliveryCost = quote.Cost,
            EtaMinDays = quote.EtaMinDays,
            EtaMaxDays = quote.EtaMaxDays,
            Status = ShipmentStatus.Created
        };
    }

    public Task<ShipmentStatus> GetShipmentStatusAsync(string trackingNumber)
    {
        if (ShipmentStatuses.TryGetValue(trackingNumber, out var status))
            return Task.FromResult(status);

        return Task.FromResult(ShipmentStatus.Created);
    }

    public Task<bool> CancelShipmentAsync(string trackingNumber)
    {
        ShipmentStatuses[trackingNumber] = ShipmentStatus.Cancelled;
        return Task.FromResult(true);
    }

    private static bool IsCity(string actual, string expected) =>
        string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase);

    private static bool IsGreaterCairo(string city) =>
        IsCity(city, "القاهرة") || IsCity(city, "الجيزة");

    private static string GetCityCode(string city)
    {
        if (IsCity(city, "القاهرة")) return "CAI";
        if (IsCity(city, "الجيزة")) return "GIZ";
        if (IsCity(city, "الإسكندرية")) return "ALX";
        if (IsCity(city, "المنصورة")) return "MNS";
        if (IsCity(city, "طنطا")) return "TNT";
        return "EGY";
    }
}
