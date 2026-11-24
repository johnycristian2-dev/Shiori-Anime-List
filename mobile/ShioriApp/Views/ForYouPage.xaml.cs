using ShioriApp.ViewModels;

namespace ShioriApp.Views;

public partial class ForYouPage : ContentPage
{
    private readonly ForYouViewModel _vm;

    public ForYouPage(ForYouViewModel vm)
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
