using System.Net;
using Shiori.Core.Auth;
using Shiori.Core.List;
using Shiori.Core.Profile;

namespace Shiori.Core.Tests;

public class ProfileServiceTests
{
    private static async Task<AuthService> LoggedIn(FakeHandler http)
    {
        var auth = new AuthService(http.Client(), new MemoryStore { Json = Sessions.Json(access: "TOKEN", userId: "u1") });
        await auth.RestoreAsync();
        return auth;
    }

    [Fact]
    public async Task GetMine_UsesUserIdColumn()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK,
            """[{"user_id":"u1","username":"frieren","display_name":"Frieren","avatar_url":"https://img/a.png"}]""");
        var service = new ProfileService(http.Client(), await LoggedIn(http));

        var p = await service.GetMineAsync();

        Assert.Equal(new Profile.Profile("u1", "frieren", "Frieren", "https://img/a.png"), p);
        Assert.Equal($"{Config.SupabaseUrl}/rest/v1/profiles?select=user_id,username,display_name,avatar_url&user_id=eq.u1",
            http.Requests.Single().Request.RequestUri!.ToString());
        Assert.Equal("Bearer TOKEN", http.Requests.Single().Request.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task GetMine_NoProfile_ReturnsNull()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, "[]");
        var service = new ProfileService(http.Client(), await LoggedIn(http));
        Assert.Null(await service.GetMineAsync());
    }

    [Fact]
    public void Stats_CountsByStatusAndEpisodes()
    {
        ListEntryView E(ListStatus s, int progress, string type = "ANIME") => new(1, "x", null, s, progress, null, 0, false, type, 0);
        var stats = ListStats.From([
            E(ListStatus.WATCHING, 3), E(ListStatus.WATCHING, 10), E(ListStatus.COMPLETED, 12),
            E(ListStatus.PLANNING, 0), E(ListStatus.DROPPED, 2), E(ListStatus.WATCHING, 40, "MANGA")]);

        Assert.Equal(3, stats.Count(ListStatus.WATCHING));
        Assert.Equal(1, stats.Count(ListStatus.COMPLETED));
        Assert.Equal(0, stats.Count(ListStatus.PAUSED));
        Assert.Equal(6, stats.Total);
        Assert.Equal(27, stats.EpisodesWatched);   // só anime: 3 + 10 + 12 + 2
        Assert.Equal(40, stats.ChaptersRead);      // só mangá
    }
    [Fact]
    public async Task Public_ReadsSnapshotByUsername()
    {
        var row = """
        [{"user_id":"u9","username":"himmel","display_name":"Himmel","avatar_url":null,"is_public":true,
          "snapshot":{"v":1,"rank":{"name":"Herói","jp":"勇者"},
            "stats":{"total":3,"completed":2,"eps":40,"hours":16.5,"mean":8.5,"chapters":12},
            "entries":[{"id":1,"t":"Frieren","te":"Frieren EN","c":"f.jpg","s":"COMPLETED","sc":10,"p":28,"f":true},
                       {"id":2,"t":"Berserk","c":"b.jpg","s":"WATCHING","sc":0,"p":12,"ty":"M"},
                       {"id":3,"t":"Dan Da Dan","c":"d.jpg","s":"COMPLETED","sc":8,"p":12}]}}]
        """;
        var http = new FakeHandler().Respond(HttpStatusCode.OK, row);
        var service = new ProfileService(http.Client(), await LoggedIn(http));

        var p = await service.GetPublicAsync("Himmel ");

        Assert.Equal($"{Config.SupabaseUrl}/rest/v1/profiles?select=user_id,username,display_name,avatar_url,snapshot&username=eq.himmel",
            http.Requests.Single().Request.RequestUri!.ToString());
        Assert.NotNull(p);
        Assert.Equal("Himmel", p!.Profile.Name);
        Assert.Equal("Herói", p.Rank);
        Assert.Equal(2, p.Completed);
        Assert.Equal(40, p.Episodes);
        Assert.Equal(16.5, p.Hours);
        Assert.Equal(8.5, p.MeanScore);
        Assert.Equal([1], p.Favorites.Select(e => e.MediaId));
        Assert.Equal("Frieren EN", p.Favorites[0].Title);
        Assert.Equal([1, 3], p.TopCompleted.Select(e => e.MediaId)); // completos, melhor nota primeiro
        Assert.Equal("MANGA", p.Watching.Single().Type);
    }

    [Fact]
    public async Task Public_UnknownUser_ReturnsNull()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, "[]");
        var service = new ProfileService(http.Client(), await LoggedIn(http));
        Assert.Null(await service.GetPublicAsync("ninguem"));
    }
}
