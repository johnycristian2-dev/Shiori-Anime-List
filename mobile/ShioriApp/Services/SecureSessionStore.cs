using Shiori.Core.Auth;

namespace ShioriApp.Services;

/// <summary>
/// Guarda a sessão no armazenamento seguro do aparelho
/// (Android: Keystore; Windows: armazenamento protegido; iOS: Keychain).
/// </summary>
public sealed class SecureSessionStore : ISessionStore
{
    private const string Key = "shiori-session";

    public async Task<string?> LoadAsync()
    {
        try { return await SecureStorage.Default.GetAsync(Key); }
        catch (Exception)
        {
            // Pode falhar se o Android trocou a chave (ex.: backup restaurado): começa deslogado.
            SecureStorage.Default.Remove(Key);
            return null;
        }
    }

    public Task SaveAsync(string json) => SecureStorage.Default.SetAsync(Key, json);

    public Task ClearAsync()
    {
        SecureStorage.Default.Remove(Key);
        return Task.CompletedTask;
    }
}
