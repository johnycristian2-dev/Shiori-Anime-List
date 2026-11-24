using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Shiori.Core.Auth;

/// <summary>
/// Login com e-mail e senha no Supabase Auth (GoTrue), usando HTTP puro:
///   POST /auth/v1/token?grant_type=password       → entrar
///   POST /auth/v1/token?grant_type=refresh_token  → renovar o token (vale ~1 h)
///   POST /auth/v1/logout                          → sair
/// O token de acesso vai no cabeçalho Authorization das outras chamadas (lista, perfil).
/// </summary>
public sealed class AuthService(HttpClient http, ISessionStore store)
{
    private static readonly TimeSpan RefreshMargin = TimeSpan.FromSeconds(60);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    /// <summary>Sessão atual (null = deslogado).</summary>
    public Session? Current { get; private set; }

    /// <summary>Disparado quando a sessão acaba (sair ou token recusado): o app volta ao Login.</summary>
    public event Action? SignedOut;

    /// <summary>Lê a sessão guardada no aparelho (ao abrir o app).</summary>
    public async Task<Session?> RestoreAsync()
    {
        var json = await store.LoadAsync();
        if (json is null) return Current = null;
        try { return Current = Session.Parse(json); }
        catch (FormatException)
        {
            await store.ClearAsync();
            return Current = null;
        }
    }

    public async Task<Session> SignInAsync(string email, string password)
    {
        var session = await RequestTokenAsync("password", new JsonObject { ["email"] = email.Trim(), ["password"] = password });
        await SetAsync(session);
        return session;
    }

    /// <summary>Sessão com token válido, renovando antes se estiver para vencer.</summary>
    public async Task<Session> GetValidSessionAsync()
    {
        var current = Current ?? throw new ShioriException("Entre na sua conta para continuar.");
        if (!current.ExpiresSoon(RefreshMargin)) return current;

        await _refreshLock.WaitAsync();
        try
        {
            // outra chamada pode ter renovado enquanto esperávamos
            if (Current is { } fresh && !fresh.ExpiresSoon(RefreshMargin)) return fresh;
            Session renewed;
            try
            {
                renewed = await RequestTokenAsync("refresh_token", new JsonObject { ["refresh_token"] = current.RefreshToken });
            }
            catch (ShioriException e) when (e.Message != ShioriException.NoConnection)
            {
                // refresh token recusado (expirou ou foi trocado em outro lugar): sessão acabou
                await ClearAsync();
                throw new ShioriException("Sua sessão expirou. Entre de novo.", e);
            }
            await SetAsync(renewed);
            return renewed;
        }
        finally { _refreshLock.Release(); }
    }

    /// <summary>
    /// A parte web também renova o token, e o Supabase troca o refresh token a cada renovação.
    /// Ao sair da parte web, o app adota a sessão de lá se for do mesmo usuário e mais nova.
    /// </summary>
    public async Task AdoptIfNewerAsync(string? webJson)
    {
        if (string.IsNullOrWhiteSpace(webJson) || Current is null) return;
        Session web;
        try { web = Session.Parse(webJson); }
        catch (FormatException) { return; }
        if (web.UserId != Current.UserId || web.ExpiresAt <= Current.ExpiresAt) return;
        await SetAsync(web);
    }

    public async Task SignOutAsync()
    {
        if (Current is { } session)
        {
            try
            {
                using var req = NewRequest(HttpMethod.Post, "/auth/v1/logout");
                req.Headers.Authorization = new("Bearer", session.AccessToken);
                using var _ = await http.SendAsync(req);
            }
            catch (HttpRequestException) { /* sem internet: sai do mesmo jeito */ }
        }
        await ClearAsync();
    }

    // ------------------------------------------------------------------

    private async Task<Session> RequestTokenAsync(string grant, JsonObject body)
    {
        using var req = NewRequest(HttpMethod.Post, $"/auth/v1/token?grant_type={grant}");
        req.Content = JsonContent.Create(body);
        HttpResponseMessage res;
        try { res = await http.SendAsync(req); }
        catch (HttpRequestException e) { throw new ShioriException(ShioriException.NoConnection, e); }
        catch (TaskCanceledException e) { throw new ShioriException(ShioriException.NoConnection, e); }

        using (res)
        {
            var text = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) throw new ShioriException(FriendlyError(text));
            try { return Session.Parse(text); }
            catch (FormatException e) { throw new ShioriException("Resposta inesperada do servidor.", e); }
        }
    }

    /// <summary>Mesmas mensagens que o site mostra.</summary>
    private static string FriendlyError(string body)
    {
        string? code = null, msg = null;
        try
        {
            var node = JsonNode.Parse(body);
            code = (string?)node?["error_code"] ?? (string?)node?["error"];
            msg = (string?)node?["msg"] ?? (string?)node?["error_description"] ?? (string?)node?["message"];
        }
        catch { /* corpo não é JSON */ }

        if (code == "invalid_credentials" || msg?.Contains("Invalid login", StringComparison.OrdinalIgnoreCase) == true)
            return "E-mail ou senha incorretos.";
        if (code == "email_not_confirmed" || msg?.Contains("Email not confirmed", StringComparison.OrdinalIgnoreCase) == true)
            return "Confirme seu e-mail antes de entrar.";
        if (code == "captcha_failed" || msg?.Contains("captcha", StringComparison.OrdinalIgnoreCase) == true)
            return "O login pelo app está bloqueado pelo anti-robô. Entre pelo site.";
        if (code == "over_request_rate_limit")
            return "Muitas tentativas. Espere um pouco e tente de novo.";
        return msg ?? "Algo deu errado.";
    }

    private static HttpRequestMessage NewRequest(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, Config.SupabaseUrl + path);
        req.Headers.Add("apikey", Config.SupabaseKey);
        return req;
    }

    private async Task SetAsync(Session session)
    {
        Current = session;
        await store.SaveAsync(session.RawJson);
    }

    private async Task ClearAsync()
    {
        Current = null;
        await store.ClearAsync();
        SignedOut?.Invoke();
    }
}
