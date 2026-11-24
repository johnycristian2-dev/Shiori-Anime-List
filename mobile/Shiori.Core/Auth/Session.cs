using System.Text.Json.Nodes;

namespace Shiori.Core.Auth;

/// <summary>
/// Sessão do usuário no Supabase Auth.
/// <see cref="RawJson"/> é exatamente o que o Supabase devolveu: é o mesmo formato que o
/// site (supabase-js) guarda no localStorage, por isso dá para passar a sessão para a parte web.
/// </summary>
public sealed record Session(string AccessToken, string RefreshToken, long ExpiresAt, string UserId, string? Email, string RawJson)
{
    /// <summary>Lê a resposta do Supabase. Lança <see cref="FormatException"/> se faltar algo.</summary>
    public static Session Parse(string json)
    {
        JsonNode? node;
        try { node = JsonNode.Parse(json); }
        catch (Exception e) { throw new FormatException("Sessão inválida.", e); }

        var access = (string?)node?["access_token"];
        var refresh = (string?)node?["refresh_token"];
        var userId = (string?)node?["user"]?["id"];
        if (access is null || refresh is null || userId is null) throw new FormatException("Sessão incompleta.");

        // expires_at (segundos Unix). Versões antigas só mandam expires_in: calcula a partir de agora.
        var expiresAt = (long?)node!["expires_at"]
            ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds() + ((long?)node["expires_in"] ?? 3600);
        if (node["expires_at"] is null) node["expires_at"] = expiresAt;

        return new Session(access, refresh, expiresAt, userId, (string?)node["user"]?["email"], node.ToJsonString());
    }

    /// <summary>true se o token vence em menos de <paramref name="margin"/>.</summary>
    public bool ExpiresSoon(TimeSpan margin) =>
        DateTimeOffset.FromUnixTimeSeconds(ExpiresAt) - DateTimeOffset.UtcNow < margin;
}
