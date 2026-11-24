using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core;
using Shiori.Core.AniList;
using Shiori.Core.Display;
using Shiori.Core.List;

namespace ShioriApp.ViewModels;

/// <summary>
/// Início: "Continuar assistindo" (da sua lista), "Em alta" e "Temporada atual" (do AniList).
/// As três buscas rodam em paralelo; se a lista falhar, o resto ainda aparece.
/// </summary>
public partial class HomeViewModel : BaseViewModel
{
    private readonly AniListClient _anilist;
    private readonly ListService _list;

    public ObservableCollection<ListEntryView> ContinueWatching { get; } = [];
    public ObservableCollection<MediaSummary> Trending { get; } = [];
    public ObservableCollection<MediaSummary> Season { get; } = [];

    public string SeasonTitle { get; }

    [ObservableProperty]
    public partial bool HasContinue { get; set; }

    public HomeViewModel(AniListClient anilist, ListService list)
    {
        _anilist = anilist;
        _list = list;
        var (year, season) = AniListClient.CurrentSeason(DateTime.Now);
        SeasonTitle = $"{Format.Season(season)} {year}";
        // +1 feito no Detalhe ou na Minha lista aparece aqui na hora
        _list.Changed += doc => MainThread.BeginInvokeOnMainThread(() => FillContinue(doc));
    }

    /// <summary>
    /// Primeira vez: carrega tudo. Depois: só a lista (pode ter mudado no site ou trocado de conta).
    /// </summary>
    public async Task InitAsync()
    {
        if (Trending.Count == 0) { await RunAsync(LoadAsync); return; }
        var doc = await LoadListSafeAsync();
        if (doc is not null) FillContinue(doc);
        else { ContinueWatching.Clear(); HasContinue = false; }
    }

    protected override async Task LoadAsync()
    {
        var (year, season) = AniListClient.CurrentSeason(DateTime.Now);
        var trending = _anilist.TrendingAsync();
        var seasonal = _anilist.SeasonAsync(year, season);
        var list = LoadListSafeAsync();

        Replace(Trending, await trending);
        Replace(Season, await seasonal);
        if (await list is { } doc) FillContinue(doc);
    }

    [RelayCommand]
    private Task RefreshAsync() => RunAsync(LoadAsync);

    [RelayCommand]
    private Task OpenMediaAsync(int id) => Navigation.OpenDetailAsync(id);

    /// <summary>Atalhos do topo do Início (calendar, explore, swipe, roulette, foryou).</summary>
    [RelayCommand]
    private Task OpenNativeAsync(string route) => Navigation.OpenNativeAsync(route);

    /// <summary>+1 episódio direto do Início.</summary>
    [RelayCommand]
    private Task IncrementAsync(ListEntryView entry) => RunAsync(() =>
        _list.UpdateAsync(d => d.AddProgress(entry.MediaId, +1, ListService.Now())));

    private async Task<ListDocument?> LoadListSafeAsync()
    {
        try { return await _list.LoadAsync(); }
        catch (ShioriException) { return null; } // Início funciona mesmo se a lista não carregar
    }

    private void FillContinue(ListDocument doc)
    {
        Replace(ContinueWatching, Format.ContinueWatching(doc.Entries));
        HasContinue = ContinueWatching.Count > 0;
    }

    private static void Replace<T>(ObservableCollection<T> target, IEnumerable<T> items)
    {
        target.Clear();
        foreach (var item in items) target.Add(item);
    }
}
