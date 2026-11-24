using ShioriApp.ViewModels;

namespace ShioriApp.Views;

public partial class MorePage : ContentPage
{
    public MorePage(MoreViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
