using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core.Web;

namespace ShioriApp.ViewModels;

/// <summary>Um grupo da aba Mais (Descobrir, Social, Jogos…), usado no CollectionView agrupado.</summary>
public sealed class SectionGroup(string name, IEnumerable<SiteSection> items) : ObservableCollection<SiteSection>(items)
{
    public string Name { get; } = name;
}

/// <summary>Aba "Mais": todas as funções do site que abrem na parte web.</summary>
public partial class MoreViewModel : BaseViewModel
{
    public IReadOnlyList<SectionGroup> Groups { get; } =
        SiteSections.All.GroupBy(s => s.Group).Select(g => new SectionGroup(g.Key, g)).ToList();

    [RelayCommand]
    private Task OpenAsync(SiteSection section) => Navigation.OpenWebAsync(section.Route, section.Title);
}
