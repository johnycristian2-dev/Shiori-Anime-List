using Shiori.Core.AniList;
using Shiori.Core.List;

namespace Shiori.Core.Discover;

/// <summary>Uma sugestão da tela "Pra você", com os títulos da sua lista que levaram a ela.</summary>
public sealed record Suggestion(MediaSummary Media, double Score, IReadOnlyList<string> Because);

/// <summary>
/// "Pra você": mesma fórmula do site (src/pages/Recommendations.tsx e usePersonalRecs).
/// 1. escolhe "sementes" na sua lista (melhores notas primeiro, sem os dropados);
/// 2. busca no AniList o que a comunidade recomenda para cada semente;
/// 3. pontua cada sugestão: soma de log2(1 + votos) × peso da semente; esconde o que já está na lista.
/// </summary>
public static class Recommender
{
    public const int MaxSeeds = 10;

    /// <summary>Quanto você gostou: a nota (0–10 vira 0–1) ou um valor pelo status.</summary>
    public static double Weight(ListEntryView e)
    {
        if (e.Status == ListStatus.DROPPED) return 0;
        var baseWeight = e.Score > 0 ? e.Score / 10.0
            : e.Status switch { ListStatus.COMPLETED => 0.7, ListStatus.WATCHING => 0.65, _ => 0.45 };
        return Math.Max(0.2, baseWeight);
    }

    public static IReadOnlyList<ListEntryView> Seeds(IEnumerable<ListEntryView> entries, int max = MaxSeeds) =>
        entries.Where(e => e.Status != ListStatus.DROPPED)
            .OrderByDescending(e => e.Score)
            .ThenByDescending(Weight)
            .ThenByDescending(e => e.UpdatedAt)
            .Take(max)
            .ToList();

    public static IReadOnlyList<Suggestion> Rank(
        IEnumerable<ListEntryView> seeds,
        IReadOnlyDictionary<int, IReadOnlyList<Recommendation>> recs,
        IReadOnlySet<int> exclude)
    {
        var map = new Dictionary<int, (MediaSummary Media, double Score, List<string> Because)>();
        foreach (var seed in seeds)
        {
            if (!recs.TryGetValue(seed.MediaId, out var list)) continue;
            var weight = Weight(seed);
            foreach (var r in list)
            {
                if (r.Rating <= 0 || exclude.Contains(r.Media.Id)) continue;
                var item = map.TryGetValue(r.Media.Id, out var found) ? found : (Media: r.Media, Score: 0.0, Because: new List<string>());
                item.Score += Math.Log2(1 + r.Rating) * weight;
                if (!item.Because.Contains(seed.Title)) item.Because.Add(seed.Title);
                map[r.Media.Id] = item;
            }
        }
        return map.Values
            .OrderByDescending(v => v.Score)
            .Select(v => new Suggestion(v.Media, v.Score, v.Because))
            .ToList();
    }
}
