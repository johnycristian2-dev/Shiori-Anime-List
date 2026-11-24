namespace ShioriApp;

/// <summary>Atalhos de navegação usados pelas telas (rotas registradas em AppShell).</summary>
public static class Navigation
{
    /// <summary>Abre uma página do site dentro do app (já logado).</summary>
    public static Task OpenWebAsync(string route, string title) =>
        Shell.Current.GoToAsync("web", new Dictionary<string, object> { ["route"] = route, ["title"] = title });

    /// <summary>Abre a tela de Detalhe nativa de um anime/mangá.</summary>
    public static Task OpenDetailAsync(int mediaId) =>
        Shell.Current.GoToAsync("detail", new Dictionary<string, object> { ["id"] = mediaId });
}
