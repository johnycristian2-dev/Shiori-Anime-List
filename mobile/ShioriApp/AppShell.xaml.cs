using ShioriApp.Views;

namespace ShioriApp;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        // Telas que abrem por cima das abas (com botão voltar)
        Routing.RegisterRoute("web", typeof(WebPage));
    }
}
