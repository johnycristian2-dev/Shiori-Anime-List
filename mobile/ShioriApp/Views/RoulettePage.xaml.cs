using ShioriApp.ViewModels;

namespace ShioriApp.Views;

public partial class RoulettePage : ContentPage
{
    private readonly RouletteViewModel _vm;

    public RoulettePage(RouletteViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
        _vm.PropertyChanged += async (_, e) =>
        {
            // o dado gira enquanto a roleta corre
            if (e.PropertyName == nameof(RouletteViewModel.IsSpinning) && _vm.IsSpinning)
                await Dice.RotateToAsync(Dice.Rotation + 720, 900, Easing.CubicOut);
        };
        _vm.Spun += async () =>
        {
            Result.Scale = 0.9;
            await Result.ScaleToAsync(1, 250, Easing.SpringOut);
        };
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _vm.InitAsync();
    }
}
