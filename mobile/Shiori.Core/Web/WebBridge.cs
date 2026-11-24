using System.Text;
using System.Text.Json;

namespace Shiori.Core.Web;

/// <summary>
/// Ponte entre o app e a parte web (o site publicado aberto num WebView).
/// O site guarda a sessão no localStorage; o app escreve a mesma sessão lá antes de abrir a página,
/// e assim o site já entra logado, sem pedir senha de novo.
/// </summary>
public static class WebBridge
{
    private static readonly Uri Site = new(Config.SiteUrl);

    /// <summary>
    /// Página leve do mesmo domínio, aberta só para poder gravar no localStorage do site
    /// antes de carregar o site de verdade (evita carregar o site duas vezes).
    /// </summary>
    public const string BootPath = "/robots.txt";

    /// <summary>JavaScript que grava a sessão e vai para a rota pedida.</summary>
    public static string BuildInjectScript(string sessionJson, string route) =>
        $"localStorage.setItem({Js(Config.SessionStorageKey)}, {Js(sessionJson)}); location.replace({Js(SafeRoute(route))});";

    /// <summary>
    /// JavaScript que lê a sessão do site. Volta em base64 porque cada plataforma (Android, Windows)
    /// devolve strings do WebView com aspas e escapes diferentes; base64 chega igual em todas.
    /// </summary>
    public static string ReadSessionScript =>
        $"(function(){{var v=localStorage.getItem({Js(Config.SessionStorageKey)});return v?btoa(unescape(encodeURIComponent(v))):'';}})()";

    /// <summary>JavaScript que apaga a sessão do site (ao sair da conta).</summary>
    public static string ClearScript => $"localStorage.removeItem({Js(Config.SessionStorageKey)});";

    /// <summary>Converte o retorno de <see cref="ReadSessionScript"/> de volta no JSON da sessão.</summary>
    public static string? DecodeReadResult(string? result)
    {
        var value = result?.Trim().Trim('"');
        if (string.IsNullOrEmpty(value) || value == "null") return null;
        try { return Encoding.UTF8.GetString(Convert.FromBase64String(value)); }
        catch (FormatException) { return null; }
    }

    /// <summary>Só aceita caminhos dentro do site ("/jogos"); qualquer outra coisa vira a página inicial.</summary>
    public static string SafeRoute(string? route)
    {
        if (string.IsNullOrWhiteSpace(route)) return "/";
        var r = route.Trim();
        if (r.StartsWith("//") || r.Contains(':')) return "/";
        return r.StartsWith('/') ? r : "/" + r;
    }

    /// <summary>true para páginas do próprio site (o resto abre no navegador do celular).</summary>
    public static bool IsSiteUrl(string url)
    {
        if (url.StartsWith("about:", StringComparison.OrdinalIgnoreCase)) return true;
        return Uri.TryCreate(url, UriKind.Absolute, out var u)
            && u.Scheme == Uri.UriSchemeHttps
            && string.Equals(u.Host, Site.Host, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Endereço completo de uma rota do site.</summary>
    public static string SiteAddress(string route) => Config.SiteUrl + SafeRoute(route);

    private static string Js(string value) => JsonSerializer.Serialize(value); // escapa aspas, < e > (seguro dentro de JS)
}
