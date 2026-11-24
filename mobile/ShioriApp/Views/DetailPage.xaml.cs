using ShioriApp.ViewModels;

namespace ShioriApp.Views;

/// <summary>Detalhe nativo. O id chega pela navegação ("detail" com parâmetro "id").</summary>
public partial class DetailPage : ContentPage, IQueryAttributable
{
    private readonly DetailViewModel _vm;

    public DetailPage(DetailViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query) => _vm.ApplyQueryAttributes(query);
}
