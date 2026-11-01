namespace Marketplace.Application.Services.Search;

/// <summary>
/// High-performance fuzzy matching and typo-tolerance engine implementing
/// Levenshtein distance, Damerau-Levenshtein distance, and similarity scoring
/// for Arabic and English search terms.
/// </summary>
public static class FuzzyMatcher
{
    private const int DefaultMaxDistance = 2;
    private const double DefaultMinSimilarity = 0.75;

    public static int ComputeLevenshteinDistance(string? s, string? t)
    {
        if (string.IsNullOrEmpty(s))
            return string.IsNullOrEmpty(t) ? 0 : t.Length;
        if (string.IsNullOrEmpty(t))
            return s.Length;

        if (s.Length > t.Length)
        {
            var temp = s;
            s = t;
            t = temp;
        }

        var m = s.Length;
        var n = t.Length;

        Span<int> prev = m < 128 ? stackalloc int[m + 1] : new int[m + 1];
        Span<int> curr = m < 128 ? stackalloc int[m + 1] : new int[m + 1];

        for (var i = 0; i <= m; i++)
        {
            prev[i] = i;
        }

        for (var j = 1; j <= n; j++)
        {
            curr[0] = j;
            var tChar = t[j - 1];

            for (var i = 1; i <= m; i++)
            {
                var cost = s[i - 1] == tChar ? 0 : 1;
                var insertion = curr[i - 1] + 1;
                var deletion = prev[i] + 1;
                var substitution = prev[i - 1] + cost;

                var min = insertion < deletion ? insertion : deletion;
                curr[i] = min < substitution ? min : substitution;
            }

            for (var i = 0; i <= m; i++)
            {
                prev[i] = curr[i];
            }
        }

        return prev[m];
    }

    public static int ComputeDamerauLevenshteinDistance(string? s, string? t)
    {
        if (string.IsNullOrEmpty(s))
            return string.IsNullOrEmpty(t) ? 0 : t.Length;
        if (string.IsNullOrEmpty(t))
            return s.Length;

        var m = s.Length;
        var n = t.Length;

        var d = new int[m + 2, n + 2];
        var maxDist = m + n;
        d[0, 0] = maxDist;

        for (var i = 0; i <= m; i++)
        {
            d[i + 1, 0] = maxDist;
            d[i + 1, 1] = i;
        }

        for (var j = 0; j <= n; j++)
        {
            d[0, j + 1] = maxDist;
            d[1, j + 1] = j;
        }

        var da = new Dictionary<char, int>();

        for (var i = 1; i <= m; i++)
        {
            var db = 0;
            var sChar = s[i - 1];

            for (var j = 1; j <= n; j++)
            {
                var tChar = t[j - 1];
                var k = da.TryGetValue(tChar, out var val) ? val : 0;
                var l = db;
                var cost = sChar == tChar ? 0 : 1;

                if (cost == 0)
                {
                    db = j;
                }

                var subst = d[i, j] + cost;
                var insert = d[i + 1, j] + 1;
                var delete = d[i, j + 1] + 1;
                var min = insert < delete ? insert : delete;
                min = min < subst ? min : subst;

                var transpose = d[k, l] + (i - k - 1) + 1 + (j - l - 1);
                if (k > 0 && l > 0 && transpose < min)
                {
                    min = transpose;
                }

                d[i + 1, j + 1] = min;
            }

            da[sChar] = i;
        }

        return d[m + 1, n + 1];
    }

    public static double ComputeSimilarity(string? s, string? t)
    {
        if (string.IsNullOrEmpty(s) && string.IsNullOrEmpty(t))
            return 1.0;
        if (string.IsNullOrEmpty(s) || string.IsNullOrEmpty(t))
            return 0.0;

        var maxLen = Math.Max(s.Length, t.Length);
        if (maxLen == 0)
            return 1.0;

        var distance = ComputeDamerauLevenshteinDistance(s, t);
        var similarity = 1.0 - ((double)distance / maxLen);
        return Math.Max(0.0, Math.Min(1.0, similarity));
    }

    public static bool IsFuzzyMatch(
        string? input,
        string? target,
        int maxDistance = DefaultMaxDistance,
        double minSimilarity = DefaultMinSimilarity)
    {
        if (string.IsNullOrWhiteSpace(input) || string.IsNullOrWhiteSpace(target))
            return false;

        var normInput = SearchTextProcessor.Normalize(input);
        var normTarget = SearchTextProcessor.Normalize(target);

        if (string.Equals(normInput, normTarget, StringComparison.OrdinalIgnoreCase))
            return true;

        if (normInput.Length >= 3 && normTarget.StartsWith(normInput, StringComparison.OrdinalIgnoreCase))
            return true;

        var phoneticInput = SearchTextProcessor.NormalizeEnglishPhonetic(normInput);
        var phoneticTarget = SearchTextProcessor.NormalizeEnglishPhonetic(normTarget);
        if (!string.IsNullOrEmpty(phoneticInput) && phoneticInput == phoneticTarget)
            return true;

        var lengthDiff = Math.Abs(normInput.Length - normTarget.Length);
        if (lengthDiff > maxDistance + 1)
            return false;

        var distance = ComputeDamerauLevenshteinDistance(normInput, normTarget);
        if (distance <= maxDistance)
            return true;

        var maxLen = Math.Max(normInput.Length, normTarget.Length);
        var similarity = 1.0 - ((double)distance / maxLen);

        return similarity >= minSimilarity;
    }

    public static (bool IsMatch, int Distance, double Similarity) EvaluateMatch(
        string? input,
        string? target,
        int maxDistance = DefaultMaxDistance,
        double minSimilarity = DefaultMinSimilarity)
    {
        if (string.IsNullOrWhiteSpace(input) || string.IsNullOrWhiteSpace(target))
            return (false, int.MaxValue, 0.0);

        var normInput = SearchTextProcessor.Normalize(input);
        var normTarget = SearchTextProcessor.Normalize(target);

        if (string.Equals(normInput, normTarget, StringComparison.OrdinalIgnoreCase))
            return (true, 0, 1.0);

        var phoneticInput = SearchTextProcessor.NormalizeEnglishPhonetic(normInput);
        var phoneticTarget = SearchTextProcessor.NormalizeEnglishPhonetic(normTarget);
        if (!string.IsNullOrEmpty(phoneticInput) && phoneticInput == phoneticTarget)
            return (true, 0, 0.95);

        var distance = ComputeDamerauLevenshteinDistance(normInput, normTarget);
        var maxLen = Math.Max(normInput.Length, normTarget.Length);
        var similarity = maxLen > 0 ? 1.0 - ((double)distance / maxLen) : 1.0;

        var isMatch = distance <= maxDistance || similarity >= minSimilarity;
        return (isMatch, distance, similarity);
    }

    public static string? FindClosestCandidate(
        string input,
        IEnumerable<string> candidates,
        int maxDistance = DefaultMaxDistance,
        double minSimilarity = 0.70)
    {
        if (string.IsNullOrWhiteSpace(input))
            return null;

        var normInput = SearchTextProcessor.Normalize(input);
        string? bestCandidate = null;
        var highestSimilarity = 0.0;
        var lowestDistance = int.MaxValue;

        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
                continue;

            var normCandidate = SearchTextProcessor.Normalize(candidate);

            if (string.Equals(normInput, normCandidate, StringComparison.OrdinalIgnoreCase))
                continue;

            var distance = ComputeDamerauLevenshteinDistance(normInput, normCandidate);
            var maxLen = Math.Max(normInput.Length, normCandidate.Length);
            var similarity = maxLen > 0 ? 1.0 - ((double)distance / maxLen) : 0.0;

            if (distance <= maxDistance && similarity >= minSimilarity)
            {
                if (similarity > highestSimilarity || (Math.Abs(similarity - highestSimilarity) < 0.001 && distance < lowestDistance))
                {
                    highestSimilarity = similarity;
                    lowestDistance = distance;
                    bestCandidate = candidate;
                }
            }
        }

        return bestCandidate;
    }
}
