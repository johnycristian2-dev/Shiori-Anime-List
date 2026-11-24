namespace Shiori.Core.List;

/// <summary>Números do Perfil: quantos itens em cada status e episódios/capítulos vistos.</summary>
public sealed class ListStats
{
    private readonly Dictionary<ListStatus, int> _counts;

    private ListStats(Dictionary<ListStatus, int> counts, int total, int episodes, int chapters)
    {
        _counts = counts;
        Total = total;
        EpisodesWatched = episodes;
        ChaptersRead = chapters;
    }

    public int Total { get; }
    public int EpisodesWatched { get; }
    public int ChaptersRead { get; }

    public int Count(ListStatus status) => _counts.GetValueOrDefault(status);

    public static ListStats From(IEnumerable<ListEntryView> entries)
    {
        var list = entries.ToList();
        return new ListStats(
            list.GroupBy(e => e.Status).ToDictionary(g => g.Key, g => g.Count()),
            list.Count,
            list.Where(e => !e.IsManga).Sum(e => e.Progress),
            list.Where(e => e.IsManga).Sum(e => e.Progress));
    }
}
