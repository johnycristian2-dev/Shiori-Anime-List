using Shiori.Core.Display;
using Shiori.Core.List;

namespace Shiori.Core.Tests;

public class DisplayTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 24, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(30, "Ep 5 em 30 min")]
    [InlineData(5 * 60, "Ep 5 em 5 h")]
    [InlineData(26 * 60, "Ep 5 amanhã")]
    [InlineData(3 * 24 * 60, "Ep 5 em 3 dias")]
    [InlineData(-10, "Ep 5 já saiu")]
    public void NextEpisode_Text(int minutesAhead, string expected)
    {
        Assert.Equal(expected, Format.NextEpisode(5, Now.AddMinutes(minutesAhead), Now));
    }

    [Fact]
    public void ContinueWatching_OnlyWatchingNewestFirst()
    {
        ListEntryView E(int id, ListStatus s, long at) => new(id, $"T{id}", null, s, 1, 12, 0, false, "ANIME", at);
        var picked = Format.ContinueWatching([E(1, ListStatus.WATCHING, 10), E(2, ListStatus.PLANNING, 99), E(3, ListStatus.WATCHING, 50), E(4, ListStatus.WATCHING, 20)], max: 2);
        Assert.Equal([3, 4], picked.Select(e => e.MediaId));
    }

    [Theory]
    [InlineData(91, "91%")]
    [InlineData(null, "—")]
    public void Score_Text(int? score, string expected) => Assert.Equal(expected, Format.Score(score));

    [Theory]
    [InlineData("TV", "TV")]
    [InlineData("MOVIE", "Filme")]
    [InlineData("ONA", "ONA")]
    [InlineData("MANGA", "Mangá")]
    [InlineData("ONE_SHOT", "One-shot")]
    [InlineData(null, "")]
    public void Format_Label(string? format, string expected) => Assert.Equal(expected, Format.MediaFormat(format));
}
