using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.Auth;
using Shiori.Core.List;
using Shiori.Core.Profile;

namespace ShioriApp.ViewModels;

/// <summary>Um número do perfil (ex.: "Assistindo 12").</summary>
public sealed record StatItem(string Label, int Value, Color Color);

/// <summary>Perfil: avatar, nome, números da lista e atalhos para o perfil completo no site.</summary>
public partial class ProfileViewModel(AuthService auth, ProfileService profiles, ListService list) : BaseViewModel
{
    public ObservableCollection<StatItem> Stats { get; } = [];

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasProfile), nameof(NoProfile), nameof(Name), nameof(Handle), nameof(Avatar))]
    public partial Profile? Profile { get; set; }

    [ObservableProperty]
    public partial string Summary { get; set; } = "";

    public bool HasProfile => Profile is not null;
    public bool NoProfile => Profile is null && !IsLoading;
    public string Name => Profile?.Name ?? auth.Current?.Email ?? "";
    public string Handle => Profile is null ? "" : "@" + Profile.Username;
    public string? Avatar => Profile?.AvatarUrl;

    protected override async Task LoadAsync()
    {
        var profileTask = profiles.GetMineAsync();
        var doc = await list.LoadAsync();
        Profile = await profileTask;
        OnPropertyChanged(nameof(NoProfile));

        var stats = ListStats.From(doc.Entries);
        Stats.Clear();
        foreach (var s in ListStatusInfo.Order)
            Stats.Add(new StatItem(ListStatusInfo.Label(s), stats.Count(s), Color.FromArgb(ListStatusInfo.Color(s))));
        Summary = $"{stats.Total} títulos · {stats.EpisodesWatched} episódios · {stats.ChaptersRead} capítulos";
    }

    [RelayCommand]
    private Task RefreshAsync() => RunAsync(LoadAsync);

    [RelayCommand]
    private Task OpenFullProfileAsync() => Navigation.OpenWebAsync($"/u/{Profile?.Username}", Name);

    [RelayCommand]
    private Task EditProfileAsync() => Navigation.OpenWebAsync("/perfil/editar", "Editar perfil");

    [RelayCommand]
    private Task CreateProfileAsync() => Navigation.OpenWebAsync("/perfil", "Criar perfil");

    [RelayCommand]
    private async Task SignOutAsync()
    {
        if (!await Shell.Current.DisplayAlertAsync("Sair da conta?", "Você pode entrar de novo quando quiser.", "Sair", "Cancelar")) return;
        await auth.SignOutAsync(); // dispara SignedOut → o app volta para o Login
    }
}
