using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Shiori.Core;

namespace ShioriApp.ViewModels;

/// <summary>
/// Base de todas as telas: carregando, mensagem de erro e "tentar de novo".
/// [ObservableProperty] gera a propriedade e avisa a tela (binding) quando ela muda.
/// </summary>
public abstract partial class BaseViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    public partial string? ErrorMessage { get; set; }

    [ObservableProperty]
    public partial bool IsLoading { get; set; }

    public bool HasError => !string.IsNullOrEmpty(ErrorMessage);

    /// <summary>O que a tela recarrega ao tocar em "tentar de novo".</summary>
    protected virtual Task LoadAsync() => Task.CompletedTask;

    [RelayCommand]
    private Task RetryAsync() => RunAsync(LoadAsync);

    /// <summary>Roda uma ação mostrando carregando e transformando erros em mensagem na tela.</summary>
    protected async Task RunAsync(Func<Task> action)
    {
        if (IsLoading) return;
        IsLoading = true;
        ErrorMessage = null;
        try { await action(); }
        catch (ShioriException e) { ErrorMessage = e.Message; }
        catch (Exception) { ErrorMessage = "Algo deu errado. Tente de novo."; }
        finally { IsLoading = false; }
    }
}
