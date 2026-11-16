export const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage episodes format status season seasonYear averageScore popularity genres
  type chapters volumes countryOfOrigin
`;

export const PAGE_QUERY = `
query (
  $page: Int, $perPage: Int, $sort: [MediaSort], $genres: [String], $season: MediaSeason,
  $seasonYear: Int, $formats: [MediaFormat], $status: MediaStatus, $minScore: Int,
  $search: String, $yearFrom: FuzzyDateInt, $yearTo: FuzzyDateInt, $idMalIn: [Int], $idIn: [Int],
  $genresNot: [String], $licensed: [Int], $epMin: Int, $epMax: Int, $country: CountryCode, $tags: [String],
  $type: MediaType = ANIME, $chMin: Int, $chMax: Int
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage total }
    media(
      type: $type, isAdult: false, sort: $sort, genre_in: $genres, season: $season,
      seasonYear: $seasonYear, format_in: $formats, status: $status, averageScore_greater: $minScore,
      search: $search, startDate_greater: $yearFrom, startDate_lesser: $yearTo,
      idMal_in: $idMalIn, id_in: $idIn, genre_not_in: $genresNot, licensedById_in: $licensed,
      episodes_greater: $epMin, episodes_lesser: $epMax, countryOfOrigin: $country, tag_in: $tags,
      chapters_greater: $chMin, chapters_lesser: $chMax
    ) { ${MEDIA_FIELDS} description(asHtml: false) }
  }
}`;

/** Uma única requisição para toda a tela Descobrir (aliases). */
export const DISCOVER_QUERY = `
query ($season: MediaSeason, $year: Int, $nextSeason: MediaSeason, $nextYear: Int) {
  trending: Page(perPage: 20) { media(type: ANIME, isAdult: false, sort: TRENDING_DESC) { ${MEDIA_FIELDS} description(asHtml: false) } }
  season: Page(perPage: 20) { media(type: ANIME, isAdult: false, season: $season, seasonYear: $year, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} } }
  top: Page(perPage: 20) { media(type: ANIME, isAdult: false, sort: SCORE_DESC) { ${MEDIA_FIELDS} } }
  popular: Page(perPage: 20) { media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} } }
  upcoming: Page(perPage: 20) { media(type: ANIME, isAdult: false, season: $nextSeason, seasonYear: $nextYear, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} } }
}`;

/** Tela Descobrir no modo leitura (mangá, manhwa, webtoon…) */
export const MANGA_DISCOVER_QUERY = `
query {
  trending: Page(perPage: 20) { media(type: MANGA, isAdult: false, sort: TRENDING_DESC) { ${MEDIA_FIELDS} description(asHtml: false) } }
  releasing: Page(perPage: 20) { media(type: MANGA, isAdult: false, status: RELEASING, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} } }
  manhwa: Page(perPage: 20) { media(type: MANGA, isAdult: false, countryOfOrigin: KR, sort: TRENDING_DESC) { ${MEDIA_FIELDS} } }
  webtoon: Page(perPage: 20) { media(type: MANGA, isAdult: false, tag_in: ["Long Strip"], sort: POPULARITY_DESC) { ${MEDIA_FIELDS} } }
  top: Page(perPage: 20) { media(type: MANGA, isAdult: false, sort: SCORE_DESC, format_in: [MANGA, ONE_SHOT]) { ${MEDIA_FIELDS} } }
  novels: Page(perPage: 20) { media(type: MANGA, isAdult: false, format: NOVEL, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} } }
}`;

export const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    ${MEDIA_FIELDS}
    description(asHtml: false)
    studios(isMain: true) { nodes { id name } }
    externalLinks { site url type color }
    tags { name rank isMediaSpoiler }
    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
      edges {
        role
        node { id name { full native } image { large } }
        voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full native } image { large } }
      }
    }
    nextAiringEpisode { episode airingAt }
    trailer { id site }
    relations { edges { relationType(version: 2) node { ${MEDIA_FIELDS} type } } }
    recommendations(sort: RATING_DESC, perPage: 16) { nodes { rating mediaRecommendation { ${MEDIA_FIELDS} } } }
    staff(sort: [RELEVANCE, ID], perPage: 6) { edges { role node { id name { full native } image { large } } } }
  }
}`;

export const GENRES_QUERY = `query { GenreCollection }`;

/** Recomendações de vários animes de uma vez (um alias por anime). */
export function buildRecsQuery(ids: number[]) {
  const parts = ids.map(
    (id, i) =>
      `m${i}: Media(id: ${Number(id)}) { id recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { ${MEDIA_FIELDS} } } } }`,
  );
  return `query { ${parts.join('\n')} }`;
}

export const USER_LIST_QUERY = `
query ($user: String, $type: MediaType = ANIME) {
  MediaListCollection(userName: $user, type: $type) {
    lists { entries { status score(format: POINT_10) progress media { ${MEDIA_FIELDS} } } }
  }
}`;

export const VIEWER_QUERY = `query { Viewer { id name avatar { medium } } }`;

export const SAVE_ENTRY_MUTATION = `
mutation ($mediaId: Int, $status: MediaListStatus, $scoreRaw: Int, $progress: Int) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status, scoreRaw: $scoreRaw, progress: $progress) { id }
}`;

export const AIRING_QUERY = `
query ($page: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage currentPage total }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      id episode airingAt
      media { ${MEDIA_FIELDS} isAdult }
    }
  }
}`;

export const STUDIO_QUERY = `
query ($id: Int, $page: Int) {
  Studio(id: $id) {
    id name isAnimationStudio
    media(sort: POPULARITY_DESC, isMain: true, page: $page, perPage: 30) {
      pageInfo { hasNextPage currentPage total }
      nodes { ${MEDIA_FIELDS} }
    }
  }
}`;

/** Episódios que saíram de animes específicos (sino de novidades). */
export const AIRING_BY_MEDIA_QUERY = `
query ($ids: [Int], $from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) {
      id episode airingAt mediaId
    }
  }
}`;

/** Lista do usuário logado no AniList, com data de atualização de cada anime. */
export const VIEWER_LIST_QUERY = `
query ($userId: Int, $type: MediaType = ANIME) {
  MediaListCollection(userId: $userId, type: $type) {
    lists { entries { status score(format: POINT_10) progress updatedAt media { ${MEDIA_FIELDS} } } }
  }
}`;

export const MEDIA_LIST_ID_QUERY = `
query ($userId: Int, $mediaId: Int) { MediaList(userId: $userId, mediaId: $mediaId) { id } }`;

export const DELETE_ENTRY_MUTATION = `
mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }`;

export const CHARACTER_QUERY = `
query ($id: Int) {
  Character(id: $id) {
    id favourites gender age bloodType
    name { full native alternative }
    image { large }
    description(asHtml: false)
    dateOfBirth { month day }
    media(sort: POPULARITY_DESC, perPage: 25, type: ANIME) {
      edges {
        characterRole
        node { ${MEDIA_FIELDS} }
        voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full native } image { large } }
      }
    }
  }
}`;

export const STAFF_QUERY = `
query ($id: Int, $page: Int) {
  Staff(id: $id) {
    id favourites gender age homeTown yearsActive languageV2
    name { full native }
    image { large }
    description(asHtml: false)
    dateOfBirth { year month day }
    characterMedia(sort: POPULARITY_DESC, page: $page, perPage: 30) {
      pageInfo { hasNextPage currentPage total }
      edges {
        characterRole
        node { ${MEDIA_FIELDS} type }
        characters { id name { full native } image { large } }
      }
    }
  }
}`;
