using System.Net;
using System.Text.Json.Nodes;
using Shiori.Core.Auth;
using Shiori.Core.List;

namespace Shiori.Core.Tests;

public class ListServiceTests
{
    private static async Task<AuthService> LoggedIn(FakeHandler http)
    {
        var auth = new AuthService(http.Client(), new MemoryStore { Json = Sessions.Json(access: "TOKEN", userId: "u1") });
        await auth.RestoreAsync();
        return auth;
    }

    [Fact]
    public async Task Load_ReadsUserDataWithToken()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, """[{"doc":{"entries":{"5":{"mediaId":5,"title":"A","status":"WATCHING","progress":1,"score":0,"updatedAt":1}}}}]""");
        var service = new ListService(http.Client(), await LoggedIn(http));

        var doc = await service.LoadAsync();

        var (req, _) = http.Requests.Single();
        Assert.Equal($"{Config.SupabaseUrl}/rest/v1/user_data?select=doc&user_id=eq.u1", req.RequestUri!.ToString());
        Assert.Equal("Bearer TOKEN", req.Headers.Authorization!.ToString());
        Assert.Equal(Config.SupabaseKey, req.Headers.GetValues("apikey").Single());
        Assert.Equal("A", doc.Get(5)!.Title);
    }

    [Fact]
    public async Task Load_NoRow_EmptyDoc()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, "[]");
        var service = new ListService(http.Client(), await LoggedIn(http));
        Assert.Empty((await service.LoadAsync()).Entries);
    }

    [Fact]
    public async Task Update_RefetchesBeforeWrite()
    {
        // No servidor já existe a entrada A, feita no site depois que o app abriu.
        var http = new FakeHandler()
            .Respond(HttpStatusCode.OK, """[{"doc":{"entries":{"1":{"mediaId":1,"title":"A","status":"WATCHING","progress":3,"score":0,"updatedAt":9}},"lists":{"x":{"id":"x"}}}}]""")
            .Respond(HttpStatusCode.Created, "");
        var service = new ListService(http.Client(), await LoggedIn(http));

        var result = await service.UpdateAsync(d => d.Upsert(new(2, null, "B", null, null, null, null, null, 12, null, null, null, null, [], null, "ANIME"), ListStatus.PLANNING, 100));

        Assert.Equal(2, http.Requests.Count);
        var (post, body) = http.Requests[1];
        Assert.Equal(HttpMethod.Post, post.Method);
        Assert.Equal($"{Config.SupabaseUrl}/rest/v1/user_data", post.RequestUri!.ToString());
        Assert.Contains("resolution=merge-duplicates", post.Headers.GetValues("Prefer").Single());
        var sent = JsonNode.Parse(body!)!;
        Assert.Equal("u1", (string)sent["user_id"]!);
        Assert.Equal("app", (string)sent["device"]!);
        Assert.NotNull(sent["updated_at"]);
        Assert.NotNull(sent["doc"]!["entries"]!["1"]);
        Assert.NotNull(sent["doc"]!["entries"]!["2"]);
        Assert.NotNull(sent["doc"]!["lists"]!["x"]);
        Assert.NotNull(result.Get(1));
        Assert.NotNull(result.Get(2));
    }

    [Fact]
    public async Task Update_ServerError_Throws()
    {
        var http = new FakeHandler()
            .Respond(HttpStatusCode.OK, "[]")
            .Respond(HttpStatusCode.Forbidden, """{"message":"new row violates row-level security policy"}""");
        var service = new ListService(http.Client(), await LoggedIn(http));

        var ex = await Assert.ThrowsAsync<ShioriException>(() => service.UpdateAsync(d => { }));
        Assert.Equal("Não foi possível salvar sua lista. Tente de novo.", ex.Message);
    }

    [Fact]
    public async Task Load_NoNetwork_FriendlyMessage()
    {
        var http = new FakeHandler().Fail(new HttpRequestException("offline"));
        var service = new ListService(http.Client(), await LoggedIn(http));
        var ex = await Assert.ThrowsAsync<ShioriException>(() => service.LoadAsync());
        Assert.Equal(ShioriException.NoConnection, ex.Message);
    }
}
