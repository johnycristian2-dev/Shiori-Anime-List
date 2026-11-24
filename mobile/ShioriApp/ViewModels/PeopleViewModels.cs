using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.AniList;

namespace ShioriApp.ViewModels;

/// <summary>Uma linha de informação ("Aniversário: 1/12").</summary>
public sealed record InfoItem(string Label, string Value);

/// <summary>Personagem: foto, nomes, dados, descrição, em que animes aparece e quem dubla.</summary>
public partial class CharacterViewModel(AniListClient anilist) : BaseViewModel
{
    private int _id;

    [ObservableProperty]
    public partial CharacterDetail? Character { get; set; }

    public ObservableCollection<InfoItem> Info { get; } = [];

    public void Open(int id)
    {
        _id = id;
        _ = RunAsync(LoadAsync);
    }

    protected override async Task LoadAsync()
    {
        var c = await anilist.CharacterAsync(_id);
        Info.Clear();
        if (c.AlternativeNames.Length > 0) Info.Add(new("Também chamado", string.Join(", ", c.AlternativeNames.Take(3))));
        if (c.Birthday is { } b) Info.Add(new("Aniversário", b));
        if (c.Age is { } a) Info.Add(new("Idade", a));
        if (c.Gender is { } g) Info.Add(new("Gênero", g switch { "Female" => "Feminino", "Male" => "Masculino", _ => g }));
        if (c.Favourites is { } f) Info.Add(new("Favoritos no AniList", f.ToString("N0")));
        Character = c;
    }

    [RelayCommand]
    private Task OpenMediaAsync(CharacterAppearance a) => Navigation.OpenDetailAsync(a.Media.Id);

    [RelayCommand]
    private Task OpenVoiceActorAsync(CharacterAppearance a) =>
        a.VoiceActor is { } va ? Navigation.OpenStaffAsync(va.Id) : Task.CompletedTask;
}

/// <summary>Dublador: foto, dados e os personagens que fez (com o anime).</summary>
public partial class StaffViewModel(AniListClient anilist) : BaseViewModel
{
    private int _id;
    private int _page = 1;

    [ObservableProperty]
    public partial StaffDetail? Staff { get; set; }

    [ObservableProperty]
    public partial bool HasMore { get; set; }

    public ObservableCollection<StaffRole> Roles { get; } = [];
    public ObservableCollection<InfoItem> Info { get; } = [];

    public void Open(int id)
    {
        _id = id;
        _ = RunAsync(LoadAsync);
    }

    protected override async Task LoadAsync()
    {
        _page = 1;
        var s = await anilist.StaffAsync(_id, _page);
        Info.Clear();
        if (s.NativeName is { } n) Info.Add(new("Nome original", n));
        if (s.HomeTown is { } h) Info.Add(new("Cidade natal", h));
        if (s.Favourites is { } f) Info.Add(new("Favoritos no AniList", f.ToString("N0")));
        Roles.Clear();
        foreach (var r in s.Roles) Roles.Add(r);
        HasMore = s.HasMoreRoles;
        Staff = s;
    }

    [RelayCommand]
    private Task LoadMoreAsync() => HasMore ? RunAsync(async () =>
    {
        var s = await anilist.StaffAsync(_id, ++_page);
        foreach (var r in s.Roles) Roles.Add(r);
        HasMore = s.HasMoreRoles;
    }) : Task.CompletedTask;

    [RelayCommand]
    private Task OpenMediaAsync(StaffRole r) => Navigation.OpenDetailAsync(r.Media.Id);

    [RelayCommand]
    private Task OpenCharacterAsync(StaffRole r) =>
        r.Character is { } c ? Navigation.OpenCharacterAsync(c.Id) : Task.CompletedTask;
}

/// <summary>Estúdio: nome e obras, mais populares primeiro, com "carregar mais".</summary>
public partial class StudioViewModel(AniListClient anilist) : BaseViewModel
{
    private int _id;
    private int _page = 1;

    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial bool HasMore { get; set; }

    public ObservableCollection<MediaSummary> Works { get; } = [];

    public void Open(int id)
    {
        _id = id;
        _ = RunAsync(LoadAsync);
    }

    protected override async Task LoadAsync()
    {
        _page = 1;
        var s = await anilist.StudioAsync(_id, _page);
        Name = s.Name;
        Works.Clear();
        foreach (var m in s.Works) Works.Add(m);
        HasMore = s.HasNextPage;
    }

    [RelayCommand]
    private Task LoadMoreAsync() => HasMore ? RunAsync(async () =>
    {
        var s = await anilist.StudioAsync(_id, ++_page);
        foreach (var m in s.Works) Works.Add(m);
        HasMore = s.HasNextPage;
    }) : Task.CompletedTask;

    [RelayCommand]
    private Task OpenMediaAsync(int id) => Navigation.OpenDetailAsync(id);
}
