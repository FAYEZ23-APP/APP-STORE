const fs = require('fs');

let content = fs.readFileSync('backend/Marketplace.Infrastructure/Delivery/FakeDeliveryProvider.cs', 'utf8');

const pudoPointsList = `
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
`;

const getPudoMethod = `
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
`;

if (!content.includes('PudoPoints')) {
    content = content.replace('    private static readonly ConcurrentDictionary<string, ShipmentStatus> ShipmentStatuses', pudoPointsList + '\r\n    private static readonly ConcurrentDictionary<string, ShipmentStatus> ShipmentStatuses');
}

if (!content.includes('GetPudoPointsAsync')) {
    const marker = '    public Task<PickupPointDto?> GetPickupPointByIdAsync(string pickupPointId)';
    content = content.replace(marker, getPudoMethod + '\r\n' + marker);
}

fs.writeFileSync('backend/Marketplace.Infrastructure/Delivery/FakeDeliveryProvider.cs', content, 'utf8');
console.log('FakeDeliveryProvider updated with PudoPoints and distance calculation.');
