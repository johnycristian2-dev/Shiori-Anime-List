namespace Shiori.Core.Auth;

/// <summary>Onde a sessão fica guardada entre aberturas do app (no celular: SecureStorage).</summary>
public interface ISessionStore
{
    Task<string?> LoadAsync();
    Task SaveAsync(string json);
    Task ClearAsync();
}
