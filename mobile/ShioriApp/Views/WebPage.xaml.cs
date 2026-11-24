using Shiori.Core;
using Shiori.Core.Auth;
using Shiori.Core.Web;

namespace ShioriApp.Views;

/// <summary>
/// Abre uma rota do site dentro do app.
/// Passo a passo:
///   1. carrega uma página leve do site (robots.txt) só para estar no domínio do site;
///   2. grava a sessão do app no localStorage do site e vai para a rota pedida (o site entra logado);
///   3. ao sair, lê a sessão de volta: o site pode ter renovado o token e o app fica com o mais novo.
/// Links para fora do site (Crunchyroll, AniList…) abrem no navegador do celular.
/// </summary>
public partial class WebPage : ContentPage, IQueryAttributable
{
    private readonly AuthService _auth;
    private string _route = "/";
    private bool _injected;

    public WebPage(AuthService auth)
    {
        InitializeComponent();
        _auth = auth;
        Web.Navigating += OnNavigating;
        Web.Navigated += OnNavigated;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        _route = WebBridge.SafeRoute(query.TryGetValue("route", out var r) ? r as string : "/");
        Title = query.TryGetValue("title", out var t) ? t as string : "Shiori";
        Start();
    }

    private void Start()
    {
        _injected = false;
        ErrorBox.IsVisible = false;
        Loading.IsVisible = true;
        Web.Source = WebBridge.SiteAddress(WebBridge.BootPath);
    }

    private void OnNavigating(object? sender, WebNavigatingEventArgs e)
    {
        if (WebBridge.IsSiteUrl(e.Url)) return;
        e.Cancel = true;
        if (Uri.TryCreate(e.Url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
            _ = Browser.Default.OpenAsync(uri, BrowserLaunchMode.SystemPreferred);
    }

    private async void OnNavigated(object? sender, WebNavigatedEventArgs e)
    {
        if (e.Result != WebNavigationResult.Success)
        {
            ShowError(ShioriException.NoConnection);
            return;
        }
        if (_injected)
        {
            Loading.IsVisible = false; // o site de verdade carregou
            return;
        }

        _injected = true;
        try
        {
            var session = await _auth.GetValidSessionAsync();
            await Web.EvaluateJavaScriptAsync(WebBridge.BuildInjectScript(session.RawJson, _route));
        }
        catch (ShioriException ex) { ShowError(ex.Message); }
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        if (!_injected) return;
        try
        {
            var raw = await Web.EvaluateJavaScriptAsync(WebBridge.ReadSessionScript);
            await _auth.AdoptIfNewerAsync(WebBridge.DecodeReadResult(raw));
        }
        catch (Exception) { /* página já fechada: o app continua com a sessão que tem */ }
    }

    /// <summary>Botão voltar do Android: volta dentro do site antes de fechar a página.</summary>
    protected override bool OnBackButtonPressed()
    {
        if (Web.CanGoBack)
        {
            Web.GoBack();
            return true;
        }
        return base.OnBackButtonPressed();
    }

    private void ShowError(string message)
    {
        Loading.IsVisible = false;
        ErrorText.Text = message;
        ErrorBox.IsVisible = true;
    }

    private void OnRetry(object? sender, EventArgs e) => Start();
}
