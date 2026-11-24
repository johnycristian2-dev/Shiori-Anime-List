using Shiori.Core;
using Shiori.Core.Auth;
using Shiori.Core.Web;

namespace ShioriApp.Views;

/// <summary>
/// Abre uma rota do site dentro do app.
/// Passo a passo:
///   1. carrega uma página leve do site (robots.txt) só para estar no domínio do site;
///   2. LÊ a sessão que o site já tem: se for a mesma conta e mais nova (o site renovou o token),
///      o app passa a usar ela; se for outra conta ou nenhuma, apaga os dados do site;
///   3. grava a sessão (a mais nova) no localStorage e vai para a rota pedida: o site entra logado;
///   4. a cada página carregada e ao sair, lê a sessão de volta (o site pode renovar o token a qualquer hora).
/// Links para fora do site abrem no navegador do celular.
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
        if (!Uri.TryCreate(e.Url, UriKind.Absolute, out var uri)) return;
        switch (uri.Scheme)
        {
            case "blob" or "data":
                return; // downloads/exportações do próprio site
            case "mailto" or "tel":
                e.Cancel = true;
                _ = Launcher.Default.OpenAsync(uri);
                return;
            default:
                e.Cancel = true;
                if (uri.Scheme is "https" or "http") _ = Browser.Default.OpenAsync(uri, BrowserLaunchMode.SystemPreferred);
                return;
        }
    }

    private async void OnNavigated(object? sender, WebNavigatedEventArgs e)
    {
        try
        {
            if (e.Result != WebNavigationResult.Success)
            {
                ShowError(ShioriException.NoConnection);
                return;
            }
            if (_injected)
            {
                Loading.IsVisible = false; // o site de verdade carregou
                await ReadBackAsync();
                return;
            }

            _injected = true;
            // O que o site tem guardado agora? (pode ter um token mais novo, ou ser de outra conta)
            var who = await ReadBackAsync();
            var session = await _auth.GetValidSessionAsync();
            await Web.EvaluateJavaScriptAsync(WebBridge.BuildInjectScript(session.RawJson, _route, clearSiteData: who != WebSession.SameUser));
        }
        catch (ShioriException ex) { ShowError(ex.Message); }
        catch (Exception) { ShowError("Não foi possível abrir esta página. Tente de novo."); }
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        if (_injected) await ReadBackAsync();
    }

    /// <summary>Lê a sessão do site e adota se for mais nova. Nunca lança erro.</summary>
    private async Task<WebSession> ReadBackAsync()
    {
        try
        {
            var raw = await Web.EvaluateJavaScriptAsync(WebBridge.ReadSessionScript);
            return await _auth.AdoptIfNewerAsync(WebBridge.DecodeReadResult(raw));
        }
        catch (Exception) { return WebSession.Missing; }
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
