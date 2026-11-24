using Microsoft.Extensions.Logging;
using Shiori.Core.AniList;
using Shiori.Core.Auth;
using Shiori.Core.List;
using ShioriApp.Services;
using ShioriApp.ViewModels;
using ShioriApp.Views;

namespace ShioriApp;

/// <summary>
/// Monta o app: fontes e injeção de dependências (DI).
/// Serviços = singletons (um só para o app todo); telas e ViewModels = novos a cada abertura.
/// </summary>
public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                fonts.AddFont("OpenSans-Semibold.ttf", "Display");
            });

        // Serviços (Shiori.Core)
        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        builder.Services.AddSingleton(http);
        builder.Services.AddSingleton<ISessionStore, SecureSessionStore>();
        builder.Services.AddSingleton<AuthService>();
        builder.Services.AddSingleton<ListService>();
        builder.Services.AddSingleton<AniListClient>();

        // Telas + ViewModels
        builder.Services.AddTransient<LoginPage>().AddTransient<LoginViewModel>();
        builder.Services.AddTransient<HomePage>().AddTransient<HomeViewModel>();
        builder.Services.AddTransient<SearchPage>().AddTransient<SearchViewModel>();
        builder.Services.AddTransient<DetailPage>().AddTransient<DetailViewModel>();
        builder.Services.AddTransient<MyListPage>().AddTransient<ProfilePage>();
        builder.Services.AddTransient<MorePage>().AddTransient<MoreViewModel>();
        builder.Services.AddTransient<WebPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif
        return builder.Build();
    }
}
