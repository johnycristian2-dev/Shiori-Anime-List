using ShioriApp.Views;

namespace ShioriApp;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        // Telas que abrem por cima das abas (com botão voltar)
        Routing.RegisterRoute("web", typeof(WebPage));
        Routing.RegisterRoute("detail", typeof(DetailPage));
        Routing.RegisterRoute("character", typeof(CharacterPage));
        Routing.RegisterRoute("staff", typeof(StaffPage));
        Routing.RegisterRoute("studio", typeof(StudioPage));
        Routing.RegisterRoute("calendar", typeof(CalendarPage));
        Routing.RegisterRoute("explore", typeof(ExplorePage));
        Routing.RegisterRoute("swipe", typeof(SwipePage));
        Routing.RegisterRoute("roulette", typeof(RoulettePage));
        Routing.RegisterRoute("foryou", typeof(ForYouPage));
    }
}
