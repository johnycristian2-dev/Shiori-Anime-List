using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Shiori.Core.Auth;
using Shiori.Core.List;
using Shiori.Core.Supabase;

namespace Shiori.Core.Profile;

/// <summary>Perfil público do usuário (tabela <c>profiles</c>; a chave é a coluna <c>user_id</c>).</summary>
public sealed record Profile(string UserId, string Username, string? DisplayName, string? AvatarUrl)
{
    public string Name => string.IsNullOrWhiteSpace(DisplayName) ? Username : DisplayName;
}

/// <summary>
/// Perfil público de outra pessoa (/u/apelido). Vem do "snapshot" que o site publica na tabela profiles:
/// um resumo da lista (rank, números e itens), para não precisar ler a lista privada de ninguém.
/// </summary>
public sealed record PublicProfile(
    Profile Profile, string? Rank, int Total, int Completed, int Episodes, double Hours, double MeanScore, int Chapters,
    IReadOnlyList<ListEntryView> Favorites, IReadOnlyList<ListEntryView> Watching, IReadOnlyList<ListEntryView> TopCompleted);

public sealed partial class ProfileService(HttpClient http, AuthService auth)
{
    private readonly SupabaseRest _rest = new(http, auth);

    /// <summary>Meu perfil, ou null se ainda não criei um no site.</summary>
    public async Task<Profile?> GetMineAsync()
    {
        var userId = await _rest.UserIdAsync();
        var rows = await _rest.SelectAsync("profiles", $"select=user_id,username,display_name,avatar_url&user_id=eq.{userId}");
        var row = rows.FirstOrDefault();
        if (row is null) return null;
        return new Profile(
            (string)row["user_id"]!,
            (string?)row["username"] ?? "",
            (string?)row["display_name"],
            (string?)row["avatar_url"]);
    }

    /// <summary>Perfil público pelo apelido, ou null se não existir (ou for privado).</summary>
    public async Task<PublicProfile?> GetPublicAsync(string username)
    {
        var name = username.Trim().ToLowerInvariant();
        if (!UsernamePattern().IsMatch(name)) return null; // mesma regra do site; evita montar URL com lixo
        var rows = await _rest.SelectAsync("profiles", $"select=user_id,username,display_name,avatar_url,snapshot&username=eq.{name}");
        if (rows.FirstOrDefault() is not JsonObject row) return null;

        var profile = new Profile((string)row["user_id"]!, (string?)row["username"] ?? name, (string?)row["display_name"], (string?)row["avatar_url"]);
        var snap = row["snapshot"];
        var stats = snap?["stats"];
        var entries = snap?["entries"]?.AsArray().OfType<JsonObject>().Select(SnapEntry).OfType<ListEntryView>().ToList() ?? [];

        return new PublicProfile(
            profile,
            (string?)snap?["rank"]?["name"],
            Num(stats?["total"]) is { } t ? (int)t : entries.Count,
            (int)(Num(stats?["completed"]) ?? 0),
            (int)(Num(stats?["eps"]) ?? 0),
            Num(stats?["hours"]) ?? 0,
            Num(stats?["mean"]) ?? 0,
            (int)(Num(stats?["chapters"]) ?? 0),
            entries.Where(e => e.Favorite).ToList(),
            entries.Where(e => e.Status == ListStatus.WATCHING).OrderByDescending(e => e.UpdatedAt).ToList(),
            entries.Where(e => e.Status == ListStatus.COMPLETED).OrderByDescending(e => e.Score).ToList());
    }

    /// <summary>Uma entrada do snapshot (nomes curtos: t = título, c = capa, s = status, sc = nota, p = progresso…).</summary>
    private static ListEntryView? SnapEntry(JsonObject e)
    {
        if (Num(e["id"]) is not { } id) return null;
        var manga = (string?)e["ty"] == "M";
        return new ListEntryView(
            (int)id,
            (string?)e["te"] ?? (string?)e["t"] ?? "???",
            (string?)e["c"],
            Enum.TryParse<ListStatus>((string?)e["s"], out var s) ? s : ListStatus.PLANNING,
            (int)(Num(e["p"]) ?? 0),
            (int?)(manga ? Num(e["ch"]) : Num(e["ep"])),
            (int)Math.Round(Num(e["sc"]) ?? 0),
            (bool?)e["f"] ?? false,
            manga ? "MANGA" : "ANIME",
            0);
    }

    private static double? Num(JsonNode? n) =>
        n is JsonValue v && (v.TryGetValue<double>(out var d) || (v.TryGetValue<int>(out var i) && (d = i) == i)) ? d : null;

    [GeneratedRegex("^[a-z0-9_]{3,20}$")]
    private static partial Regex UsernamePattern();
}
