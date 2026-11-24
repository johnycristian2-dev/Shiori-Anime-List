using System.Text.Json.Nodes;

namespace Shiori.Core.AniList;

/// <summary>Consultas das telas Personagem, Dublador, Estúdio, Calendário, Explorar e Pra você.</summary>
public sealed partial class AniListClient
{
    /// <summary>Limite de páginas do calendário (50 episódios cada) para não estourar o limite do AniList.</summary>
    private const int MaxAiringPages = 8;

    public async Task<CharacterDetail> CharacterAsync(int id)
    {
        var data = await QueryAsync(Queries.Character, new JsonObject { ["id"] = id });
        var c = data["Character"] as JsonObject ?? throw new ShioriException("Não encontrei esse personagem no AniList.");
        var birth = c["dateOfBirth"];
        return new CharacterDetail(
            (int)c["id"]!,
            (string?)c["name"]?["full"] ?? "?",
            (string?)c["name"]?["native"],
            c["name"]?["alternative"]?.AsArray().Select(n => (string?)n).OfType<string>().Where(n => n.Length > 0).ToArray() ?? [],
            (string?)c["image"]?["large"],
            CleanDescription((string?)c["description"]),
            (string?)c["gender"],
            (string?)c["age"],
            (int?)birth?["day"] is { } d && (int?)birth?["month"] is { } m ? $"{d}/{m}" : null,
            (int?)c["favourites"],
            c["media"]?["edges"]?.AsArray().OfType<JsonObject>()
                .Where(e => e["node"] is JsonObject)
                .Select(e => new CharacterAppearance(
                    RoleLabel((string?)e["characterRole"]),
                    ParseMedia((JsonObject)e["node"]!),
                    e["voiceActors"]?.AsArray().OfType<JsonObject>().Select(ParsePerson).FirstOrDefault()))
                .ToList() ?? []);
    }

    public async Task<StaffDetail> StaffAsync(int id, int page = 1)
    {
        var data = await QueryAsync(Queries.Staff, new JsonObject { ["id"] = id, ["page"] = page });
        var s = data["Staff"] as JsonObject ?? throw new ShioriException("Não encontrei essa pessoa no AniList.");
        var media = s["characterMedia"];
        return new StaffDetail(
            (int)s["id"]!,
            (string?)s["name"]?["full"] ?? "?",
            (string?)s["name"]?["native"],
            (string?)s["image"]?["large"],
            CleanDescription((string?)s["description"]),
            (string?)s["homeTown"],
            (int?)s["favourites"],
            media?["edges"]?.AsArray().OfType<JsonObject>()
                .Where(e => e["node"] is JsonObject)
                .Select(e => new StaffRole(
                    RoleLabel((string?)e["characterRole"]),
                    ParseMedia((JsonObject)e["node"]!),
                    e["characters"]?.AsArray().OfType<JsonObject>().Select(ParsePerson).FirstOrDefault()))
                .ToList() ?? [],
            (bool?)media?["pageInfo"]?["hasNextPage"] ?? false);
    }

    public async Task<StudioDetail> StudioAsync(int id, int page = 1)
    {
        var data = await QueryAsync(Queries.Studio, new JsonObject { ["id"] = id, ["page"] = page });
        var s = data["Studio"] as JsonObject ?? throw new ShioriException("Não encontrei esse estúdio no AniList.");
        return new StudioDetail(
            (int)s["id"]!,
            (string?)s["name"] ?? "?",
            s["media"]?["nodes"]?.AsArray().OfType<JsonObject>().Select(ParseMedia).ToList() ?? [],
            (bool?)s["media"]?["pageInfo"]?["hasNextPage"] ?? false);
    }

    /// <summary>Episódios que vão ao ar entre <paramref name="from"/> e <paramref name="to"/> (sem conteúdo adulto).</summary>
    public async Task<IReadOnlyList<AiringItem>> AiringAsync(DateTimeOffset from, DateTimeOffset to)
    {
        var result = new List<AiringItem>();
        for (var page = 1; page <= MaxAiringPages; page++)
        {
            var data = await QueryAsync(Queries.Airing, new JsonObject
            {
                ["page"] = page,
                ["from"] = from.ToUnixTimeSeconds(),
                ["to"] = to.ToUnixTimeSeconds(),
            });
            foreach (var a in data["Page"]?["airingSchedules"]?.AsArray().OfType<JsonObject>() ?? [])
            {
                if (a["media"] is not JsonObject m || (bool?)m["isAdult"] == true) continue;
                result.Add(new AiringItem((int?)a["episode"] ?? 0, DateTimeOffset.FromUnixTimeSeconds((long?)a["airingAt"] ?? 0), ParseMedia(m)));
            }
            if ((bool?)data["Page"]?["pageInfo"]?["hasNextPage"] != true) break;
        }
        return result;
    }

    /// <summary>Busca com filtros (tela Explorar e baralho do Swipe).</summary>
    public async Task<PageResult<MediaSummary>> BrowseAsync(BrowseFilter filter, int page = 1)
    {
        var vars = new JsonObject
        {
            ["page"] = page,
            ["type"] = filter.Type,
            ["sort"] = new JsonArray(filter.Sort),
        };
        if (filter.Genre is { Length: > 0 } g) vars["genres"] = new JsonArray(g);
        if (filter.Season is { Length: > 0 } s) vars["season"] = s;
        if (filter.Year is { } y) vars["seasonYear"] = y;
        if (filter.Format is { Length: > 0 } f) vars["formats"] = new JsonArray(f);
        if (filter.Country is { Length: > 0 } c) vars["country"] = c;
        if (filter.Search is { Length: > 0 } q) vars["search"] = q.Trim();

        var data = await QueryAsync(Queries.Browse, vars);
        return new PageResult<MediaSummary>(ParsePage(data), (bool?)data["Page"]?["pageInfo"]?["hasNextPage"] ?? false);
    }

    /// <summary>Gêneros do AniList (sem o adulto).</summary>
    public async Task<IReadOnlyList<string>> GenresAsync()
    {
        var data = await QueryAsync(Queries.Genres, new JsonObject());
        return data["GenreCollection"]?.AsArray().Select(g => (string?)g).OfType<string>()
            .Where(g => !string.Equals(g, "Hentai", StringComparison.OrdinalIgnoreCase)).ToList() ?? [];
    }

    /// <summary>Recomendações da comunidade para cada título, numa requisição só.</summary>
    public async Task<IReadOnlyDictionary<int, IReadOnlyList<Recommendation>>> RecommendationsAsync(IReadOnlyList<int> ids)
    {
        var result = new Dictionary<int, IReadOnlyList<Recommendation>>();
        if (ids.Count == 0) return result;
        var data = await QueryAsync(Queries.Recommendations(ids), new JsonObject());
        for (var i = 0; i < ids.Count; i++)
        {
            result[ids[i]] = data[$"m{i}"]?["recommendations"]?["nodes"]?.AsArray().OfType<JsonObject>()
                .Where(n => n["mediaRecommendation"] is JsonObject && ((int?)n["rating"] ?? 0) > 0)
                .Select(n => new Recommendation((int)n["rating"]!, ParseMedia((JsonObject)n["mediaRecommendation"]!)))
                .ToList() ?? [];
        }
        return result;
    }

    private static PersonSummary ParsePerson(JsonObject p) =>
        new((int)p["id"]!, (string?)p["name"]?["full"] ?? "?", (string?)p["image"]?["large"]);

    private static string RoleLabel(string? role) => role switch
    {
        "MAIN" => "Principal",
        "SUPPORTING" => "Coadjuvante",
        "BACKGROUND" => "Figurante",
        _ => "",
    };
}
