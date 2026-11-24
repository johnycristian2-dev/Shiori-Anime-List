using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.AniList;

namespace ShioriApp.ViewModels;

/// <summary>Uma opção de filtro: o texto mostrado e o valor que vai para o AniList (null = "qualquer").</summary>
public sealed record Choice(string Label, string? Value)
{
    public override string ToString() => Label;
}

/// <summary>
/// Explorar: filtros do AniList (tipo, ordem, gênero, temporada, ano, formato, país).
/// Cada mudança refaz a busca; ao chegar no fim da grade, carrega a próxima página.
/// </summary>
public partial class ExploreViewModel(AniListClient anilist) : BaseViewModel
{
    private int _page = 1;
    private bool _ready;

    public ObservableCollection<MediaSummary> Results { get; } = [];

    public IReadOnlyList<Choice> Types { get; } = [new("Anime", "ANIME"), new("Mangá", "MANGA")];
    public IReadOnlyList<Choice> Sorts { get; } =
        [new("Mais populares", "POPULARITY_DESC"), new("Melhor nota", "SCORE_DESC"), new("Em alta", "TRENDING_DESC"), new("Mais novos", "START_DATE_DESC")];
    public IReadOnlyList<Choice> Seasons { get; } =
        [new("Qualquer temporada", null), new("Inverno", "WINTER"), new("Primavera", "SPRING"), new("Verão", "SUMMER"), new("Outono", "FALL")];
    public IReadOnlyList<Choice> Years { get; } =
        [new("Qualquer ano", null), .. Enumerable.Range(1970, DateTime.Now.Year - 1970 + 2).Reverse().Select(y => new Choice(y.ToString(), y.ToString()))];
    public IReadOnlyList<Choice> Countries { get; } =
        [new("Qualquer país", null), new("Japão", "JP"), new("Coreia (manhwa)", "KR"), new("China (manhua)", "CN")];

    public ObservableCollection<Choice> Genres { get; } = [new("Todos os gêneros", null)];
    public ObservableCollection<Choice> Formats { get; } = [];

    [ObservableProperty] public partial Choice? Type { get; set; }
    [ObservableProperty] public partial Choice? Sort { get; set; }
    [ObservableProperty] public partial Choice? Genre { get; set; }
    [ObservableProperty] public partial Choice? Season { get; set; }
    [ObservableProperty] public partial Choice? Year { get; set; }
    [ObservableProperty] public partial Choice? Format { get; set; }
    [ObservableProperty] public partial Choice? Country { get; set; }
    [ObservableProperty] public partial bool HasMore { get; set; }
    [ObservableProperty] public partial bool IsEmpty { get; set; }

    /// <summary>Temporada só faz sentido para anime.</summary>
    public bool IsAnime => Type?.Value != "MANGA";

    public async Task InitAsync()
    {
        if (_ready) return;
        Type ??= Types[0];
        Sort ??= Sorts[0];
        Season ??= Seasons[0];
        Year ??= Years[0];
        Country ??= Countries[0];
        Genre = Genres[0];
        FillFormats();
        _ready = true;
        await RunAsync(LoadAsync);
        try
        {
            foreach (var g in await anilist.GenresAsync()) Genres.Add(new Choice(g, g));
        }
        catch (Shiori.Core.ShioriException) { /* sem a lista de gêneros, o filtro fica só com "Todos" */ }
    }

    partial void OnTypeChanged(Choice? value)
    {
        OnPropertyChanged(nameof(IsAnime));
        FillFormats();
        Reload();
    }
    partial void OnSortChanged(Choice? value) => Reload();
    partial void OnGenreChanged(Choice? value) => Reload();
    partial void OnSeasonChanged(Choice? value) => Reload();
    partial void OnYearChanged(Choice? value) => Reload();
    partial void OnFormatChanged(Choice? value) => Reload();
    partial void OnCountryChanged(Choice? value) => Reload();

    protected override async Task LoadAsync()
    {
        _page = 1;
        var page = await anilist.BrowseAsync(CurrentFilter(), _page);
        Results.Clear();
        foreach (var m in page.Items) Results.Add(m);
        HasMore = page.HasNextPage;
        IsEmpty = Results.Count == 0;
    }

    [RelayCommand]
    private Task LoadMoreAsync() => HasMore && !IsLoading ? RunAsync(async () =>
    {
        var page = await anilist.BrowseAsync(CurrentFilter(), ++_page);
        foreach (var m in page.Items) Results.Add(m);
        HasMore = page.HasNextPage;
    }) : Task.CompletedTask;

    [RelayCommand]
    private Task OpenMediaAsync(int id) => Navigation.OpenDetailAsync(id);

    [RelayCommand]
    private void ClearFilters()
    {
        _ready = false; // evita 5 buscas seguidas enquanto zera
        Sort = Sorts[0];
        Genre = Genres[0];
        Season = Seasons[0];
        Year = Years[0];
        Format = Formats[0];
        Country = Countries[0];
        _ready = true;
        Reload();
    }

    private BrowseFilter CurrentFilter() => new(
        Type: Type?.Value ?? "ANIME",
        Sort: Sort?.Value ?? "POPULARITY_DESC",
        Genre: Genre?.Value,
        Season: IsAnime ? Season?.Value : null,
        Year: int.TryParse(Year?.Value, out var y) ? y : null,
        Format: Format?.Value,
        Country: Country?.Value);

    private void FillFormats()
    {
        Formats.Clear();
        Formats.Add(new Choice("Qualquer formato", null));
        IEnumerable<Choice> options = Type?.Value == "MANGA"
            ? [new("Mangá", "MANGA"), new("Light novel", "NOVEL"), new("One-shot", "ONE_SHOT")]
            : [new("TV", "TV"), new("Filme", "MOVIE"), new("OVA", "OVA"), new("ONA", "ONA"), new("Especial", "SPECIAL"), new("TV curta", "TV_SHORT")];
        foreach (var o in options) Formats.Add(o);
        Format = Formats[0];
    }

    private void Reload()
    {
        if (_ready) _ = RunAsync(LoadAsync);
    }
}
