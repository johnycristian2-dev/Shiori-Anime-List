using ShioriApp.ViewModels;

namespace ShioriApp.Views;

public partial class ExplorePage : ContentPage
{
    private readonly ExploreViewModel _vm;

    public ExplorePage(ExploreViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _vm.InitAsync();
    }
}
