using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.List;

namespace ShioriApp.ViewModels;

/// <summary>Aba de status (Assistindo 12, Quero ver 30…).</summary>
public sealed record StatusTab(ListStatus Status, string Label, int Count, bool Selected)
{
    public string Text => $"{Label} {Count}";
    public Color Color => Color.FromArgb(ListStatusInfo.Color(Status));
}

/// <summary>Minha lista: abas por status, Anime/Mangá, +1 rápido e abrir o Detalhe.</summary>
public partial class MyListViewModel : BaseViewModel
{
    private readonly ListService _list;
    private ListDocument? _doc;

    public ObservableCollection<StatusTab> Tabs { get; } = [];
    public ObservableCollection<ListEntryView> Items { get; } = [];

    [ObservableProperty]
    public partial ListStatus Status { get; set; } = ListStatus.WATCHING;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsAnime), nameof(IsManga))]
    public partial bool ShowManga { get; set; }

    public bool IsAnime => !ShowManga;
    public bool IsManga => ShowManga;

    public MyListViewModel(ListService list)
    {
        _list = list;
        _list.Changed += doc => MainThread.BeginInvokeOnMainThread(() => Show(doc));
    }

    protected override async Task LoadAsync() => Show(await _list.LoadAsync());

    [RelayCommand]
    private Task RefreshAsync() => RunAsync(LoadAsync);

    [RelayCommand]
    private void SelectStatus(ListStatus status)
    {
        Status = status;
        if (_doc is not null) Show(_doc);
    }

    [RelayCommand]
    private void SetManga(bool manga)
    {
        ShowManga = manga;
        if (_doc is not null) Show(_doc);
    }

    [RelayCommand]
    private Task OpenAsync(ListEntryView entry) => Navigation.OpenDetailAsync(entry.MediaId);

    [RelayCommand]
    private Task IncrementAsync(ListEntryView entry) => RunAsync(() =>
        _list.UpdateAsync(d => d.AddProgress(entry.MediaId, +1, ListService.Now())));

    private void Show(ListDocument doc)
    {
        _doc = doc;
        var ofType = doc.Entries.Where(e => e.IsManga == ShowManga).ToList();

        Tabs.Clear();
        foreach (var s in ListStatusInfo.Order)
            Tabs.Add(new StatusTab(s, ListStatusInfo.Label(s), ofType.Count(e => e.Status == s), s == Status));

        Items.Clear();
        foreach (var e in ofType.Where(e => e.Status == Status).OrderByDescending(e => e.UpdatedAt))
            Items.Add(e);
    }
}
