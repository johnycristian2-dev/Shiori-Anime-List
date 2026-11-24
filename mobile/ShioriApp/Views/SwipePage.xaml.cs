using ShioriApp.ViewModels;

namespace ShioriApp.Views;

/// <summary>
/// Swipe: a carta segue o dedo; soltando longe o bastante, decide (direita = Quero ver, esquerda = Pular).
/// As decisões em si ficam no ViewModel; aqui é só a animação.
/// </summary>
public partial class SwipePage : ContentPage
{
    private const double DecideDistance = 120;
    private readonly SwipeViewModel _vm;

    public SwipePage(SwipeViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
        _vm.Decided += OnDecided;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _vm.Init();
    }

    private void OnPan(object? sender, PanUpdatedEventArgs e)
    {
        switch (e.StatusType)
        {
            case GestureStatus.Running:
                Card.TranslationX = e.TotalX;
                Card.Rotation = e.TotalX / 20;
                WantStamp.Opacity = Math.Clamp(e.TotalX / DecideDistance, 0, 1);
                SkipStamp.Opacity = Math.Clamp(-e.TotalX / DecideDistance, 0, 1);
                break;
            case GestureStatus.Completed or GestureStatus.Canceled:
                if (Card.TranslationX > DecideDistance) _vm.WantCommand.Execute(null);
                else if (Card.TranslationX < -DecideDistance) _vm.SkipCommand.Execute(null);
                else _ = ResetAsync(animated: true);
                break;
        }
    }

    /// <summary>Joga a carta para o lado escolhido e traz a próxima do centro.</summary>
    private async void OnDecided(int direction)
    {
        try
        {
            var width = Math.Max(Width, 400);
            await Task.WhenAll(
                Card.TranslateToAsync(direction * width, direction == 0 ? -Height : Card.TranslationY, 220, Easing.CubicIn),
                Card.FadeToAsync(0, 220));
            await ResetAsync(animated: false);
            Card.Scale = 0.92;
            await Task.WhenAll(Card.FadeToAsync(1, 160), Card.ScaleToAsync(1, 160, Easing.CubicOut));
        }
        catch (Exception) { await ResetAsync(animated: false); }
    }

    private async Task ResetAsync(bool animated)
    {
        WantStamp.Opacity = SkipStamp.Opacity = 0;
        if (animated)
        {
            await Task.WhenAll(Card.TranslateToAsync(0, 0, 180, Easing.SpringOut), Card.RotateToAsync(0, 180));
            return;
        }
        Card.TranslationX = Card.TranslationY = Card.Rotation = 0;
        Card.Opacity = 1;
    }
}
