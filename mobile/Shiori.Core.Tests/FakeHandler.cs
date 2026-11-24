using System.Net;
using System.Text;

namespace Shiori.Core.Tests;

/// <summary>Servidor falso: devolve respostas na ordem e guarda as requisições recebidas.</summary>
public sealed class FakeHandler : HttpMessageHandler
{
    private readonly Queue<Func<HttpRequestMessage, HttpResponseMessage>> _responses = new();
    public List<(HttpRequestMessage Request, string? Body)> Requests { get; } = new();

    public FakeHandler Respond(HttpStatusCode status, string json)
    {
        _responses.Enqueue(_ => new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        return this;
    }

    public FakeHandler Fail(Exception error)
    {
        _responses.Enqueue(_ => throw error);
        return this;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
        Requests.Add((request, body));
        if (_responses.Count == 0) throw new InvalidOperationException($"Requisição inesperada: {request.Method} {request.RequestUri}");
        return _responses.Dequeue()(request);
    }

    public HttpClient Client() => new(this);
}

public sealed class MemoryStore : Shiori.Core.Auth.ISessionStore
{
    public string? Json { get; set; }
    public Task<string?> LoadAsync() => Task.FromResult(Json);
    public Task SaveAsync(string json) { Json = json; return Task.CompletedTask; }
    public Task ClearAsync() { Json = null; return Task.CompletedTask; }
}

public static class Sessions
{
    public static string Json(string access = "AT", string refresh = "RT", long expiresAt = 4_000_000_000, string userId = "u1", string email = "eu@shiori.app") =>
        $$$"""{"access_token":"{{{access}}}","token_type":"bearer","expires_in":3600,"expires_at":{{{expiresAt}}},"refresh_token":"{{{refresh}}}","user":{"id":"{{{userId}}}","email":"{{{email}}}"}}""";
}
