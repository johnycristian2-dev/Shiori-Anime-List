using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core;
using Shiori.Core.Auth;
using Shiori.Core.Web;

namespace ShioriApp.ViewModels;

/// <summary>Tela de Login: e-mail e senha da mesma conta do site.</summary>
public partial class LoginViewModel(AuthService auth) : BaseViewModel
{
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignInCommand))]
    public partial string Email { get; set; } = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignInCommand))]
    public partial string Password { get; set; } = "";

    private bool CanSignIn() => Email.Contains('@') && Password.Length > 0;

    [RelayCommand(CanExecute = nameof(CanSignIn))]
    private Task SignInAsync() => RunAsync(async () =>
    {
        await auth.SignInAsync(Email, Password);
        Password = "";
        await Shell.Current.GoToAsync("//home");
    });

    /// <summary>Cadastro e "esqueci a senha" ficam no site (têm captcha e confirmação por e-mail).</summary>
    [RelayCommand]
    private Task CreateAccountAsync() => Browser.Default.OpenAsync(WebBridge.SiteAddress("/perfil"), BrowserLaunchMode.SystemPreferred);

    [RelayCommand]
    private Task ForgotPasswordAsync() => Browser.Default.OpenAsync(WebBridge.SiteAddress("/perfil"), BrowserLaunchMode.SystemPreferred);
}
