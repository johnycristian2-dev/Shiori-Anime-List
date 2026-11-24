namespace Shiori.Core.AniList;

public sealed record CharacterSummary(int Id, string Name, string? Image);

/// <summary>Tudo que a tela de Detalhe mostra sobre um anime/mangá.</summary>
public sealed record MediaDetail(
    MediaSummary Summary,
    string? Banner,
    string? Description,
    string? Status,
    string? Season,
    string[] Studios,
    CharacterSummary[] Characters,
    DateTimeOffset? NextEpisodeAt,
    int? NextEpisode,
    IReadOnlyList<PersonSummary>? StudioRefs = null);
