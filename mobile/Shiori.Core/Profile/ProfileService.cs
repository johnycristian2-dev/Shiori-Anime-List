using Shiori.Core.Auth;
using Shiori.Core.Supabase;

namespace Shiori.Core.Profile;

/// <summary>Perfil público do usuário (tabela <c>profiles</c>; a chave é a coluna <c>user_id</c>).</summary>
public sealed record Profile(string UserId, string Username, string? DisplayName, string? AvatarUrl)
{
    public string Name => string.IsNullOrWhiteSpace(DisplayName) ? Username : DisplayName;
}

public sealed class ProfileService(HttpClient http, AuthService auth)
{
    private readonly SupabaseRest _rest = new(http, auth);

    /// <summary>Meu perfil, ou null se ainda não criei um no site.</summary>
    public async Task<Profile?> GetMineAsync()
    {
        var userId = await _rest.UserIdAsync();
        var rows = await _rest.SelectAsync("profiles", $"select=user_id,username,display_name,avatar_url&user_id=eq.{userId}");
        var row = rows.FirstOrDefault();
        if (row is null) return null;
        return new Profile(
            (string)row["user_id"]!,
            (string?)row["username"] ?? "",
            (string?)row["display_name"],
            (string?)row["avatar_url"]);
    }
}
