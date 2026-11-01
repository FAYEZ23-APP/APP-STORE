using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Marketplace.Application.Services.Search;

/// <summary>
/// High-performance bilingual (Arabic/English) text normalization,
/// phonetic simplification, and cross-language synonym expansion engine.
/// </summary>
public static class SearchTextProcessor
{
    // Regex for Arabic Tashkeel diacritics (\u064B-\u0652, \u0653-\u0655, \u0670) and Tatweel/Kashida (\u0640)
    private static readonly Regex ArabicDiacriticsAndTatweelRegex = new(
        @"[\u064B-\u0652\u0653-\u0655\u0670\u0640]",
        RegexOptions.Compiled);

    // Consecutive whitespace regex
    private static readonly Regex MultiSpaceRegex = new(
        @"\s+",
        RegexOptions.Compiled);

    // English consecutive duplicate letters (e.g. "ll" -> "l", "ss" -> "s")
    private static readonly Regex DuplicateLettersRegex = new(
        @"([a-zA-Z])\1+",
        RegexOptions.Compiled);

    // Any punctuation or symbol except letters, numbers, whitespace, and #+ (e.g. C#, C++)
    private static readonly Regex PunctuationRegex = new(
        @"[^\p{L}\p{N}\s#+]",
        RegexOptions.Compiled);

    // Arabic and English common stop words
    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "في", "من", "على", "الى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "تم", "كان",
        "يكون", "التي", "الذي", "الذين", "او", "ثم", "ان", "انها", "انه", "كل", "ما",
        "هو", "هي", "هم", "هن", "نحن", "انا", "انت", "انتم", "حتى", "اذا", "لو",
        "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
        "by", "is", "are", "was", "were", "be", "been", "from", "that", "this", "it"
    };

    private static readonly Dictionary<string, List<string>> SynonymDictionary = BuildBilingualDictionary();

    /// <summary>
    /// Normalizes Arabic text:
    /// - Strips Tashkeel diacritics and Tatweel.
    /// - Unifies Alef variants: أ, إ, آ, ٱ -> ا
    /// - Unifies Taa Marbuta: ة -> ه
    /// - Unifies Alef Maksura: ى -> ي
    /// - Unifies Hamza on Waw: ؤ -> و
    /// - Unifies Hamza on Yaa: ئ -> ي
    /// - Unifies Persian/Urdu variants: ک -> ك, ی -> ي
    /// - Converts Arabic-Indic digits to ASCII digits.
    /// - Strips punctuation.
    /// </summary>
    public static string NormalizeArabic(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var cleaned = ArabicDiacriticsAndTatweelRegex.Replace(text, string.Empty);
        var sb = new StringBuilder(cleaned.Length);

        foreach (var ch in cleaned)
        {
            switch (ch)
            {
                case 'أ':
                case 'إ':
                case 'آ':
                case 'ٱ':
                    sb.Append('ا');
                    break;
                case 'ة':
                    sb.Append('ه');
                    break;
                case 'ى':
                    sb.Append('ي');
                    break;
                case 'ؤ':
                    sb.Append('و');
                    break;
                case 'ئ':
                    sb.Append('ي');
                    break;
                case 'ک':
                    sb.Append('ك');
                    break;
                case 'ی':
                    sb.Append('ي');
                    break;
                case '٠': sb.Append('0'); break;
                case '١': sb.Append('1'); break;
                case '٢': sb.Append('2'); break;
                case '٣': sb.Append('3'); break;
                case '٤': sb.Append('4'); break;
                case '٥': sb.Append('5'); break;
                case '٦': sb.Append('6'); break;
                case '٧': sb.Append('7'); break;
                case '٨': sb.Append('8'); break;
                case '٩': sb.Append('9'); break;
                default:
                    sb.Append(ch);
                    break;
            }
        }

        var withoutPunctuation = PunctuationRegex.Replace(sb.ToString(), " ");
        return MultiSpaceRegex.Replace(withoutPunctuation, " ").Trim();
    }

    /// <summary>
    /// Normalizes English text: lowercase, punctuation removed, consecutive spaces trimmed.
    /// </summary>
    public static string NormalizeEnglish(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var lower = text.ToLowerInvariant();
        var cleaned = PunctuationRegex.Replace(lower, " ");
        return MultiSpaceRegex.Replace(cleaned, " ").Trim();
    }

    /// <summary>
    /// Applies English phonetic normalization for typo-tolerant matching:
    /// - Substitutes "ph" -> "f" (e.g. iphone -> ifone, phone -> fone)
    /// - Collapses duplicate letters (e.g. "ll" -> "l", "ss" -> "s", "tt" -> "t", "pp" -> "p")
    /// </summary>
    public static string NormalizeEnglishPhonetic(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var normalized = NormalizeEnglish(text);
        if (string.IsNullOrEmpty(normalized))
            return string.Empty;

        var replacedPh = normalized.Replace("ph", "f");
        var collapsed = DuplicateLettersRegex.Replace(replacedPh, "$1");
        return collapsed;
    }

    /// <summary>
    /// Unified normalization for mixed Arabic/English text.
    /// </summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var arabicNormalized = NormalizeArabic(text);
        var lower = arabicNormalized.ToLowerInvariant();
        var cleaned = PunctuationRegex.Replace(lower, " ");
        return MultiSpaceRegex.Replace(cleaned, " ").Trim();
    }

    public static List<string> Tokenize(string? text, bool filterStopWords = true)
    {
        if (string.IsNullOrWhiteSpace(text))
            return new List<string>();

        var normalized = Normalize(text);
        var tokens = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        var result = new List<string>(tokens.Length);
        foreach (var rawToken in tokens)
        {
            var token = rawToken.Trim();
            if (string.IsNullOrWhiteSpace(token))
                continue;

            if (filterStopWords && StopWords.Contains(token))
                continue;

            result.Add(token);
        }

        return result;
    }

    public static IReadOnlyList<string> GetSynonyms(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return Array.Empty<string>();

        var normalized = Normalize(token);
        if (SynonymDictionary.TryGetValue(normalized, out var synonyms))
        {
            return synonyms;
        }

        var phonetic = NormalizeEnglishPhonetic(token);
        if (phonetic != normalized && SynonymDictionary.TryGetValue(phonetic, out var phoneticSynonyms))
        {
            return phoneticSynonyms;
        }

        return new[] { normalized };
    }

    public static List<List<string>> ExpandQueryTokens(string query)
    {
        var tokens = Tokenize(query, filterStopWords: false);
        var expandedGroups = new List<List<string>>(tokens.Count);

        foreach (var token in tokens)
        {
            var synonyms = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { token };

            var directSynonyms = GetSynonyms(token);
            foreach (var s in directSynonyms)
            {
                synonyms.Add(s);
            }

            if (token.StartsWith("ال") && token.Length > 4)
            {
                var withoutAl = token.Substring(2);
                synonyms.Add(withoutAl);
                var subSynonyms = GetSynonyms(withoutAl);
                foreach (var s in subSynonyms)
                {
                    synonyms.Add(s);
                }
            }

            expandedGroups.Add(synonyms.ToList());
        }

        return expandedGroups;
    }

    public static string BuildSearchVector(
        string? nameAr,
        string? nameEn,
        string? brandNameAr,
        string? brandNameEn,
        string? categoryNameAr,
        string? categoryNameEn,
        string? keywords,
        string? description = null)
    {
        var uniqueTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddFieldTokens(string? field, bool expandSynonyms = true)
        {
            if (string.IsNullOrWhiteSpace(field))
                return;

            var tokens = Tokenize(field, filterStopWords: true);
            foreach (var token in tokens)
            {
                uniqueTokens.Add(token);

                if (expandSynonyms)
                {
                    var syns = GetSynonyms(token);
                    foreach (var syn in syns)
                    {
                        var normSyn = Normalize(syn);
                        if (!string.IsNullOrWhiteSpace(normSyn))
                        {
                            uniqueTokens.Add(normSyn);
                        }
                    }

                    if (token.StartsWith("ال") && token.Length > 4)
                    {
                        uniqueTokens.Add(token.Substring(2));
                    }
                }
            }
        }

        AddFieldTokens(nameAr, expandSynonyms: true);
        AddFieldTokens(nameEn, expandSynonyms: true);
        AddFieldTokens(brandNameAr, expandSynonyms: true);
        AddFieldTokens(brandNameEn, expandSynonyms: true);
        AddFieldTokens(categoryNameAr, expandSynonyms: true);
        AddFieldTokens(categoryNameEn, expandSynonyms: true);
        AddFieldTokens(keywords, expandSynonyms: true);

        if (!string.IsNullOrWhiteSpace(description))
        {
            var shortDesc = description.Length > 300 ? description.Substring(0, 300) : description;
            AddFieldTokens(shortDesc, expandSynonyms: false);
        }

        return string.Join(" ", uniqueTokens);
    }

    public static IEnumerable<string> GetAllKnownDictionaryTerms()
    {
        return SynonymDictionary.Keys;
    }

    private static Dictionary<string, List<string>> BuildBilingualDictionary()
    {
        var rawGroups = new List<string[]>
        {
            new[] { "ايفون", "iphone", "اي فون", "apple", "ابل" },
            new[] { "سامسونج", "samsung", "سامسنج", "جالكسي", "galaxy" },
            new[] { "شاومي", "xiaomi", "ريدمي", "redmi", "بوكو", "poco" },
            new[] { "هواوي", "huawei", "هونر", "honor" },
            new[] { "ريلمي", "realme", "اوبو", "oppo" },
            new[] { "انفينكس", "infinix" },
            new[] { "موبايل", "mobile", "phone", "هاتف", "تليفون", "smartphone", "جوال" },
            new[] { "تابلت", "tablet", "ايباد", "ipad", "لوحي" },

            new[] { "لابتوب", "laptop", "لاب توب", "كمبيوتر", "نوت بوك", "notebook", "pc" },
            new[] { "ماكبوك", "macbook", "ماك", "mac" },
            new[] { "ديل", "dell" },
            new[] { "اتش بي", "hp" },
            new[] { "لينوفو", "lenovo" },
            new[] { "اسوس", "asus" },
            new[] { "ايسر", "acer" },
            new[] { "ماوس", "mouse", "فارة" },
            new[] { "كيبورد", "keyboard", "لوحة مفاتيح" },
            new[] { "شاشة", "screen", "monitor", "display", "تلفزيون", "tv" },
            new[] { "بروجيكتور", "projector" },
            new[] { "طابعة", "printer" },
            new[] { "فلاشة", "flash drive", "usb", "فلاش ميموري" },
            new[] { "هارد", "hard drive", "ssd", "hdd", "هارد ديسك" },

            new[] { "شاحن", "charger", "راس شاحن", "شواحن", "ادابتر", "adapter" },
            new[] { "انكر", "anker" },
            new[] { "كابل", "cable", "سلك", "وصلة", "واير", "wire", "type c", "تايب سي", "lightning", "لايتنج", "micro", "مايكرو" },
            new[] { "سماعات", "headphones", "earphones", "earbuds", "airpods", "سماعة", "ايربودز", "بلوتوث", "bluetooth", "headset" },
            new[] { "جراب", "case", "cover", "كفر", "بيت", "جرابات" },
            new[] { "باوربانك", "powerbank", "باور بنك", "power bank", "شاحن متنقل", "بطارية متنقلة" },
            new[] { "ساعة ذكية", "smartwatch", "smart watch", "ساعة", "ساعه", "watch", "باند", "band" },
            new[] { "اسكرينة", "screen protector", "حماية شاشة", "لزقة شاشة", "سكرين" },
            new[] { "حامل", "holder", "ستاند", "stand", "حامل موبايل" },

            new[] { "تيشيرت", "tshirt", "t-shirt", "تي شيرت", "تشرت", "بولو", "polo" },
            new[] { "قميص", "shirt" },
            new[] { "بنطلون", "pants", "trousers", "بنطال", "جينز", "jeans" },
            new[] { "سويت شيرت", "sweatshirt", "هودي", "hoodie", "بلوفر", "sweater" },
            new[] { "جاكيت", "jacket", "معطف", "coat", "بليزر", "blazer" },
            new[] { "فستان", "dress", "فساتين" },
            new[] { "عباية", "abaya", "عباءة" },
            new[] { "بيجامة", "pajamas", "بيجاما" },
            new[] { "شورت", "shorts" },
            new[] { "حذاء", "shoes", "sneakers", "كوتشي", "شوز", "جزمة", "احذية", "footwear" },
            new[] { "صندل", "sandal", "شبشب", "slippers" },
            new[] { "شنطة", "bag", "حقيبة", "backpack", "شنطة ظهر", "كروس", "crossbody", "شنط" },
            new[] { "محفظة", "wallet", "محفظه" },
            new[] { "حزام", "belt" },
            new[] { "كاب", "cap", "طاقية", "hat" },
            new[] { "شراب", "socks", "جوارب" },
            new[] { "نظارة", "sunglasses", "glasses", "نظارات", "نظارة شمسية" },

            new[] { "نايك", "nike" },
            new[] { "اديداس", "adidas" },
            new[] { "بوما", "puma" },
            new[] { "زارا", "zara" },
            new[] { "اتش اند ام", "h&m", "hm" },
            new[] { "تومي", "tommy hilfiger", "tommy" },
            new[] { "كالفن كلاين", "calvin klein", "ck" },
            new[] { "لاكوست", "lacoste" },
            new[] { "كاسيو", "casio", "جي شوك", "g-shock" },

            new[] { "عطر", "perfume", "fragrance", "برفان", "بارفان", "كولونيا", "cologne", "بخور" },
            new[] { "مكياج", "makeup", "ميك اب", "cosmetics" },
            new[] { "روج", "lipstick", "احمر شفاه" },
            new[] { "ماسكارا", "mascara" },
            new[] { "فاونديشن", "foundation", "كريم اساس" },
            new[] { "كريم", "cream", "lotion", "لوشن", "مرطب", "moisturizer" },
            new[] { "سيروم", "serum" },
            new[] { "شامبو", "shampoo", "بلسم", "conditioner" },
            new[] { "شاور جل", "shower gel", "صابون", "soap" },
            new[] { "واقي شمس", "sunscreen", "صن بلوك", "sunblock" },
            new[] { "سشوار", "hair dryer", "مجفف شعر" },
            new[] { "مكواة شعر", "hair straightener", "بيبي ليس", "babyliss" },
            new[] { "ماكينة حلاقة", "shaver", "razor", "براون", "braun", "فيليبس", "philips" },
            new[] { "لوريال", "loreal" },

            new[] { "قلاية هوائية", "air fryer", "airfryer", "اير فراير", "قلاية بدون زيت" },
            new[] { "خلاط", "blender", "عصارة", "juicer" },
            new[] { "مفرمة", "chopper", "grinder", "كبة", "مفرمة لحم" },
            new[] { "مكنسة", "vacuum", "مكنسة كهربائية", "vacuum cleaner" },
            new[] { "مكواة", "iron", "مكواة بخار", "steam iron" },
            new[] { "غلاية", "kettle", "كاتيل", "غلاية مياه" },
            new[] { "ميكروويف", "microwave", "فرن", "oven" },
            new[] { "توشيبا", "toshiba" },
            new[] { "تورنيدو", "tornado" },
            new[] { "شارب", "sharp" },
            new[] { "بيكو", "beko" },
            new[] { "طقم حلل", "cookware set", "حلل", "جرانيت", "granite", "تيفال", "tefal" },

            new[] { "الكترونيات", "electronics", "devices", "اجهزة" },
            new[] { "ملابس", "clothing", "fashion", "ازياء", "موضة" },
            new[] { "احذية", "shoes", "footwear" },
            new[] { "منزل", "home", "مطبخ", "kitchen" },
            new[] { "جمال", "beauty", "صحة", "health" },
            new[] { "اطفال", "kids", "baby", "مواليد" },
            new[] { "رياضة", "sports", "fitness", "لياقة" },
            new[] { "اكسسوارات", "accessories" },
            new[] { "سوني", "sony", "بلايستيشن", "playstation", "ps5", "ps4" },
            new[] { "ال جي", "lg" }
        };

        var dict = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var group in rawGroups)
        {
            var normalizedGroup = group
                .Select(Normalize)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var term in normalizedGroup)
            {
                if (!dict.TryGetValue(term, out var list))
                {
                    list = new List<string>();
                    dict[term] = list;
                }

                foreach (var other in normalizedGroup)
                {
                    if (!list.Contains(other, StringComparer.OrdinalIgnoreCase))
                    {
                        list.Add(other);
                    }
                }
            }
        }

        return dict;
    }
}
