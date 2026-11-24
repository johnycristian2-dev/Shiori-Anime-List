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
    public const string Browse = $$"""
        query ($page: Int, $type: MediaType, $sort: [MediaSort], $genres: [String], $season: MediaSeason,
               $seasonYear: Int, $formats: [MediaFormat], $country: CountryCode, $search: String) {
          Page(page: $page, perPage: 30) {
            pageInfo { hasNextPage }
            media(type: $type, isAdult: false, sort: $sort, genre_in: $genres, season: $season, seasonYear: $seasonYear,
                  format_in: $formats, countryOfOrigin: $country, search: $search) { {{MediaFields}} }
          }
        }
        """;

    public const string Genres = "query { GenreCollection }";

    public const string Airing = $$"""
        query ($page: Int, $from: Int, $to: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              episode airingAt
              media { {{MediaFields}} isAdult }
            }
          }
        }
        """;

    public const string Character = $$"""
        query ($id: Int) {
          Character(id: $id) {
            id favourites gender age
            name { full native alternative }
            image { large }
            description(asHtml: false)
            dateOfBirth { month day }
            media(sort: POPULARITY_DESC, perPage: 25, type: ANIME) {
              edges {
                characterRole
                node { {{MediaFields}} }
                voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full } image { large } }
              }
            }
          }
        }
        """;

    public const string Staff = $$"""
        query ($id: Int, $page: Int) {
          Staff(id: $id) {
            id favourites homeTown
            name { full native }
            image { large }
            description(asHtml: false)
            characterMedia(sort: POPULARITY_DESC, page: $page, perPage: 30) {
              pageInfo { hasNextPage }
              edges {
                characterRole
                node { {{MediaFields}} }
                characters { id name { full } image { large } }
              }
            }
          }
        }
        """;

    public const string Studio = $$"""
        query ($id: Int, $page: Int) {
          Studio(id: $id) {
            id name
            media(sort: POPULARITY_DESC, isMain: true, page: $page, perPage: 30) {
              pageInfo { hasNextPage }
              nodes { {{MediaFields}} }
            }
          }
        }
        """;

    /// <summary>Recomendações de vários títulos numa requisição só (um "apelido" m0, m1… por título).</summary>
    public static string Recommendations(IReadOnlyList<int> ids) =>
        "query { " + string.Join("\n", ids.Select((id, i) =>
            $"m{i}: Media(id: {id}) {{ id recommendations(sort: RATING_DESC, perPage: 10) {{ nodes {{ rating mediaRecommendation {{ {MediaFields} }} }} }} }}")) + " }";
}
