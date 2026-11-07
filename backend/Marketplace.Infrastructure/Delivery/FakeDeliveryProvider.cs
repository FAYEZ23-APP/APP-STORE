using System.Collections.Concurrent;
using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Enums;

namespace Marketplace.Infrastructure.Delivery;

/// <summary>
/// Deterministic fake delivery provider covering all 27 Egyptian Governorates (simulating carriers like Bosta/Aramex).
/// Does not call external network services and logs zero personal data.
/// </summary>
public class FakeDeliveryProvider : IDeliveryProvider
{
    private static long _trackingSequence = 100000;

    private static readonly IReadOnlyList<DeliveryCityDto> Cities = EgyptianGovernorates.All
        .Select(g => new DeliveryCityDto
        {
            Name = g.NameAr,
            Region = $"محافظة {g.NameAr}"
        })
        .ToList();

    private static readonly IReadOnlyList<PickupPointDto> PickupPoints = new List<PickupPointDto>
    {
        // 1. القاهرة
        new() { Id = "CAI-PVZ-1", City = "القاهرة", Name = "نقطة استلام بوسطة - مدينة نصر", Address = "شارع عباس العقاد، مدينة نصر، القاهرة", WorkHours = "09:00–22:00" },
        new() { Id = "CAI-PVZ-2", City = "القاهرة", Name = "نقطة استلام بوسطة - المعادي", Address = "شارع النصر، المعادي الجديدة، القاهرة", WorkHours = "10:00–22:00" },
        new() { Id = "CAI-PVZ-3", City = "القاهرة", Name = "نقطة استلام بوسطة - التجمع الخامس", Address = "شارع التسعين الشمالي، القاهرة الجديدة", WorkHours = "09:00–22:00" },

        // 2. الجيزة
        new() { Id = "GIZ-PVZ-1", City = "الجيزة", Name = "نقطة استلام بوسطة - المهندسين", Address = "شارع جامعة الدول العربية، المهندسين", WorkHours = "09:00–22:00" },
        new() { Id = "GIZ-PVZ-2", City = "الجيزة", Name = "نقطة استلام بوسطة - الدقي", Address = "شارع مصدق، الدقي", WorkHours = "10:00–22:00" },
        new() { Id = "GIZ-PVZ-3", City = "الجيزة", Name = "نقطة استلام بوسطة - 6 أكتوبر", Address = "المحور المركزي، الحي المتميز، 6 أكتوبر", WorkHours = "09:00–22:00" },

        // 3. القليوبية
        new() { Id = "QAL-PVZ-1", City = "القليوبية", Name = "نقطة استلام بوسطة - بنها", Address = "شارع فريد ندا، بنها", WorkHours = "09:00–21:00" },

        // 4. الإسكندرية
        new() { Id = "ALX-PVZ-1", City = "الإسكندرية", Name = "نقطة استلام بوسطة - سموحة", Address = "ميدان فيكتور عمانويل، سموحة", WorkHours = "09:00–22:00" },
        new() { Id = "ALX-PVZ-2", City = "الإسكندرية", Name = "نقطة استلام بوسطة - ميامي", Address = "شارع جمال عبد الناصر، ميامي", WorkHours = "09:00–22:00" },

        // 5. الدقهلية
        new() { Id = "DAK-PVZ-1", City = "الدقهلية", Name = "نقطة استلام بوسطة - المنصورة", Address = "شارع المشاية السفلية، المنصورة", WorkHours = "09:00–21:00" },

        // 6. الغربية
        new() { Id = "GHA-PVZ-1", City = "الغربية", Name = "نقطة استلام بوسطة - طنطا", Address = "شارع الجيش، طنطا", WorkHours = "09:00–21:00" },

        // 7. الشرقية
        new() { Id = "SHR-PVZ-1", City = "الشرقية", Name = "نقطة استلام بوسطة - الزقازيق", Address = "شارع المحافظة، الزقازيق", WorkHours = "09:00–21:00" },

        // 8. البحيرة
        new() { Id = "BEH-PVZ-1", City = "البحيرة", Name = "نقطة استلام بوسطة - دمنهور", Address = "شارع عبد السلام الشاذلي، دمنهور", WorkHours = "09:00–21:00" },

        // 9. المنوفية
        new() { Id = "MNF-PVZ-1", City = "المنوفية", Name = "نقطة استلام بوسطة - شبين الكوم", Address = "شارع الجلاء، شبين الكوم", WorkHours = "09:00–21:00" },

        // 10. بورسعيد
        new() { Id = "PTS-PVZ-1", City = "بورسعيد", Name = "نقطة استلام بوسطة - بورسعيد", Address = "شارع محمد علي، حي الشرق", WorkHours = "09:00–21:00" },

        // 11. الإسماعيلية
        new() { Id = "ISM-PVZ-1", City = "الإسماعيلية", Name = "نقطة استلام بوسطة - الإسماعيلية", Address = "ميدان الممر، الإسماعيلية", WorkHours = "09:00–21:00" },

        // 12. السويس
        new() { Id = "SUZ-PVZ-1", City = "السويس", Name = "نقطة استلام بوسطة - السويس", Address = "شارع الجيش، حي السويس", WorkHours = "09:00–21:00" },

        // 13. أسيوط
        new() { Id = "AST-PVZ-1", City = "أسيوط", Name = "نقطة استلام بوسطة - أسيوط", Address = "شارع الجمهورية، أسيوط", WorkHours = "09:00–21:00" },

        // 14. سوهاج
        new() { Id = "SHG-PVZ-1", City = "سوهاج", Name = "نقطة استلام بوسطة - سوهاج", Address = "شارع كورنيش النيل الشرقي، سوهاج", WorkHours = "09:00–21:00" },

        // 15. قنا
        new() { Id = "QNA-PVZ-1", City = "قنا", Name = "نقطة استلام بوسطة - قنا", Address = "ميدان المحطة، قنا", WorkHours = "09:00–21:00" },

        // 16. الأقصر
        new() { Id = "LXR-PVZ-1", City = "الأقصر", Name = "نقطة استلام بوسطة - الأقصر", Address = "شارع التلفزيون، الأقصر", WorkHours = "09:00–21:00" },

        // 17. أسوان
        new() { Id = "ASW-PVZ-1", City = "أسوان", Name = "نقطة استلام بوسطة - أسوان", Address = "شارع أبطال التحرير، أسوان", WorkHours = "09:00–21:00" },

        // 18. البحر الأحمر
        new() { Id = "RED-PVZ-1", City = "البحر الأحمر", Name = "نقطة استلام بوسطة - الغردقة", Address = "طريق شيراتون، الغردقة", WorkHours = "10:00–22:00" }
    };


    private static readonly IReadOnlyList<PudoPointDto> PudoPoints = new List<PudoPointDto>
    {
        new() { Id = "CAI-PUDO-1", City = "القاهرة", Governorate = "القاهرة", Name = "خزنة أمان ذكية - سيتي ستارز مدينة نصر", Address = "شارع عمر بن الخطاب، مدينة نصر", WorkHours = "24/7", Type = "SmartLocker", Latitude = 30.0735, Longitude = 31.3458, DiscountAmount = 15.00m },
        new() { Id = "CAI-PUDO-2", City = "القاهرة", Governorate = "القاهرة", Name = "نقطة استلام المعادي هب", Address = "شارع النصر، المعادي الجديدة", WorkHours = "09:00–23:00", Type = "Branch", Latitude = 29.9602, Longitude = 31.2569, DiscountAmount = 15.00m },
        new() { Id = "CAI-PUDO-3", City = "القاهرة", Governorate = "القاهرة", Name = "خزنة أمان ذكية - كايرو فيستيفال التجمع الخامس", Address = "الطريق الدائري، التجمع الخامس", WorkHours = "24/7", Type = "SmartLocker", Latitude = 30.0270, Longitude = 31.4913, DiscountAmount = 15.00m },
        new() { Id = "GIZ-PUDO-1", City = "الجيزة", Governorate = "الجيزة", Name = "نقطة استلام المهندسين", Address = "شارع جامعة الدول العربية، المهندسين", WorkHours = "09:00–22:00", Type = "Branch", Latitude = 30.0511, Longitude = 31.2001, DiscountAmount = 15.00m },
        new() { Id = "GIZ-PUDO-2", City = "الجيزة", Governorate = "الجيزة", Name = "خزنة أمان ذكية - مول العرب 6 أكتوبر", Address = "ميدان جهينة، 6 أكتوبر", WorkHours = "24/7", Type = "SmartLocker", Latitude = 29.9723, Longitude = 30.9427, DiscountAmount = 15.00m },
        new() { Id = "ALX-PUDO-1", City = "الإسكندرية", Governorate = "الإسكندرية", Name = "خزنة أمان ذكية - سان ستيفانو مول", Address = "طريق الكورنيش، سان ستيفانو", WorkHours = "24/7", Type = "SmartLocker", Latitude = 31.2444, Longitude = 29.9678, DiscountAmount = 15.00m },
        new() { Id = "ALX-PUDO-2", City = "الإسكندرية", Governorate = "الإسكندرية", Name = "نقطة استلام سموحة", Address = "ميدان فيكتور عمانويل، سموحة", WorkHours = "09:00–22:00", Type = "Branch", Latitude = 31.2156, Longitude = 29.9553, DiscountAmount = 15.00m },
        new() { Id = "DAK-PUDO-1", City = "المنصورة", Governorate = "الدقهلية", Name = "نقطة استلام المنصورة سيتي سنتر", Address = "شارع المشاية السفلية، المنصورة", WorkHours = "09:00–22:00", Type = "Branch", Latitude = 31.0409, Longitude = 31.3785, DiscountAmount = 15.00m },
        new() { Id = "GHA-PUDO-1", City = "طنطا", Governorate = "الغربية", Name = "خزنة أمان ذكية - محطة قطار طنطا", Address = "شارع الجيش، طنطا", WorkHours = "24/7", Type = "SmartLocker", Latitude = 30.7865, Longitude = 31.0004, DiscountAmount = 15.00m },
        new() { Id = "AST-PUDO-1", City = "أسيوط", Governorate = "أسيوط", Name = "نقطة استلام صعيد مصر - أسيوط", Address = "شارع الجمهورية، أسيوط", WorkHours = "09:00–21:00", Type = "Branch", Latitude = 27.1809, Longitude = 31.1837, DiscountAmount = 15.00m },
        new() { Id = "RED-PUDO-1", City = "الغردقة", Governorate = "البحر الأحمر", Name = "نقطة استلام الغردقة مارينا", Address = "طريق شيراتون، الغردقة", WorkHours = "10:00–22:00", Type = "Branch", Latitude = 27.2579, Longitude = 33.8116, DiscountAmount = 15.00m }
    };

    private static readonly ConcurrentDictionary<string, ShipmentStatus> ShipmentStatuses = new(StringComparer.OrdinalIgnoreCase);

    public Task<IReadOnlyList<DeliveryCityDto>> GetCitiesAsync(string? query = null)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Task.FromResult(Cities);

        var q = query.Trim();
        var filtered = Cities
            .Where(c => c.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                        c.Region.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                        (EgyptianGovernorates.Find(q)?.NameAr.Equals(c.Name, StringComparison.OrdinalIgnoreCase) == true))
            .ToList();

        return Task.FromResult<IReadOnlyList<DeliveryCityDto>>(filtered);
    }

    public Task<IReadOnlyList<PickupPointDto>> GetPickupPointsAsync(string? city = null)
    {
        if (string.IsNullOrWhiteSpace(city))
            return Task.FromResult(PickupPoints);

        var normalizedCity = EgyptianGovernorates.NormalizeGovernorate(city);
        var filtered = PickupPoints
            .Where(p => string.Equals(p.City, normalizedCity, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(p.City, city.Trim(), StringComparison.OrdinalIgnoreCase))
            .ToList();

        return Task.FromResult<IReadOnlyList<PickupPointDto>>(filtered);
    }


    public Task<IReadOnlyList<PudoPointDto>> GetPudoPointsAsync(string? city = null, double? lat = null, double? lng = null)
    {
        var points = PudoPoints.Select(p => new PudoPointDto
        {
            Id = p.Id,
            City = p.City,
            Governorate = p.Governorate,
            Name = p.Name,
            Address = p.Address,
            WorkHours = p.WorkHours,
            Type = p.Type,
            Latitude = p.Latitude,
            Longitude = p.Longitude,
            DiscountAmount = p.DiscountAmount
        }).ToList();

        if (!string.IsNullOrWhiteSpace(city))
        {
            var c = city.Trim();
            points = points.Where(p =>
                p.City.Contains(c, StringComparison.OrdinalIgnoreCase) ||
                p.Governorate.Contains(c, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (lat.HasValue && lng.HasValue)
        {
            foreach (var pt in points)
            {
                pt.DistanceKm = CalculateHaversineDistanceKm(lat.Value, lng.Value, pt.Latitude, pt.Longitude);
            }
            points = points.OrderBy(p => p.DistanceKm).ToList();
        }

        return Task.FromResult<IReadOnlyList<PudoPointDto>>(points);
    }

    private static double CalculateHaversineDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Math.Round(R * c, 2);
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

        var trimmed = city.Trim();
        if (EgyptianGovernorates.IsValid(trimmed))
            return Task.FromResult(true);

        bool exists = Cities.Any(c => string.Equals(c.Name, trimmed, StringComparison.OrdinalIgnoreCase)) ||
                      PickupPoints.Any(p => string.Equals(p.City, trimmed, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(exists);
    }

    public Task<DeliveryTariffQuoteDto> CalculateTariffAsync(DeliveryTariffRequest request)
    {
        var fromNorm = EgyptianGovernorates.NormalizeGovernorate(request.FromCity ?? "القاهرة");
        var toNorm = EgyptianGovernorates.NormalizeGovernorate(request.ToCity ?? "القاهرة");

        var fromZone = EgyptianGovernorates.GetZone(fromNorm);
        var toZone = EgyptianGovernorates.GetZone(toNorm);

        decimal baseCost;
        int etaMin;
        int etaMax;

        // 1. Intra-governorate or Intra-Greater Cairo
        if (string.Equals(fromNorm, toNorm, StringComparison.OrdinalIgnoreCase) ||
            (fromZone == EgyptianShippingZone.GreaterCairo && toZone == EgyptianShippingZone.GreaterCairo))
        {
            baseCost = 45m;
            etaMin = 1;
            etaMax = 2;
        }
        // 2. Greater Cairo <-> Alexandria & Delta
        else if ((fromZone == EgyptianShippingZone.GreaterCairo && toZone == EgyptianShippingZone.AlexandriaAndDelta) ||
                 (fromZone == EgyptianShippingZone.AlexandriaAndDelta && toZone == EgyptianShippingZone.GreaterCairo) ||
                 (fromZone == EgyptianShippingZone.AlexandriaAndDelta && toZone == EgyptianShippingZone.AlexandriaAndDelta))
        {
            baseCost = 60m;
            etaMin = 2;
            etaMax = 3;
        }
        // 3. Canal Zone
        else if (fromZone == EgyptianShippingZone.CanalZone || toZone == EgyptianShippingZone.CanalZone)
        {
            baseCost = 65m;
            etaMin = 2;
            etaMax = 3;
        }
        // 4. Upper Egypt (الصعيد)
        else if (fromZone == EgyptianShippingZone.UpperEgypt || toZone == EgyptianShippingZone.UpperEgypt)
        {
            // Tier based on distance to Deep Upper Egypt (Assiut/Sohag/Qena/Luxor/Aswan)
            var deepUpperEgypt = new[] { "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان" };
            bool isDeep = deepUpperEgypt.Contains(toNorm, StringComparer.OrdinalIgnoreCase) ||
                          deepUpperEgypt.Contains(fromNorm, StringComparer.OrdinalIgnoreCase);

            baseCost = isDeep ? 85m : 75m;
            etaMin = 3;
            etaMax = 4;
        }
        // 5. Border & Red Sea (المحافظات الحدودية والبحر الأحمر)
        else
        {
            baseCost = 100m;
            etaMin = 3;
            etaMax = 5;
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

    private static string GetCityCode(string city)
    {
        var match = EgyptianGovernorates.Find(city);
        return match?.Code ?? "EGY";
    }
}
