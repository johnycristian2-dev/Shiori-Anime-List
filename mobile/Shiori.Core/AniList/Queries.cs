namespace Shiori.Core.AniList;

/// <summary>
/// Consultas GraphQL ao AniList (https://graphql.anilist.co). São as mesmas que o site usa
/// (src/api/queries.ts), só com os campos que o app mostra.
/// </summary>
internal static class Queries
{
    public const string MediaFields = """
        id idMal
        title { romaji english native }
        coverImage { extraLarge large color }
        bannerImage episodes format status season seasonYear averageScore genres
        type chapters volumes countryOfOrigin
        """;

    public const string Trending = $$"""
        query ($type: MediaType) {
          Page(perPage: 20) { media(type: $type, isAdult: false, sort: TRENDING_DESC) { {{MediaFields}} } }
        }
        """;

    public const string Season = $$"""
        query ($season: MediaSeason, $year: Int) {
          Page(perPage: 20) { media(type: ANIME, isAdult: false, season: $season, seasonYear: $year, sort: POPULARITY_DESC) { {{MediaFields}} } }
        }
        """;

    public const string Search = $$"""
        query ($search: String, $type: MediaType) {
          Page(perPage: 30) { media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) { {{MediaFields}} } }
        }
        """;

    public const string Detail = $$"""
        query ($id: Int) {
          Media(id: $id) {
            {{MediaFields}}
            description(asHtml: false)
            studios(isMain: true) { nodes { id name } }
            characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) { edges { role node { id name { full } image { large } } } }
            nextAiringEpisode { episode airingAt }
          }
        }
        """;
}
