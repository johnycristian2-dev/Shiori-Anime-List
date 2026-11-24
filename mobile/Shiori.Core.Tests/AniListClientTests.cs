using System.Net;
using System.Text.Json.Nodes;
using Shiori.Core.AniList;

namespace Shiori.Core.Tests;

public class AniListClientTests
{
    private const string MediaJson = """
      { "id": 154587, "idMal": 52991,
        "title": { "romaji": "Sousou no Frieren", "english": "Frieren: Beyond Journey's End", "native": "葬送のフリーレン" },
        "coverImage": { "extraLarge": "https://img/xl.jpg", "large": "https://img/l.jpg", "color": "#e4c9a1" },
        "bannerImage": "https://img/banner.jpg", "episodes": 28, "format": "TV", "status": "FINISHED",
        "season": "FALL", "seasonYear": 2023, "averageScore": 91, "popularity": 1, "genres": ["Adventure","Drama"],
        "type": "ANIME", "chapters": null, "volumes": null, "countryOfOrigin": "JP" }
    """;

    private static string Page(params string[] media) => "{\"data\":{\"Page\":{\"media\":[" + string.Join(",", media) + "]}}}";

    [Fact]
    public async Task Trending_ParsesPage()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, Page(MediaJson));
        var list = await new AniListClient(http.Client()).TrendingAsync();

        var m = Assert.Single(list);
        Assert.Equal(new MediaSummary(154587, 52991, "Sousou no Frieren", "Frieren: Beyond Journey's End", "葬送のフリーレン",
            "https://img/xl.jpg", "#e4c9a1", "TV", 28, null, null, "JP", 2023, ["Adventure", "Drama"], 91, "ANIME") with { Genres = m.Genres }, m);
        Assert.Equal(["Adventure", "Drama"], m.Genres);
        Assert.Equal("Frieren: Beyond Journey's End", m.DisplayTitle);

        var (req, body) = http.Requests.Single();
        Assert.Equal(HttpMethod.Post, req.Method);
        Assert.Equal(Config.AniListUrl, req.RequestUri!.ToString().TrimEnd('/'));
        var sent = JsonNode.Parse(body!)!;
        Assert.Contains("TRENDING_DESC", (string)sent["query"]!);
        Assert.Equal("ANIME", (string)sent["variables"]!["type"]!);
    }

    [Fact]
    public async Task Search_SendsVariables()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, Page());
        var list = await new AniListClient(http.Client()).SearchAsync("frieren", "MANGA");

        Assert.Empty(list);
        var sent = JsonNode.Parse(http.Requests.Single().Body!)!;
        Assert.Equal("frieren", (string)sent["variables"]!["search"]!);
        Assert.Equal("MANGA", (string)sent["variables"]!["type"]!);
        Assert.Contains("SEARCH_MATCH", (string)sent["query"]!);
    }

    [Fact]
    public async Task Season_SendsSeasonAndYear()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, Page(MediaJson));
        await new AniListClient(http.Client()).SeasonAsync(2026, "FALL");
        var vars = JsonNode.Parse(http.Requests.Single().Body!)!["variables"]!;
        Assert.Equal("FALL", (string)vars["season"]!);
        Assert.Equal(2026, (int)vars["year"]!);
    }

    [Fact]
    public void CurrentSeason_FollowsSite()
    {
        Assert.Equal((2026, "FALL"), AniListClient.CurrentSeason(new DateTime(2026, 11, 24)));
        Assert.Equal((2026, "WINTER"), AniListClient.CurrentSeason(new DateTime(2026, 1, 5)));
        Assert.Equal((2026, "SUMMER"), AniListClient.CurrentSeason(new DateTime(2026, 7, 1)));
    }

    [Fact]
    public async Task Detail_StripsHtml()
    {
        var detail = "{\"data\":{\"Media\": " + MediaJson.TrimEnd().TrimEnd('}') + """
        ,
          "description": "A elfa <i>Frieren</i>.<br><br>Depois da jornada.&quot;Fim&quot;",
          "studios": { "nodes": [ { "id": 11, "name": "Madhouse" } ] },
          "characters": { "edges": [ { "role": "MAIN", "node": { "id": 1, "name": { "full": "Frieren" }, "image": { "large": "f.jpg" } } } ] },
          "nextAiringEpisode": { "episode": 5, "airingAt": 1800000000 } }}}
        """;
        var http = new FakeHandler().Respond(HttpStatusCode.OK, detail);

        var d = await new AniListClient(http.Client()).DetailAsync(154587);

        Assert.Equal("A elfa Frieren.\n\nDepois da jornada.\"Fim\"", d.Description);
        Assert.Equal("https://img/banner.jpg", d.Banner);
        Assert.Equal(["Madhouse"], d.Studios);
        Assert.Equal(new CharacterSummary(1, "Frieren", "f.jpg"), Assert.Single(d.Characters));
        Assert.Equal(5, d.NextEpisode);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1800000000), d.NextEpisodeAt);
        Assert.Equal("FALL", d.Season);
        Assert.Equal("FINISHED", d.Status);
        Assert.Equal(154587, d.Summary.Id);
        Assert.Equal(154587, (int)JsonNode.Parse(http.Requests.Single().Body!)!["variables"]!["id"]!);
    }

    [Fact]
    public async Task Detail_CollapsesBlankLines()
    {
        var detail = "{\"data\":{\"Media\": " + MediaJson.TrimEnd().TrimEnd('}') +
            ", \"description\": \"Fim da jornada.<br><br>\\n<br><br>\\n(Source: Crunchyroll)\" }}}";
        var http = new FakeHandler().Respond(HttpStatusCode.OK, detail);

        var d = await new AniListClient(http.Client()).DetailAsync(1);

        Assert.Equal("Fim da jornada.\n\n(Source: Crunchyroll)", d.Description);
    }

    [Fact]
    public async Task HttpError_ThrowsShioriException()
    {
        var down = new FakeHandler().Respond(HttpStatusCode.InternalServerError, "oops");
        var ex = await Assert.ThrowsAsync<ShioriException>(() => new AniListClient(down.Client()).TrendingAsync());
        Assert.Equal(ShioriException.NoConnection, ex.Message);

        var offline = new FakeHandler().Fail(new HttpRequestException("offline"));
        ex = await Assert.ThrowsAsync<ShioriException>(() => new AniListClient(offline.Client()).SearchAsync("x", "ANIME"));
        Assert.Equal(ShioriException.NoConnection, ex.Message);
    }

    [Fact]
    public async Task RateLimited_FriendlyMessage()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.TooManyRequests, """{"errors":[{"message":"Too Many Requests."}]}""");
        var ex = await Assert.ThrowsAsync<ShioriException>(() => new AniListClient(http.Client()).TrendingAsync());
        Assert.Equal("O AniList pediu uma pausa. Tente em alguns segundos.", ex.Message);
    }

    [Fact]
    public async Task GraphQlErrors_Throw()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, """{"data":{"Media":null},"errors":[{"message":"Not Found."}]}""");
        var ex = await Assert.ThrowsAsync<ShioriException>(() => new AniListClient(http.Client()).DetailAsync(1));
        Assert.Equal("Não encontrei esse título no AniList.", ex.Message);
    }
}
