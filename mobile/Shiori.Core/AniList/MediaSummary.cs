namespace Shiori.Core.AniList;

/// <summary>
/// Resumo de um anime ou mangá vindo do AniList (o que aparece em cards e vai para a lista).
/// <see cref="Title"/> é o romaji (igual ao site guarda); para mostrar use <see cref="DisplayTitle"/>.
/// </summary>
public sealed record MediaSummary(
    int Id,
    int? IdMal,
    string Title,
    string? TitleEnglish,
    string? TitleNative,
    string? Cover,
    string? Color,
    string? Format,
    int? Episodes,
    int? Chapters,
    int? Volumes,
    string? Country,
    int? Year,
    string[] Genres,
    int? AverageScore,
    string Type)
{
    /// <summary>Título para a tela: inglês quando existe, senão romaji (como o site).</summary>
    public string DisplayTitle => TitleEnglish ?? Title;

    public bool IsManga => Type == "MANGA";

    /// <summary>Total de episódios (anime) ou capítulos (mangá), se conhecido.</summary>
    public int? Total => IsManga ? Chapters : Episodes;
}
