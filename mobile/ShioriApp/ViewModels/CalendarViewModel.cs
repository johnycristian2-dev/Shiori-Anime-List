using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core;
using Shiori.Core.AniList;
using Shiori.Core.Discover;
using Shiori.Core.List;

namespace ShioriApp.ViewModels;

/// <summary>Um episódio na tela (hora local já formatada e se está na minha lista).</summary>
public sealed record AiringRow(AiringItem Item, string Time, bool Mine)
{
    public string EpisodeText => $"Episódio {Item.Episode}";
}

/// <summary>Um dia do calendário: título ("Hoje", "Amanhã"…) + episódios. Usado no CollectionView agrupado.</summary>
public sealed class AiringGroup(string label, IEnumerable<AiringRow> rows) : ObservableCollection<AiringRow>(rows)
{
    public string Label { get; } = label;
}

/// <summary>
/// Calendário: episódios dos próximos 7 dias, agrupados por dia no fuso do celular.
/// "Só os meus" mostra apenas o que está na sua lista.
/// </summary>
public partial class CalendarViewModel(AniListClient anilist, ListService list) : BaseViewModel
{
    private IReadOnlyList<AiringItem> _all = [];
    private HashSet<int> _mine = [];

    public ObservableCollection<AiringGroup> Days { get; } = [];

    [ObservableProperty]
    public partial bool OnlyMine { get; set; }

    [ObservableProperty]
    public partial bool IsEmpty { get; set; }

    partial void OnOnlyMineChanged(bool value) => Fill();

    public Task InitAsync() => _all.Count > 0 ? Task.CompletedTask : RunAsync(LoadAsync);

    protected override async Task LoadAsync()
    {
        var start = new DateTimeOffset(DateTime.Today);
        var airing = anilist.AiringAsync(start, start.AddDays(7));
        try { _mine = (await list.LoadAsync()).Entries.Select(e => e.MediaId).ToHashSet(); }
        catch (ShioriException) { _mine = []; } // sem lista, o calendário funciona igual
        _all = await airing;
        Fill();
    }

    [RelayCommand]
    private Task RefreshAsync() => RunAsync(LoadAsync);

    [RelayCommand]
    private Task OpenAsync(AiringRow row) => Navigation.OpenDetailAsync(row.Item.Media.Id);

    private void Fill()
    {
        var zone = TimeZoneInfo.Local;
        var items = OnlyMine ? Calendar.OnlyMine(_all, _mine) : _all;
        Days.Clear();
        foreach (var day in Calendar.GroupByDay(items, zone, DateTimeOffset.Now))
            Days.Add(new AiringGroup(day.Label, day.Items.Select(i => new AiringRow(i, Calendar.Time(i.AiringAt, zone), _mine.Contains(i.Media.Id)))));
        IsEmpty = Days.Count == 0 && !IsLoading;
    }
}
