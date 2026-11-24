namespace Shiori.Core;

/// <summary>
/// Endereços e chaves públicas usados pelo app. Nada aqui é segredo:
/// a chave do Supabase é a "publishable" (a mesma do site); quem protege
/// os dados são as políticas RLS do banco.
/// </summary>
public static class Config
{
    public const string SupabaseUrl = "https://ahtalxodwxzmjltbxmaz.supabase.co";
    public const string SupabaseKey = "sb_publishable_FsFyCkY0Zcni3pKEDUi2yQ_7UFY9RWF";

    /// <summary>Site publicado: a parte web do app abre aqui.</summary>
    public const string SiteUrl = "https://shiori-anime-list.vercel.app";

    /// <summary>API GraphQL do AniList (dados dos animes e mangás).</summary>
    public const string AniListUrl = "https://graphql.anilist.co";

    /// <summary>Chave onde o site (supabase-js) guarda a sessão no localStorage.</summary>
    public const string SessionStorageKey = "sb-ahtalxodwxzmjltbxmaz-auth-token";
}
