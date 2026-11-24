using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Shiori.Core.Auth;

namespace Shiori.Core.Supabase;

/// <summary>
/// Chamadas à API REST do Supabase (PostgREST): <c>/rest/v1/&lt;tabela&gt;?filtros</c>.
/// Toda requisição leva a chave pública (<c>apikey</c>) e o token do usuário (<c>Authorization: Bearer</c>);
/// é o token que faz as políticas RLS deixarem cada um ver e gravar só os próprios dados.
/// </summary>
public sealed class SupabaseRest(HttpClient http, AuthService auth)
{
    /// <summary>GET em uma tabela. <paramref name="query"/> ex.: <c>select=doc&amp;user_id=eq.123</c>.</summary>
    public async Task<JsonArray> SelectAsync(string table, string query)
    {
        using var req = await NewRequestAsync(HttpMethod.Get, $"/rest/v1/{table}?{query}");
        var text = await SendAsync(req, "Não foi possível carregar seus dados. Tente de novo.");
        return JsonNode.Parse(text) as JsonArray ?? [];
    }

    /// <summary>Insere ou atualiza (upsert) pela chave primária da tabela.</summary>
    public async Task UpsertAsync(string table, JsonObject row, string errorMessage)
    {
        using var req = await NewRequestAsync(HttpMethod.Post, $"/rest/v1/{table}");
        req.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal");
        req.Content = JsonContent.Create(row);
        await SendAsync(req, errorMessage);
    }

    public async Task<string> UserIdAsync() => (await auth.GetValidSessionAsync()).UserId;

    private async Task<HttpRequestMessage> NewRequestAsync(HttpMethod method, string path)
    {
        var session = await auth.GetValidSessionAsync();
        var req = new HttpRequestMessage(method, Config.SupabaseUrl + path);
        req.Headers.Add("apikey", Config.SupabaseKey);
        req.Headers.Authorization = new("Bearer", session.AccessToken);
        return req;
    }

    private async Task<string> SendAsync(HttpRequestMessage req, string errorMessage)
    {
        HttpResponseMessage res;
        try { res = await http.SendAsync(req); }
        catch (HttpRequestException e) { throw new ShioriException(ShioriException.NoConnection, e); }
        catch (TaskCanceledException e) { throw new ShioriException(ShioriException.NoConnection, e); }
        using (res)
        {
            var text = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) throw new ShioriException(errorMessage);
            return text;
        }
    }
}
