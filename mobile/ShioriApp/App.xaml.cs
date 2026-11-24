using Shiori.Core.Auth;

namespace ShioriApp;

/// <summary>
/// Início do app: lê a sessão guardada e decide entre a tela de Login e as abas.
/// Se a sessão acabar no meio do uso (token recusado ou "Sair"), volta para o Login.
/// </summary>
public partial class App : Application
{
    private readonly AuthService _auth;

    public App(AuthService auth)
    {
        InitializeComponent();
        _auth = auth;
        UserAppTheme = AppTheme.Dark; // o Shiori é sempre escuro, como o site
        _auth.SignedOut += () => MainThread.BeginInvokeOnMainThread(async () =>
        {
            if (Shell.Current is not null) await Shell.Current.GoToAsync("//login");
        });
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var shell = new AppShell();
        shell.Loaded += async (_, _) =>
        {
            var session = await _auth.RestoreAsync();
            await shell.GoToAsync(session is null ? "//login" : "//home");
        };
        return new Window(shell) { Title = "Shiori" };
    }
}
