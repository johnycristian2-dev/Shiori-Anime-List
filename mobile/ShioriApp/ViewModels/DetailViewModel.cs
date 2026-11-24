using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core;
using Shiori.Core.AniList;
using Shiori.Core.Display;
using Shiori.Core.List;

namespace ShioriApp.ViewModels;

/// <summary>Um botão de status no Detalhe (Assistindo, Quero ver…), marcado quando é o atual.</summary>
public sealed record StatusChoice(ListStatus Status, string Label, Color Color, bool Selected);

/// <summary>
/// Detalhe de um anime/mangá: dados do AniList + o que está na sua lista.
/// Cada botão (status, +1, nota, favorito, remover) grava pela <see cref="ListService"/>,
/// que sempre relê a lista do servidor antes de salvar.
/// </summary>
public partial class DetailViewModel(AniListClient anilist, ListService list) : BaseViewModel, IQueryAttributable
{
    private int _id;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Summary), nameof(NotInList), nameof(Subtitle), nameof(NextEpisodeText), nameof(HasNextEpisode), nameof(Studios))]
    public partial MediaDetail? Detail { get; set; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(InList), nameof(NotInList), nameof(ProgressText), nameof(ScoreText), nameof(FavoriteText))]
    public partial ListEntryView? Entry { get; set; }

    [ObservableProperty]
    public partial bool IsSaving { get; set; }

    public ObservableCollection<StatusChoice> StatusChoices { get; } = [];

    public MediaSummary? Summary => Detail?.Summary;
    public bool InList => Entry is not null;
    public bool NotInList => Entry is null && Detail is not null;
    public bool HasNextEpisode => Detail?.NextEpisode is not null;
    public string Studios => Detail is null ? "" : string.Join(", ", Detail.Studios);

    public string Subtitle => Detail is null ? "" : string.Join(" · ", new[]
    {
        Format.MediaFormat(Detail.Summary.Format),
        Detail.Summary.Year?.ToString() ?? "",
        Format.Status(Detail.Status),
        Detail.Summary.Total is { } t ? $"{t} {(Detail.Summary.IsManga ? "cap." : "eps")}" : "",
    }.Where(s => s.Length > 0));

    public string NextEpisodeText => Detail is { NextEpisode: { } ep, NextEpisodeAt: { } at }
        ? Format.NextEpisode(ep, at, DateTimeOffset.Now) : "";

    public string ProgressText => Entry is null ? "" : $"{(Entry.IsManga ? "Capítulo" : "Episódio")} {Entry.ProgressText}";
    public string ScoreText => Entry is null ? "" : Entry.Score == 0 ? "Sem nota" : $"Nota {Entry.Score}/10";
    public string FavoriteText => Entry?.Favorite == true ? "♥ Favorito" : "♡ Favoritar";

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        _id = Convert.ToInt32(query["id"]);
        _ = RunAsync(LoadAsync);
    }

    protected override async Task LoadAsync()
    {
        var detail = anilist.DetailAsync(_id);
        ListDocument? doc = null;
        try { doc = list.Cached ?? await list.LoadAsync(); }
        catch (ShioriException) { /* mostra o anime mesmo sem a lista */ }
        Detail = await detail;
        SetEntry(doc?.Get(_id));
    }

    [RelayCommand]
    private Task SetStatusAsync(ListStatus status) => SaveAsync(d =>
    {
        if (d.Get(_id) is null) d.Upsert(Detail!.Summary, status, ListService.Now());
        else d.SetStatus(_id, status, ListService.Now());
    });

    [RelayCommand]
    private Task IncrementAsync() => SaveAsync(d => d.SetProgress(_id, (d.Get(_id)?.Progress ?? 0) + 1, ListService.Now()));

    [RelayCommand]
    private Task DecrementAsync() => SaveAsync(d => d.SetProgress(_id, (d.Get(_id)?.Progress ?? 0) - 1, ListService.Now()));

    [RelayCommand]
    private Task ScoreUpAsync() => SaveAsync(d => d.SetScore(_id, (d.Get(_id)?.Score ?? 0) + 1, ListService.Now()));

    [RelayCommand]
    private Task ScoreDownAsync() => SaveAsync(d => d.SetScore(_id, (d.Get(_id)?.Score ?? 0) - 1, ListService.Now()));

    [RelayCommand]
    private Task ToggleFavoriteAsync() => SaveAsync(d => d.ToggleFavorite(_id, ListService.Now()));

    [RelayCommand]
    private async Task RemoveAsync()
    {
        var ok = await Shell.Current.DisplayAlertAsync("Remover da lista?", Summary?.DisplayTitle, "Remover", "Cancelar");
        if (ok) await SaveAsync(d => d.Remove(_id, ListService.Now()));
    }

    [RelayCommand]
    private Task OpenCharacterAsync(CharacterSummary c) => Navigation.OpenWebAsync($"/personagem/{c.Id}", c.Name);

    /// <summary>Página completa no site (relacionados, recomendações, reviews, trailers…).</summary>
    [RelayCommand]
    private Task OpenOnSiteAsync() =>
        Navigation.OpenWebAsync($"/{(Summary?.IsManga == true ? "manga" : "anime")}/{_id}", Summary?.DisplayTitle ?? "Shiori");

    private async Task SaveAsync(Action<ListDocument> change)
    {
        if (IsSaving || Detail is null) return;
        IsSaving = true;
        ErrorMessage = null;
        try { SetEntry((await list.UpdateAsync(change)).Get(_id)); }
        catch (ShioriException e) { ErrorMessage = e.Message; }
        finally { IsSaving = false; }
    }

    private void SetEntry(ListEntryView? entry)
    {
        Entry = entry;
        StatusChoices.Clear();
        foreach (var s in ListStatusInfo.Order)
            StatusChoices.Add(new StatusChoice(s, ListStatusInfo.Label(s), Color.FromArgb(ListStatusInfo.Color(s)), entry?.Status == s));
    }
}
