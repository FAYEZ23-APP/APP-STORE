namespace Marketplace.Application.Common;

public enum EgyptianShippingZone
{
    GreaterCairo = 1,
    AlexandriaAndDelta = 2,
    CanalZone = 3,
    UpperEgypt = 4,
    BorderAndRedSea = 5
}

public record EgyptianGovernorateInfo(
    string NameAr,
    string NameEn,
    string CapitalAr,
    string Code,
    EgyptianShippingZone Zone,
    double Latitude,
    double Longitude,
    string[] Aliases
);

public static class EgyptianGovernorates
{
    public static readonly IReadOnlyList<EgyptianGovernorateInfo> All = new List<EgyptianGovernorateInfo>
    {
        // 1. Greater Cairo
        new("القاهرة", "Cairo", "القاهرة", "CAI", EgyptianShippingZone.GreaterCairo, 30.0444, 31.2357, new[] { "cairo", "مدينة نصر", "المعادي", "التجمع", "مصر الجديدة", "القاهره" }),
        new("الجيزة", "Giza", "الجيزة", "GIZ", EgyptianShippingZone.GreaterCairo, 30.0131, 31.2089, new[] { "giza", "6 أكتوبر", "الشيخ زايد", "الدقي", "المهندسين", "الهرم", "الجيزه" }),
        new("القليوبية", "Qalyubia", "بنها", "QAL", EgyptianShippingZone.GreaterCairo, 30.4660, 31.1853, new[] { "qalyubia", "kalyobia", "بنها", "شبرا الخيمة", "القليوبيه" }),

        // 2. Alexandria & Delta
        new("الإسكندرية", "Alexandria", "الإسكندرية", "ALX", EgyptianShippingZone.AlexandriaAndDelta, 31.2001, 29.9187, new[] { "alexandria", "alex", "اسكندرية", "الاسكندرية", "الاسكندريه", "سموحة", "ميامي" }),
        new("البحيرة", "Beheira", "دمنهور", "BEH", EgyptianShippingZone.AlexandriaAndDelta, 31.0379, 30.4699, new[] { "beheira", "دمنهور", "كفر الدوار", "البحيره" }),
        new("مطروح", "Matrouh", "مرسى مطروح", "MAT", EgyptianShippingZone.AlexandriaAndDelta, 31.3543, 27.2373, new[] { "matrouh", "marsa matrouh", "مرسى مطروح", "العلمين", "الساحل الشمالي" }),
        new("الدقهلية", "Dakahlia", "المنصورة", "DAK", EgyptianShippingZone.AlexandriaAndDelta, 31.0409, 31.3785, new[] { "dakahlia", "المنصورة", "المنصوره", "الدقهليه", "ميت غمر" }),
        new("الغربية", "Gharbia", "طنطا", "GHA", EgyptianShippingZone.AlexandriaAndDelta, 30.7865, 31.0004, new[] { "gharbia", "طنطا", "المحلة الكبرى", "الغربيه", "المحلة" }),
        new("كفر الشيخ", "Kafr El Sheikh", "كفر الشيخ", "KFS", EgyptianShippingZone.AlexandriaAndDelta, 31.1107, 30.9388, new[] { "kafr el sheikh", "kafr el-sheikh", "دسوق" }),
        new("المنوفية", "Monufia", "شبين الكوم", "MNF", EgyptianShippingZone.AlexandriaAndDelta, 30.5574, 30.9997, new[] { "monufia", "menofia", "شبين الكوم", "السادات", "قويسنا", "المنوفيه" }),
        new("دمياط", "Damietta", "دمياط", "DAM", EgyptianShippingZone.AlexandriaAndDelta, 31.4175, 31.8144, new[] { "damietta", "رأس البر" }),
        new("الشرقية", "Sharqia", "الزقازيق", "SHR", EgyptianShippingZone.AlexandriaAndDelta, 30.5877, 31.5020, new[] { "sharqia", "الزقازيق", "العاشر من رمضان", "الشرقيه" }),

        // 3. Canal Zone
        new("بورسعيد", "Port Said", "بورسعيد", "PTS", EgyptianShippingZone.CanalZone, 31.2653, 32.3019, new[] { "port said", "بورفؤاد" }),
        new("الإسماعيلية", "Ismailia", "الإسماعيلية", "ISM", EgyptianShippingZone.CanalZone, 30.5965, 32.2715, new[] { "ismailia", "الاسماعيلية", "الاسماعيليه", "فايد" }),
        new("السويس", "Suez", "السويس", "SUZ", EgyptianShippingZone.CanalZone, 29.9668, 32.5498, new[] { "suez", "العين السخنة" }),

        // 4. Upper Egypt (الصعيد)
        new("بني سويف", "Beni Suef", "بني سويف", "BNS", EgyptianShippingZone.UpperEgypt, 29.0661, 31.0994, new[] { "beni suef", "بنى سويف" }),
        new("الفيوم", "Fayoum", "الفيوم", "FYM", EgyptianShippingZone.UpperEgypt, 29.3084, 30.8428, new[] { "fayoum", "faiyum" }),
        new("المنيا", "Minya", "المنيا", "MNY", EgyptianShippingZone.UpperEgypt, 28.0871, 30.7618, new[] { "minya", "ملوي" }),
        new("أسيوط", "Assiut", "أسيوط", "AST", EgyptianShippingZone.UpperEgypt, 27.1783, 31.1859, new[] { "assiut", "asyut", "اسيوط" }),
        new("سوهاج", "Sohag", "سوهاج", "SHG", EgyptianShippingZone.UpperEgypt, 26.5591, 31.6957, new[] { "sohag", "جرجا" }),
        new("قنا", "Qena", "قنا", "QNA", EgyptianShippingZone.UpperEgypt, 26.1551, 32.7160, new[] { "qena", "نجع حمادي" }),
        new("الأقصر", "Luxor", "الأقصر", "LXR", EgyptianShippingZone.UpperEgypt, 25.6872, 32.6396, new[] { "luxor", "الاقصر", "إسنا" }),
        new("أسوان", "Aswan", "أسوان", "ASW", EgyptianShippingZone.UpperEgypt, 24.0889, 32.8998, new[] { "aswan", "اسوان", "كوم أمبو", "إدفو" }),

        // 5. Border & Red Sea
        new("البحر الأحمر", "Red Sea", "الغردقة", "RED", EgyptianShippingZone.BorderAndRedSea, 27.2579, 33.8116, new[] { "red sea", "الغردقة", "الغردقه", "الجونة", "سفاجا", "مرسى علم" }),
        new("الوادي الجديد", "New Valley", "الخارجة", "WAD", EgyptianShippingZone.BorderAndRedSea, 25.4514, 30.5464, new[] { "new valley", "الخارجة", "الداخلة", "الفرافرة" }),
        new("شمال سيناء", "North Sinai", "العريش", "SIN", EgyptianShippingZone.BorderAndRedSea, 31.1316, 33.7984, new[] { "north sinai", "العريش", "بئر العبد" }),
        new("جنوب سيناء", "South Sinai", "شرم الشيخ", "JS", EgyptianShippingZone.BorderAndRedSea, 28.2415, 33.6231, new[] { "south sinai", "شرم الشيخ", "دهب", "نويبع", "طابا", "طور سيناء" })
    };

    public static EgyptianGovernorateInfo? Find(string? nameOrCity)
    {
        if (string.IsNullOrWhiteSpace(nameOrCity))
            return null;

        var term = nameOrCity.Trim();

        return All.FirstOrDefault(g =>
            string.Equals(g.NameAr, term, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(g.NameEn, term, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(g.CapitalAr, term, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(g.Code, term, StringComparison.OrdinalIgnoreCase) ||
            g.Aliases.Any(a => string.Equals(a, term, StringComparison.OrdinalIgnoreCase) || term.Contains(a, StringComparison.OrdinalIgnoreCase)));
    }

    public static (double Latitude, double Longitude)? GetCoordinates(string? nameOrCity)
    {
        var match = Find(nameOrCity);
        if (match != null)
            return (match.Latitude, match.Longitude);

        return null;
    }

    public static string NormalizeGovernorate(string? nameOrCity)
    {
        var match = Find(nameOrCity);
        return match != null ? match.NameAr : (nameOrCity?.Trim() ?? "القاهرة");
    }

    public static EgyptianShippingZone GetZone(string? nameOrCity)
    {
        var match = Find(nameOrCity);
        return match?.Zone ?? EgyptianShippingZone.GreaterCairo;
    }

    public static bool IsValid(string? nameOrCity)
    {
        return Find(nameOrCity) != null;
    }
}
