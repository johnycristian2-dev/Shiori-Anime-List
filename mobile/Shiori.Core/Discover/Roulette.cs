using Shiori.Core.AniList;
using Shiori.Core.List;

namespace Shiori.Core.Discover;

/// <summary>Roleta: sorteia o próximo da sua lista "Quero ver".</summary>
public static class Roulette
{
    public static ListEntryView? Pick(IEnumerable<ListEntryView> entries, Random random)
    {
        var options = entries.Where(e => e.Status == ListStatus.PLANNING).ToList();
        return options.Count == 0 ? null : options[random.Next(options.Count)];
    }
}

/// <summary>Swipe: o baralho não mostra o que já está na lista nem o que você pulou.</summary>
public static class SwipeDeck
{
    public static IReadOnlyList<MediaSummary> Filter(IEnumerable<MediaSummary> media, ListDocument doc)
    {
        var skipped = doc.Skipped.ToHashSet();
        return media.Where(m => doc.Get(m.Id) is null && !skipped.Contains(m.Id)).DistinctBy(m => m.Id).ToList();
    }
}
