using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Shiori.Core.AniList;

/// <summary>
/// Cliente da API GraphQL do AniList. Toda chamada é um POST com
/// <c>{ "query": "...", "variables": { ... } }</c> e a resposta vem em <c>{ "data": ... }</c>.
/// Não precisa de login: os dados de animes são públicos.
/// </summary>
public sealed partial class AniListClient(HttpClient http)
{
    private static readonly string[] Seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];

    public async Task<IReadOnlyList<MediaSummary>> TrendingAsync(string type = "ANIME") =>
        ParsePage(await QueryAsync(Queries.Trending, new JsonObject { ["type"] = type }));

    public async Task<IReadOnlyList<MediaSummary>> SeasonAsync(int year, string season) =>
        ParsePage(await QueryAsync(Queries.Season, new JsonObject { ["season"] = season, ["year"] = year }));

    public async Task<IReadOnlyList<MediaSummary>> SearchAsync(string text, string type) =>
        ParsePage(await QueryAsync(Queries.Search, new JsonObject { ["search"] = text.Trim(), ["type"] = type }));

    public async Task<MediaDetail> DetailAsync(int id)
    {
        var data = await QueryAsync(Queries.Detail, new JsonObject { ["id"] = id });
        var m = data["Media"] as JsonObject ?? throw new ShioriException("Não encontrei esse título no AniList.");
        var next = m["nextAiringEpisode"];
        return new MediaDetail(
            ParseMedia(m),
            (string?)m["bannerImage"],
            CleanDescription((string?)m["description"]),
            (string?)m["status"],
            (string?)m["season"],
            m["studios"]?["nodes"]?.AsArray().Select(n => (string?)n?["name"]).OfType<string>().ToArray() ?? [],
            m["characters"]?["edges"]?.AsArray()
                .Select(e => e?["node"])
                .Where(n => n is not null)
                .Select(n => new CharacterSummary((int)n!["id"]!, (string?)n["name"]?["full"] ?? "?", (string?)n["image"]?["large"]))
                .ToArray() ?? [],
            (long?)next?["airingAt"] is { } at ? DateTimeOffset.FromUnixTimeSeconds(at) : null,
            (int?)next?["episode"],
            m["studios"]?["nodes"]?.AsArray().OfType<JsonObject>()
                .Where(n => (int?)n["id"] is not null)
                .Select(n => new PersonSummary((int)n["id"]!, (string?)n["name"] ?? "?", null)).ToList() ?? []);
    }

    /// <summary>Temporada atual (mesma regra do site: jan–mar inverno, abr–jun primavera…).</summary>
    public static (int Year, string Season) CurrentSeason(DateTime date) => (date.Year, Seasons[(date.Month - 1) / 3]);

    // ------------------------------------------------------------------

    private async Task<JsonNode> QueryAsync(string query, JsonObject variables)
    {
        HttpResponseMessage res;
        try { res = await http.PostAsync(Config.AniListUrl, JsonContent.Create(new JsonObject { ["query"] = query, ["variables"] = variables })); }
        catch (HttpRequestException e) { throw new ShioriException(ShioriException.NoConnection, e); }
        catch (TaskCanceledException e) { throw new ShioriException(ShioriException.NoConnection, e); }

        using (res)
        {
            if (res.StatusCode == HttpStatusCode.TooManyRequests)
                throw new ShioriException("O AniList pediu uma pausa. Tente em alguns segundos.");
            if (res.StatusCode == HttpStatusCode.NotFound)
                throw new ShioriException("Não encontrei esse título no AniList.");
            if (!res.IsSuccessStatusCode) throw new ShioriException(ShioriException.NoConnection);

            var body = JsonNode.Parse(await res.Content.ReadAsStringAsync());
            var data = body?["data"];
            if (data is null || body?["errors"] is JsonArray { Count: > 0 } && data is JsonObject o && o.All(kv => kv.Value is null))
                throw new ShioriException("Não encontrei esse título no AniList.");
            return data;
        }
    }

    private static IReadOnlyList<MediaSummary> ParsePage(JsonNode data) =>
        data["Page"]?["media"]?.AsArray().OfType<JsonObject>().Select(ParseMedia).ToList() ?? [];

    private static MediaSummary ParseMedia(JsonObject m) => new(
        (int)m["id"]!,
        (int?)m["idMal"],
        (string?)m["title"]?["romaji"] ?? (string?)m["title"]?["english"] ?? (string?)m["title"]?["native"] ?? "???",
        (string?)m["title"]?["english"],
        (string?)m["title"]?["native"],
        (string?)m["coverImage"]?["extraLarge"] ?? (string?)m["coverImage"]?["large"],
        (string?)m["coverImage"]?["color"],
        (string?)m["format"],
        (int?)m["episodes"],
        (int?)m["chapters"],
        (int?)m["volumes"],
        (string?)m["countryOfOrigin"],
        (int?)m["seasonYear"],
        m["genres"]?.AsArray().Select(g => (string?)g).OfType<string>().ToArray() ?? [],
        (int?)m["averageScore"],
        (string?)m["type"] ?? "ANIME");

    /// <summary>A sinopse vem com HTML simples: &lt;br&gt; vira quebra de linha e o resto das tags sai.</summary>
    private static string? CleanDescription(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var text = BreakTag().Replace(html, "\n");
        text = AnyTag().Replace(text, "");
        text = ManyBreaks().Replace(text.Replace("\r", ""), "\n\n"); // no máximo uma linha em branco
        return WebUtility.HtmlDecode(text).Trim();
    }

    [GeneratedRegex(@"<br\s*/?>", RegexOptions.IgnoreCase)]
    private static partial Regex BreakTag();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex AnyTag();

    [GeneratedRegex(@"\n[ \t]*\n(?:[ \t]*\n)*")]
    private static partial Regex ManyBreaks();
}
