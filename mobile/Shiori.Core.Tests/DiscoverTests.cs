using System.Text.Json.Nodes;
using Shiori.Core.AniList;
using Shiori.Core.Discover;
using Shiori.Core.List;

namespace Shiori.Core.Tests;

public class DiscoverTests
{
    private static MediaSummary M(int id, string type = "ANIME") =>
        new(id, null, $"T{id}", null, null, null, null, "TV", 12, null, null, null, 2024, [], 80, type);

    private static ListEntryView E(int id, ListStatus s, int score = 0, long at = 0) =>
        new(id, $"T{id}", null, s, 0, 12, score, false, "ANIME", at);

    // --- Calendário ---

    [Fact]
    public void Calendar_GroupsByLocalDayWithLabels()
    {
        var brt = TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "BRT", "BRT");
        var now = new DateTimeOffset(2026, 11, 24, 12, 0, 0, TimeSpan.FromHours(-3)); // terça
        AiringItem A(int id, int day, int hour) => new(1, new DateTimeOffset(2026, 11, day, hour, 0, 0, TimeSpan.FromHours(-3)), M(id));

        // 25/11 01:00 em Brasília = 25/11 04:00 UTC: tem que cair na quarta, não na terça
        var days = Calendar.GroupByDay([A(3, 25, 1), A(1, 24, 22), A(2, 24, 8), A(4, 27, 9)], brt, now);

        Assert.Equal(["Hoje", "Amanhã", "Sexta, 27/11"], days.Select(d => d.Label));
        Assert.Equal([2, 1], days[0].Items.Select(i => i.Media.Id)); // em ordem de horário
        Assert.Equal([3], days[1].Items.Select(i => i.Media.Id));
    }

    [Fact]
    public void Calendar_MarksWhatIsInMyList()
    {
        var mine = new HashSet<int> { 2 };
        var items = Calendar.OnlyMine([new AiringItem(1, DateTimeOffset.UnixEpoch, M(1)), new AiringItem(1, DateTimeOffset.UnixEpoch, M(2))], mine);
        Assert.Equal([2], items.Select(i => i.Media.Id));
    }

    // --- Roleta ---

    [Fact]
    public void Roulette_PicksFromPlanningOnly()
    {
        var entries = new[] { E(1, ListStatus.WATCHING), E(2, ListStatus.PLANNING), E(3, ListStatus.PLANNING), E(4, ListStatus.COMPLETED) };
        var picks = Enumerable.Range(0, 50).Select(seed => Roulette.Pick(entries, new Random(seed))!.MediaId).ToHashSet();
        Assert.Equal(new HashSet<int> { 2, 3 }, picks);
        Assert.Null(Roulette.Pick([E(1, ListStatus.WATCHING)], new Random(1)));
    }

    // --- Swipe ---

    [Fact]
    public void Skip_AddsOnceAndDeckHidesListAndSkipped()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(M(1), ListStatus.PLANNING, 1);
        doc.Skip(2);
        doc.Skip(2);
        Assert.Equal([2], doc.Skipped);
        Assert.Single(doc.ToJson()["skipped"]!.AsArray());

        var deck = SwipeDeck.Filter([M(1), M(2), M(3)], doc);
        Assert.Equal([3], deck.Select(m => m.Id));
    }

    // --- Pra você ---

    [Theory]
    [InlineData(ListStatus.DROPPED, 9, 0.0)]
    [InlineData(ListStatus.COMPLETED, 8, 0.8)]
    [InlineData(ListStatus.COMPLETED, 0, 0.7)]
    [InlineData(ListStatus.WATCHING, 0, 0.65)]
    [InlineData(ListStatus.PLANNING, 0, 0.45)]
    [InlineData(ListStatus.PAUSED, 1, 0.2)]
    public void Weight_FollowsSite(ListStatus status, int score, double expected) =>
        Assert.Equal(expected, Recommender.Weight(E(1, status, score)), 3);

    [Fact]
    public void Seeds_BestRatedFirstWithoutDropped()
    {
        var seeds = Recommender.Seeds([E(1, ListStatus.COMPLETED, 6), E(2, ListStatus.DROPPED, 10), E(3, ListStatus.COMPLETED, 9), E(4, ListStatus.WATCHING)], max: 2);
        Assert.Equal([3, 1], seeds.Select(s => s.MediaId));
    }

    [Fact]
    public void Rank_SumsLogRatingTimesWeightAndHidesKnown()
    {
        var seeds = new[] { E(1, ListStatus.COMPLETED, 10), E(2, ListStatus.WATCHING) };
        var recs = new Dictionary<int, IReadOnlyList<Recommendation>>
        {
            [1] = [new(15, M(10)), new(1, M(11)), new(50, M(2))],  // 2 já está na lista
            [2] = [new(15, M(11)), new(100, M(12))],
        };

        var ranked = Recommender.Rank(seeds, recs, exclude: new HashSet<int> { 1, 2, 99 });

        // 10: log2(16)*1.0 = 4 · 11: log2(2)*1.0 + log2(16)*0.65 = 3.6 · 12: log2(101)*0.65 ≈ 4.33
        Assert.Equal([12, 10, 11], ranked.Select(r => r.Media.Id));
        Assert.Equal(["T2"], ranked[0].Because);
        Assert.Equal(["T1", "T2"], ranked[2].Because);
    }
}
