using ShioriApp.ViewModels;

namespace ShioriApp.Views;

/// <summary>O apelido chega pela navegação (parâmetro "username").</summary>
public partial class PublicProfilePage : ContentPage, IQueryAttributable
{
    private readonly PublicProfileViewModel _vm;

    public PublicProfilePage(PublicProfileViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query) => _vm.Open(query["username"] as string ?? "");
}
