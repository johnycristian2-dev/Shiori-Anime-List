using System.Net;
using Shiori.Core.Auth;

namespace Shiori.Core.Tests;

public class AuthServiceTests
{
    private static long Now => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    [Fact]
    public async Task SignIn_PostsPasswordGrant()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.OK, Sessions.Json());
        var store = new MemoryStore();
        var auth = new AuthService(http.Client(), store);

        var session = await auth.SignInAsync(" eu@shiori.app ", "segredo");

        var (req, body) = http.Requests.Single();
        Assert.Equal(HttpMethod.Post, req.Method);
        Assert.Equal($"{Config.SupabaseUrl}/auth/v1/token?grant_type=password", req.RequestUri!.ToString());
        Assert.Equal(Config.SupabaseKey, req.Headers.GetValues("apikey").Single());
        Assert.Contains("\"email\":\"eu@shiori.app\"", body);
        Assert.Equal("AT", session.AccessToken);
        Assert.Equal("u1", session.UserId);
        Assert.Equal(session.RawJson, store.Json);
        Assert.Same(session, auth.Current);
    }

    [Fact]
    public async Task SignIn_InvalidCredentials_Throws()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.BadRequest, """{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}""");
        var auth = new AuthService(http.Client(), new MemoryStore());

        var ex = await Assert.ThrowsAsync<ShioriException>(() => auth.SignInAsync("a@b.c", "x"));
        Assert.Equal("E-mail ou senha incorretos.", ex.Message);
    }

    [Fact]
    public async Task SignIn_EmailNotConfirmed_Throws()
    {
        var http = new FakeHandler().Respond(HttpStatusCode.BadRequest, """{"error_code":"email_not_confirmed","msg":"Email not confirmed"}""");
        var auth = new AuthService(http.Client(), new MemoryStore());

        var ex = await Assert.ThrowsAsync<ShioriException>(() => auth.SignInAsync("a@b.c", "x"));
        Assert.Equal("Confirme seu e-mail antes de entrar.", ex.Message);
    }

    [Fact]
    public async Task SignIn_NoNetwork_FriendlyMessage()
    {
        var http = new FakeHandler().Fail(new HttpRequestException("offline"));
        var auth = new AuthService(http.Client(), new MemoryStore());

        var ex = await Assert.ThrowsAsync<ShioriException>(() => auth.SignInAsync("a@b.c", "x"));
        Assert.Equal("Sem conexão. Toque para tentar de novo.", ex.Message);
    }

    [Fact]
    public async Task ExpiredSession_Refreshes()
    {
        var store = new MemoryStore { Json = Sessions.Json(access: "OLD", refresh: "R1", expiresAt: Now - 10) };
        var http = new FakeHandler().Respond(HttpStatusCode.OK, Sessions.Json(access: "NEW", refresh: "R2", expiresAt: Now + 3600));
        var auth = new AuthService(http.Client(), store);
        await auth.RestoreAsync();

        var session = await auth.GetValidSessionAsync();

        var (req, body) = http.Requests.Single();
        Assert.EndsWith("/auth/v1/token?grant_type=refresh_token", req.RequestUri!.ToString());
        Assert.Contains("\"refresh_token\":\"R1\"", body);
        Assert.Equal("NEW", session.AccessToken);
        Assert.Contains("\"R2\"", store.Json);
    }

    [Fact]
    public async Task ValidSession_DoesNotRefresh()
    {
        var store = new MemoryStore { Json = Sessions.Json(expiresAt: Now + 3600) };
        var http = new FakeHandler();
        var auth = new AuthService(http.Client(), store);
        await auth.RestoreAsync();

        var session = await auth.GetValidSessionAsync();

        Assert.Empty(http.Requests);
        Assert.Equal("AT", session.AccessToken);
    }

    [Fact]
    public async Task RefreshFailure_ClearsSession()
    {
        var store = new MemoryStore { Json = Sessions.Json(expiresAt: Now - 10) };
        var http = new FakeHandler().Respond(HttpStatusCode.BadRequest, """{"error_code":"refresh_token_not_found","msg":"Invalid Refresh Token"}""");
        var auth = new AuthService(http.Client(), store);
        await auth.RestoreAsync();
        var signedOut = false;
        auth.SignedOut += () => signedOut = true;

        var ex = await Assert.ThrowsAsync<ShioriException>(() => auth.GetValidSessionAsync());

        Assert.Equal("Sua sessão expirou. Entre de novo.", ex.Message);
        Assert.Null(store.Json);
        Assert.Null(auth.Current);
        Assert.True(signedOut);
    }

    [Fact]
    public async Task NoSession_GetValid_Throws()
    {
        var auth = new AuthService(new FakeHandler().Client(), new MemoryStore());
        Assert.Null(await auth.RestoreAsync());
        await Assert.ThrowsAsync<ShioriException>(() => auth.GetValidSessionAsync());
    }

    [Fact]
    public async Task PicksNewestSession()
    {
        var store = new MemoryStore { Json = Sessions.Json(access: "APP", expiresAt: 1000) };
        var auth = new AuthService(new FakeHandler().Client(), store);
        await auth.RestoreAsync();

        await auth.AdoptIfNewerAsync(Sessions.Json(access: "OLDER", expiresAt: 500));
        Assert.Equal("APP", auth.Current!.AccessToken);

        await auth.AdoptIfNewerAsync(null);
        await auth.AdoptIfNewerAsync("não é json");
        await auth.AdoptIfNewerAsync(Sessions.Json(access: "OTHER", expiresAt: 2000, userId: "outro"));
        Assert.Equal("APP", auth.Current!.AccessToken);

        await auth.AdoptIfNewerAsync(Sessions.Json(access: "WEB", expiresAt: 2000));
        Assert.Equal("WEB", auth.Current!.AccessToken);
        Assert.Contains("\"WEB\"", store.Json);
    }

    [Fact]
    public async Task SignOut_ClearsAndNotifies()
    {
        var store = new MemoryStore { Json = Sessions.Json() };
        var http = new FakeHandler().Respond(HttpStatusCode.NoContent, "");
        var auth = new AuthService(http.Client(), store);
        await auth.RestoreAsync();
        var signedOut = false;
        auth.SignedOut += () => signedOut = true;

        await auth.SignOutAsync();

        Assert.EndsWith("/auth/v1/logout", http.Requests.Single().Request.RequestUri!.ToString());
        Assert.Null(store.Json);
        Assert.Null(auth.Current);
        Assert.True(signedOut);
    }
}
