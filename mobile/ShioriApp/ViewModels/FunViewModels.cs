using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core;
using Shiori.Core.AniList;
using Shiori.Core.Discover;
using Shiori.Core.List;

namespace ShioriApp.ViewModels;

/// <summary>Roleta: sorteia o próximo anime da sua lista "Quero ver".</summary>
public partial class RouletteViewModel(ListService list) : BaseViewModel
{
    private readonly Random _random = new();
    private IReadOnlyList<ListEntryView> _entries = [];

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasPick))]
    public partial ListEntryView? Pick { get; set; }

    [ObservableProperty]
    public partial int PlanningCount { get; set; }

    public bool HasPick => Pick is not null;

    /// <summary>A tela anima a roleta enquanto isto é true.</summary>
    [ObservableProperty]
    public partial bool IsSpinning { get; set; }

    /// <summary>Disparado a cada "girada" (a tela usa para animar).</summary>
    public event Action? Spun;

    protected override async Task LoadAsync()
    {
        _entries = (await list.LoadAsync()).Entries;
        PlanningCount = _entries.Count(e => e.Status == ListStatus.PLANNING);
    }

    public Task InitAsync() => RunAsync(LoadAsync);

    [RelayCommand]
    private async Task SpinAsync()
    {
        if (IsSpinning) return;
        if (_entries.Count == 0) await RunAsync(LoadAsync);
        IsSpinning = true;
        // mostra alguns títulos passando antes de parar no sorteado
        for (var i = 0; i < 12; i++)
        {
            Pick = Roulette.Pick(_entries, _random);
            await Task.Delay(60 + i * 15);
        }
        IsSpinning = false;
        Spun?.Invoke();
    }

    [RelayCommand]
    private Task OpenAsync() => Pick is { } p ? Navigation.OpenDetailAsync(p.MediaId) : Task.CompletedTask;

    /// <summary>"Vou assistir!": muda de Quero ver para Assistindo.</summary>
    [RelayCommand]
    private Task StartWatchingAsync() => Pick is not { } p ? Task.CompletedTask : RunAsync(async () =>
    {
        var doc = await list.UpdateAsync(d => d.SetStatus(p.MediaId, ListStatus.WATCHING, ListService.Now()));
        _entries = doc.Entries;
        PlanningCount = _entries.Count(e => e.Status == ListStatus.PLANNING);
        Pick = doc.Get(p.MediaId);
    });
}

/// <summary>Uma fonte de cartas do Swipe (Em alta, Mais populares, um gênero…).</summary>
public sealed record SwipeSource(string Label, BrowseFilter Filter);

/// <summary>
/// Swipe: um título por vez. Direita = Quero ver, esquerda = pular (não aparece de novo), "Já vi" = Completo.
/// O baralho vem do AniList e esconde o que já está na lista ou foi pulado (mesma regra do site).
/// </summary>
public partial class SwipeViewModel(AniListClient anilist, ListService list) : BaseViewModel
{
    private readonly Queue<MediaSummary> _deck = new();
    private readonly Stack<MediaSummary> _deckFront = new(); // cartas devolvidas quando um salvamento falha
    private int _page = 1;
    private bool _hasMore = true;

    public IReadOnlyList<SwipeSource> Sources { get; } =
    [
        new("Em alta", new BrowseFilter(Sort: "TRENDING_DESC")),
        new("Mais populares", new BrowseFilter()),
        new("Melhor nota", new BrowseFilter(Sort: "SCORE_DESC")),
        new("Ação", new BrowseFilter(Genre: "Action")),
        new("Romance", new BrowseFilter(Genre: "Romance")),
        new("Comédia", new BrowseFilter(Genre: "Comedy")),
        new("Mangá em alta", new BrowseFilter(Type: "MANGA", Sort: "TRENDING_DESC")),
        new("Manhwa", new BrowseFilter(Type: "MANGA", Sort: "TRENDING_DESC", Country: "KR")),
    ];

    [ObservableProperty]
    public partial SwipeSource? Source { get; set; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasCard))]
    public partial MediaSummary? Card { get; set; }

    [ObservableProperty]
    public partial int Added { get; set; }

    public bool HasCard => Card is not null;

    /// <summary>A tela anima a carta saindo: +1 direita, −1 esquerda, 0 para cima.</summary>
    public event Action<int>? Decided;

    partial void OnSourceChanged(SwipeSource? value)
    {
        _deck.Clear();
        _page = 1;
        _hasMore = true;
        Card = null;
        _ = RunAsync(LoadAsync);
    }

    public void Init()
    {
        if (Source is null) Source = Sources[0];
    }

    protected override async Task LoadAsync()
    {
        if (Source is null) return;
        var doc = list.Cached ?? await TryLoadListAsync();
        // busca páginas até ter cartas novas (o que já está na lista é escondido)
        while (_deck.Count < 5 && _hasMore)
        {
            var page = await anilist.BrowseAsync(Source.Filter, _page++);
            _hasMore = page.HasNextPage && _page <= 15;
            var fresh = doc is null ? page.Items : SwipeDeck.Filter(page.Items, doc);
            foreach (var m in fresh.Where(m => _deck.All(d => d.Id != m.Id) && m.Id != Card?.Id)) _deck.Enqueue(m);
        }
        Card ??= NextCard();
    }

    private MediaSummary? NextCard() =>
        _deckFront.TryPop(out var back) ? back : _deck.TryDequeue(out var next) ? next : null;

    [RelayCommand]
    private Task WantAsync() => DecideAsync(+1, (d, m) => d.Upsert(m, ListStatus.PLANNING, ListService.Now()));

    [RelayCommand]
    private Task SkipAsync() => DecideAsync(-1, (d, m) => d.Skip(m.Id));

    [RelayCommand]
    private Task SeenAsync() => DecideAsync(0, (d, m) => d.Upsert(m, ListStatus.COMPLETED, ListService.Now()));

    [RelayCommand]
    private Task OpenAsync() => Card is { } c ? Navigation.OpenDetailAsync(c.Id) : Task.CompletedTask;

    /// <param name="change">O que gravar, recebendo a carta decidida (capturada antes de trocar de carta).</param>
    private async Task DecideAsync(int direction, Action<ListDocument, MediaSummary> change)
    {
        if (Card is not { } current || IsLoading) return;
        Decided?.Invoke(direction);
        Card = NextCard(); // a próxima carta aparece na hora
        try
        {
            await list.UpdateAsync(d => change(d, current));
            if (direction > 0) Added++;
        }
        catch (ShioriException e)
        {
            ErrorMessage = e.Message;
            if (Card is { } shown) _deckFront.Push(shown); // devolve a carta que já estava na tela
            Card = current;                                // e volta a que não foi salva
        }
        if (_deck.Count < 3) await RunAsync(LoadAsync);
    }

    private async Task<ListDocument?> TryLoadListAsync()
    {
        try { return await list.LoadAsync(); }
        catch (ShioriException) { return null; }
    }
}

/// <summary>Uma sugestão na tela (com o texto "Porque você curtiu …").</summary>
public sealed record SuggestionRow(MediaSummary Media, string Because);

/// <summary>Pra você: recomendações da comunidade do AniList a partir do que você mais curtiu.</summary>
public partial class ForYouViewModel(AniListClient anilist, ListService list) : BaseViewModel
{
    public ObservableCollection<SuggestionRow> Items { get; } = [];

    [ObservableProperty]
    public partial string SeedsText { get; set; } = "";

    [ObservableProperty]
    public partial bool IsEmpty { get; set; }

    public Task InitAsync() => Items.Count > 0 ? Task.CompletedTask : RunAsync(LoadAsync);

    protected override async Task LoadAsync()
    {
        var doc = await list.LoadAsync();
        var seeds = Recommender.Seeds(doc.Entries);
        SeedsText = seeds.Count == 0 ? "" : "Baseado em: " + string.Join(", ", seeds.Take(4).Select(s => s.Title)) + (seeds.Count > 4 ? "…" : "");
        Items.Clear();
        IsEmpty = seeds.Count == 0;
        if (seeds.Count == 0) return;

        var recs = await anilist.RecommendationsAsync(seeds.Select(s => s.MediaId).ToList());
        var known = doc.Entries.Select(e => e.MediaId).Concat(doc.Skipped).ToHashSet();
        foreach (var s in Recommender.Rank(seeds, recs, known).Take(40))
            Items.Add(new SuggestionRow(s.Media, "Porque você curtiu " + string.Join(", ", s.Because.Take(2))));
        IsEmpty = Items.Count == 0;
    }

    [RelayCommand]
    private Task RefreshAsync() => RunAsync(LoadAsync);

    [RelayCommand]
    private Task OpenAsync(SuggestionRow row) => Navigation.OpenDetailAsync(row.Media.Id);

    /// <summary>Adiciona direto em "Quero ver" e tira da lista de sugestões.</summary>
    [RelayCommand]
    private Task AddAsync(SuggestionRow row) => RunAsync(async () =>
    {
        await list.UpdateAsync(d => d.Upsert(row.Media, ListStatus.PLANNING, ListService.Now()));
        Items.Remove(row);
    });
}
