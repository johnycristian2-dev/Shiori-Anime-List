using Shiori.Core.List;

namespace Shiori.Core.Display;

/// <summary>Textos e seleções que as telas mostram (separados aqui para terem testes).</summary>
public static class Format
{
    /// <summary>"Ep 5 em 3 dias", "Ep 5 amanhã", "Ep 5 em 5 h"…</summary>
    public static string NextEpisode(int episode, DateTimeOffset airingAt, DateTimeOffset now)
    {
        var left = airingAt - now;
        if (left <= TimeSpan.Zero) return $"Ep {episode} já saiu";
        if (left < TimeSpan.FromHours(1)) return $"Ep {episode} em {Math.Max(1, (int)left.TotalMinutes)} min";
        if (left < TimeSpan.FromHours(24)) return $"Ep {episode} em {(int)left.TotalHours} h";
        if (left < TimeSpan.FromHours(48)) return $"Ep {episode} amanhã";
        return $"Ep {episode} em {(int)left.TotalDays} dias";
    }

    /// <summary>"Continuar assistindo": o que está em Assistindo, mexido por último primeiro.</summary>
    public static IReadOnlyList<ListEntryView> ContinueWatching(IEnumerable<ListEntryView> entries, int max = 12) =>
        entries.Where(e => e.Status == ListStatus.WATCHING).OrderByDescending(e => e.UpdatedAt).Take(max).ToList();

    /// <summary>Nota média do AniList (0–100) como porcentagem.</summary>
    public static string Score(int? averageScore) => averageScore is { } s ? $"{s}%" : "—";

    public static string MediaFormat(string? format) => format switch
    {
        null => "",
        "MOVIE" => "Filme",
        "TV_SHORT" => "TV curta",
        "SPECIAL" => "Especial",
        "MUSIC" => "Clipe",
        "MANGA" => "Mangá",
        "NOVEL" => "Light novel",
        "ONE_SHOT" => "One-shot",
        _ => format, // TV, OVA, ONA
    };

    public static string Season(string? season) => season switch
    {
        "WINTER" => "Inverno",
        "SPRING" => "Primavera",
        "SUMMER" => "Verão",
        "FALL" => "Outono",
        _ => "",
    };

    public static string Status(string? status) => status switch
    {
        "RELEASING" => "Em lançamento",
        "FINISHED" => "Finalizado",
        "NOT_YET_RELEASED" => "Ainda não lançado",
        "CANCELLED" => "Cancelado",
        "HIATUS" => "Em hiato",
        _ => "",
    };
}
