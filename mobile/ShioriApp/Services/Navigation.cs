namespace ShioriApp;

/// <summary>Atalhos de navegação usados pelas telas (rotas registradas em AppShell.xaml.cs).</summary>
public static class Navigation
{
    /// <summary>Abre uma página do site dentro do app (já logado).</summary>
    public static Task OpenWebAsync(string route, string title) => Go("web", ("route", route), ("title", title));

    /// <summary>Abre a tela de Detalhe nativa de um anime/mangá.</summary>
    public static Task OpenDetailAsync(int mediaId) => Go("detail", ("id", mediaId));

    public static Task OpenCharacterAsync(int id) => Go("character", ("id", id));

    public static Task OpenStaffAsync(int id) => Go("staff", ("id", id));

    public static Task OpenStudioAsync(int id) => Go("studio", ("id", id));

    /// <summary>Perfil público de alguém (/u/apelido).</summary>
    public static Task OpenUserAsync(string username) => Go("user", ("username", username));

    /// <summary>Telas nativas sem parâmetro: calendar, explore, swipe, roulette, foryou.</summary>
    public static Task OpenNativeAsync(string route) => Shell.Current.GoToAsync(route);

    private static Task Go(string route, params (string Key, object Value)[] args) =>
        Shell.Current.GoToAsync(route, args.ToDictionary(a => a.Key, a => a.Value));
}
