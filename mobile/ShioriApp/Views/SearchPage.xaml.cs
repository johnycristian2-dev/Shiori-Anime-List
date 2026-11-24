using ShioriApp.ViewModels;

namespace ShioriApp.Views;

public partial class SearchPage : ContentPage
{
    public SearchPage(SearchViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
