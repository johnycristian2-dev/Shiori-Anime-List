using ShioriApp.ViewModels;

namespace ShioriApp.Views;

/// <summary>O id chega pela navegação (parâmetro "id").</summary>
public partial class CharacterPage : ContentPage, IQueryAttributable
{
    private readonly CharacterViewModel _vm;

    public CharacterPage(CharacterViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query) => _vm.Open(Convert.ToInt32(query["id"]));
}
