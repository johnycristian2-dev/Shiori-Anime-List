namespace Shiori.Core.AniList;

/// <summary>Pessoa ou personagem resumido (nome + foto).</summary>
public sealed record PersonSummary(int Id, string Name, string? Image);

/// <summary>Uma página de resultados com "tem mais?".</summary>
public sealed record PageResult<T>(IReadOnlyList<T> Items, bool HasNextPage);

/// <summary>Em que anime o personagem aparece, com que papel e quem dubla.</summary>
public sealed record CharacterAppearance(string Role, MediaSummary Media, PersonSummary? VoiceActor);

public sealed record CharacterDetail(
    int Id, string Name, string? NativeName, string[] AlternativeNames, string? Image, string? Description,
    string? Gender, string? Age, string? Birthday, int? Favourites, IReadOnlyList<CharacterAppearance> Appearances);

/// <summary>Personagem que o dublador fez, em qual anime.</summary>
public sealed record StaffRole(string Role, MediaSummary Media, PersonSummary? Character);

public sealed record StaffDetail(
    int Id, string Name, string? NativeName, string? Image, string? Description, string? HomeTown,
    int? Favourites, IReadOnlyList<StaffRole> Roles, bool HasMoreRoles);

public sealed record StudioDetail(int Id, string Name, IReadOnlyList<MediaSummary> Works, bool HasNextPage);

/// <summary>Um episódio na grade do calendário.</summary>
public sealed record AiringItem(int Episode, DateTimeOffset AiringAt, MediaSummary Media);

public sealed record Recommendation(int Rating, MediaSummary Media);

/// <summary>
/// Filtros da tela Explorar (e do baralho do Swipe). Só os preenchidos vão para a consulta.
/// <see cref="Sort"/> usa os nomes do AniList: POPULARITY_DESC, SCORE_DESC, TRENDING_DESC, START_DATE_DESC.
/// </summary>
public sealed record BrowseFilter(
    string Type = "ANIME",
    string Sort = "POPULARITY_DESC",
    string? Genre = null,
    string? Season = null,
    int? Year = null,
    string? Format = null,
    string? Country = null,
    string? Search = null);
