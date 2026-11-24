using ShioriApp.ViewModels;

namespace ShioriApp.Views;

public partial class MyListPage : ContentPage
{
    private readonly MyListViewModel _vm;

    public MyListPage(MyListViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
    }

    /// <summary>Recarrega ao voltar para a aba (pode ter mudado no site ou no Detalhe).</summary>
    protected override void OnAppearing()
    {
        base.OnAppearing();
        _vm.RefreshCommand.Execute(null);
    }
}
