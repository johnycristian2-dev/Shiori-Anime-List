using System.Net;
using System.Text.Json.Nodes;
using Shiori.Core.AniList;

namespace Shiori.Core.Tests;

/// <summary>Consultas das telas da segunda leva: personagem, dublador, estúdio, calendário, explorar, recomendações.</summary>
public class AniListMoreTests
{
    private static string Media(int id, string title = "X", string type = "ANIME") =>
        "{\"id\":" + id + ",\"title\":{\"romaji\":\"" + title + "\"},\"coverImage\":{\"large\":\"c" + id + ".jpg\"},\"type\":\"" + type + "\",\"genres\":[]}";

    private static JsonNode Sent(FakeHandler http, int i = 0) => JsonNode.Parse(http.Requests[i].Body!)!;

    [Fact]
    public async Task Character_ParsesRolesAndVoiceActors()
    {
        var json = "{\"data\":{\"Character\":{\"id\":7,\"favourites\":1200,\"gender\":\"Female\",\"age\":\"1000+\"," +
                   "\"name\":{\"full\":\"Frieren\",\"native\":\"フリーレン\",\"alternative\":[\"Elfa\"]},\"image\":{\"large\":\"f.jpg\"}," +
                   "\"description\":\"Uma <b>elfa</b>.\",\"dateOfBirth\":{\"month\":12,\"day\":1}," +
                   "\"media\":{\"edges\":[{\"characterRole\":\"MAIN\",\"node\":" + Media(1, "Frieren") + "," +
                   "\"voiceActors\":[{\"id\":99,\"name\":{\"full\":\"Atsumi Tanezaki\"},\"image\":{\"large\":\"v.jpg\"}}]}]}}}}";
        var http = new FakeHandler().Respond(HttpStatusCode.OK, json);

        var c = await new AniListClient(http.Client()).CharacterAsync(7);

        Assert.Equal("Frieren", c.Name);
        Assert.Equal("フリーレン", c.NativeName);
        Assert.Equal("Uma elfa.", c.Description);
        Assert.Equal("1/12", c.Birthday);
        Assert.Equal(1200, c.Favourites);
        var role = Assert.Single(c.Appearances);
        Assert.Equal("Principal", role.Role);
        Assert.Equal(1, role.Media.Id);
        Assert.Equal(new PersonSummary(99, "Atsumi Tanezaki", "v.jpg"), role.VoiceActor);
        Assert.Equal(7, (int)Sent(http)["variables"]!["id"]!);
    }

    [Fact]
    public async Task Staff_ParsesCharactersPlayed()
    {
        var json = "{\"data\":{\"Staff\":{\"id\":99,\"name\":{\"full\":\"Atsumi Tanezaki\",\"native\":\"種﨑敦美\"},\"image\":{\"large\":\"v.jpg\"}," +
                   "\"description\":null,\"homeTown\":\"Oita\",\"yearsActive\":[2009],\"favourites\":5," +
                   "\"characterMedia\":{\"pageInfo\":{\"hasNextPage\":false},\"edges\":[{\"characterRole\":\"SUPPORTING\",\"node\":" + Media(2, "Spy") + "," +
                   "\"characters\":[{\"id\":8,\"name\":{\"full\":\"Anya\"},\"image\":{\"large\":\"a.jpg\"}}]}]}}}}";
        var http = new FakeHandler().Respond(HttpStatusCode.OK, json);

        var s = await new AniListClient(http.Client()).StaffAsync(99);

        Assert.Equal("Atsumi Tanezaki", s.Name);
        Assert.Equal("Oita", s.HomeTown);
        var role = Assert.Single(s.Roles);
        Assert.Equal("Coadjuvante", role.Role);
        Assert.Equal(new PersonSummary(8, "Anya", "a.jpg"), role.Character);
        Assert.Equal(2, role.Media.Id);
    }

    [Fact]
    public async Task Studio_ParsesWorks()
    {
        var json = "{\"data\":{\"Studio\":{\"id\":11,\"name\":\"Madhouse\",\"isAnimationStudio\":true," +
                   "\"media\":{\"pageInfo\":{\"hasNextPage\":true},\"nodes\":[" + Media(1) + "," + Media(3) + "]}}}}";
        var http = new FakeHandler().Respond(HttpStatusCode.OK, json);

        var s = await new AniListClient(http.Client()).StudioAsync(11, page: 2);

        Assert.Equal("Madhouse", s.Name);
        Assert.Equal([1, 3], s.Works.Select(m => m.Id));
        Assert.True(s.HasNextPage);
        Assert.Equal(2, (int)Sent(http)["variables"]!["page"]!);
    }

    [Fact]
    public async Task Airing_FollowsPagesAndSkipsAdult()
    {
        string Page(bool next, params string[] items) =>
            "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":" + (next ? "true" : "false") + "},\"airingSchedules\":[" + string.Join(",", items) + "]}}}";
        string Item(int ep, long at, int id, bool adult = false) =>
            "{\"episode\":" + ep + ",\"airingAt\":" + at + ",\"media\":" + Media(id).TrimEnd('}') + ",\"isAdult\":" + (adult ? "true" : "false") + "}}";
        var http = new FakeHandler()
            .Respond(HttpStatusCode.OK, Page(true, Item(3, 1000, 1), Item(1, 1100, 9, adult: true)))
            .Respond(HttpStatusCode.OK, Page(false, Item(7, 2000, 2)));

        var list = await new AniListClient(http.Client()).AiringAsync(DateTimeOffset.FromUnixTimeSeconds(0), DateTimeOffset.FromUnixTimeSeconds(5000));

        Assert.Equal([1, 2], list.Select(a => a.Media.Id));
        Assert.Equal(3, list[0].Episode);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1000), list[0].AiringAt);
        Assert.Equal(2, http.Requests.Count);
        Assert.Equal(0, (int)Sent(http)["variables"]!["from"]!);
        Assert.Equal(5000, (int)Sent(http)["variables"]!["to"]!);
        Assert.Equal(2, (int)Sent(http, 1)["variables"]!["page"]!);
    }

    [Fact]
    public async Task Browse_SendsOnlyChosenFilters()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":true},\"media\":[" + Media(5) + "]}}}");
        var filter = new BrowseFilter(Type: "ANIME", Sort: "SCORE_DESC", Genre: "Drama", Season: "FALL", Year: 2023, Format: "TV");

        var page = await new AniListClient(http.Client()).BrowseAsync(filter, 3);

        Assert.Equal([5], page.Items.Select(m => m.Id));
        Assert.True(page.HasNextPage);
        var v = Sent(http)["variables"]!;
        Assert.Equal("ANIME", (string)v["type"]!);
        Assert.Equal("SCORE_DESC", (string)v["sort"]![0]!);
        Assert.Equal("Drama", (string)v["genres"]![0]!);
        Assert.Equal("FALL", (string)v["season"]!);
        Assert.Equal(2023, (int)v["seasonYear"]!);
        Assert.Equal("TV", (string)v["formats"]![0]!);
        Assert.Equal(3, (int)v["page"]!);
        Assert.Null(v["country"]);

        http.Respond(HttpStatusCode.OK, "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":false},\"media\":[]}}}");
        await new AniListClient(http.Client()).BrowseAsync(new BrowseFilter(Type: "MANGA", Country: "KR"), 1);
        var v2 = Sent(http, 1)["variables"]!;
        Assert.Equal("KR", (string)v2["country"]!);
        Assert.Null(v2["genres"]);
        Assert.Null(v2["season"]);
    }

    [Fact]
    public async Task Genres_ListsCollection()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, "{\"data\":{\"GenreCollection\":[\"Action\",\"Hentai\",\"Drama\"]}}");
        var genres = await new AniListClient(http.Client()).GenresAsync();
        Assert.Equal(["Action", "Drama"], genres); // sem gênero adulto
    }

    [Fact]
    public async Task Recommendations_UsesAliasesPerSeed()
    {
        var json = "{\"data\":{" +
                   "\"m0\":{\"id\":1,\"recommendations\":{\"nodes\":[{\"rating\":50,\"mediaRecommendation\":" + Media(10) + "},{\"rating\":3,\"mediaRecommendation\":null}]}}," +
                   "\"m1\":{\"id\":2,\"recommendations\":{\"nodes\":[{\"rating\":7,\"mediaRecommendation\":" + Media(10) + "}]}}}}";
        var http = new FakeHandler().Respond(HttpStatusCode.OK, json);

        var recs = await new AniListClient(http.Client()).RecommendationsAsync([1, 2]);

        Assert.Equal(2, recs.Count);
        Assert.Equal(50, Assert.Single(recs[1]).Rating);
        Assert.Equal(10, recs[2][0].Media.Id);
        var query = (string)Sent(http)["query"]!;
        Assert.Contains("m0: Media(id: 1)", query);
        Assert.Contains("m1: Media(id: 2)", query);
    }
}
