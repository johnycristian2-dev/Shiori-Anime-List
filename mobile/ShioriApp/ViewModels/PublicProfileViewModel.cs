using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.List;
using Shiori.Core.Profile;

namespace ShioriApp.ViewModels;

/// <summary>Perfil público (/u/apelido): rank, números, favoritos, o que está vendo e os melhores completos.</summary>
public partial class PublicProfileViewModel(ProfileService profiles) : BaseViewModel
{
    private string _username = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Found), nameof(NotFound))]
    public partial PublicProfile? Data { get; set; }

    public bool Found => Data is not null;
    public bool NotFound => Data is null && !IsLoading && !HasError;

    public ObservableCollection<StatItem> Stats { get; } = [];

    public void Open(string username)
    {
        _username = username;
        _ = RunAsync(LoadAsync);
    }

    protected override async Task LoadAsync()
    {
        Data = await profiles.GetPublicAsync(_username);
        Stats.Clear();
        if (Data is { } p)
        {
            Stats.Add(new StatItem("Títulos", p.Total, Color.FromArgb("#cbb2ff")));
            Stats.Add(new StatItem("Completos", p.Completed, Color.FromArgb(ListStatusInfo.Color(ListStatus.COMPLETED))));
            Stats.Add(new StatItem("Episódios", p.Episodes, Color.FromArgb(ListStatusInfo.Color(ListStatus.WATCHING))));
            Stats.Add(new StatItem("Horas", (int)Math.Round(p.Hours), Color.FromArgb("#ffe14d")));
        }
        OnPropertyChanged(nameof(NotFound));
    }

    [RelayCommand]
    private Task OpenAsync(ListEntryView e) => Navigation.OpenDetailAsync(e.MediaId);

    /// <summary>Seguir, conquistas e comentários ficam na página do site.</summary>
    [RelayCommand]
    private Task OpenOnSiteAsync() => Navigation.OpenWebAsync($"/u/{Data?.Profile.Username ?? _username}", Data?.Profile.Name ?? _username);
}
