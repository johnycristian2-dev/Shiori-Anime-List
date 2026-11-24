using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.AniList;

namespace ShioriApp.ViewModels;

/// <summary>
/// Busca no AniList. Espera 400 ms depois da última tecla antes de buscar
/// (evita uma requisição por letra e o limite de pedidos do AniList).
/// </summary>
public partial class SearchViewModel(AniListClient anilist) : BaseViewModel
{
    private CancellationTokenSource? _typing;

    public ObservableCollection<MediaSummary> Results { get; } = [];

    [ObservableProperty]
    public partial string Query { get; set; } = "";

    /// <summary>"ANIME" ou "MANGA".</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsAnime), nameof(IsManga))]
    public partial string Type { get; set; } = "ANIME";

    [ObservableProperty]
    public partial bool IsEmpty { get; set; }

    public bool IsAnime => Type == "ANIME";
    public bool IsManga => Type == "MANGA";

    partial void OnQueryChanged(string value) => _ = SearchSoonAsync();
    partial void OnTypeChanged(string value) => _ = SearchSoonAsync(immediate: true);

    [RelayCommand]
    private void SetType(string type) => Type = type;

    [RelayCommand]
    private Task OpenMediaAsync(int id) => Navigation.OpenDetailAsync(id);

    protected override async Task LoadAsync()
    {
        var text = Query.Trim();
        if (text.Length < 2)
        {
            Results.Clear();
            IsEmpty = false;
            return;
        }
        var found = await anilist.SearchAsync(text, Type);
        if (text != Query.Trim()) return; // a pessoa já digitou outra coisa
        Results.Clear();
        foreach (var m in found) Results.Add(m);
        IsEmpty = Results.Count == 0;
    }

    private async Task SearchSoonAsync(bool immediate = false)
    {
        _typing?.Cancel();
        var cts = _typing = new CancellationTokenSource();
        try
        {
            if (!immediate) await Task.Delay(400, cts.Token);
            // espera uma busca anterior terminar (RunAsync ignora chamadas enquanto carrega)
            while (IsLoading) await Task.Delay(50, cts.Token);
            await RunAsync(LoadAsync);
        }
        catch (TaskCanceledException) { /* digitou de novo */ }
    }
}
