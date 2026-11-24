namespace Shiori.Core.Web;

/// <summary>Uma seção do site que o app abre na parte web (aba "Mais").</summary>
/// <param name="NativeRoute">Rota da tela nativa do app, quando existe (senão abre o site na parte web).</param>
public sealed record SiteSection(string Group, string Title, string Description, string Route, string Glyph, string? NativeRoute = null)
{
    public bool IsNative => NativeRoute is not null;
}

/// <summary>
/// Todas as telas do site que não são nativas no app. As nativas são:
/// Início, Busca, Detalhe (anime/mangá), Minha lista e Perfil.
/// </summary>
public static class SiteSections
{
    public static readonly IReadOnlyList<SiteSection> All =
    [
        new("Descobrir", "Explorar", "Filtre por gênero, temporada, formato e nota", "/explorar", "🧭", "explore"),
        new("Descobrir", "Swipe", "Arraste para a direita no que quer ver", "/swipe", "💫", "swipe"),
        new("Descobrir", "Calendário", "Episódios da semana e o que estreia", "/calendario", "📅", "calendar"),
        new("Descobrir", "Pra você", "Recomendações pelo seu gosto", "/pra-voce", "✨", "foryou"),
        new("Descobrir", "Roleta", "Deixe a sorte escolher o próximo", "/roleta", "🎲", "roulette"),
        new("Descobrir", "Maratona", "Planeje uma maratona com tempo total", "/maratona", "🍿"),
        new("Descobrir", "Comparar", "Compare listas com outra pessoa", "/comparar", "⚖️"),
        new("Descobrir", "Retrospectiva", "Seu ano em animes", "/retrospectiva", "🎞️"),

        new("Social", "Amigos", "Siga pessoas e veja o que estão vendo", "/amigos", "👥"),
        new("Social", "Chat", "Salas de conversa da comunidade", "/chat", "💬"),
        new("Social", "Watch party", "Assista junto com chat ao vivo", "/party", "🎉"),

        new("Jogos", "Jogos", "Animedle, Capa e Maior ou Menor", "/jogos", "🎮"),
        new("Jogos", "Liga", "Ranking e temporadas dos jogos", "/liga", "🏆"),

        new("Conta", "Editar perfil", "Nome, avatar, bio e privacidade", "/perfil/editar", "✏️"),
        new("Conta", "Temas", "Cores e visual do Shiori", "/temas", "🎨"),
        new("Conta", "Sincronizar", "Importar e exportar do AniList e MAL", "/sync", "🔄"),
        new("Conta", "Apoiar", "Shiori Plus e doações", "/apoiar", "💖"),
        new("Conta", "Moderação", "Ferramentas da equipe", "/moderacao", "🛡️"),

        new("Sobre", "Novidades", "O que vem por aí no Shiori", "/roadmap", "🗺️"),
        new("Sobre", "Feedback", "Mande sugestões e relate problemas", "/feedback", "📝"),
        new("Sobre", "Termos de uso", "Regras do Shiori", "/termos", "📄"),
        new("Sobre", "Privacidade", "Como seus dados são usados", "/privacidade", "🔒"),
    ];
}
