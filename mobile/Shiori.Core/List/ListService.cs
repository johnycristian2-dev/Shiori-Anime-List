using System.Text.Json.Nodes;
using Shiori.Core.Auth;
using Shiori.Core.Supabase;

namespace Shiori.Core.List;

/// <summary>
/// Lê e grava a lista do usuário na tabela <c>user_data</c> (uma linha por usuário).
/// Para nunca apagar o que foi feito no site, TODA gravação segue: buscar o doc atual → aplicar a
/// mudança → gravar. Assim o que o site salvou enquanto o app estava aberto continua lá.
/// </summary>
public sealed class ListService
{
    private readonly SupabaseRest _rest;
    private readonly SemaphoreSlim _writeLock = new(1, 1);

    public ListService(HttpClient http, AuthService auth)
    {
        _rest = new SupabaseRest(http, auth);
        // trocou de conta: a lista guardada era da pessoa anterior
        auth.SignedOut += () => Cached = null;
    }

    /// <summary>Último doc lido (para as telas mostrarem sem esperar a rede).</summary>
    public ListDocument? Cached { get; private set; }

    /// <summary>Avisa as telas que a lista mudou (ex.: +1 no Detalhe atualiza a aba Minha lista).</summary>
    public event Action<ListDocument>? Changed;

    public async Task<ListDocument> LoadAsync()
    {
        var userId = await _rest.UserIdAsync();
        var rows = await _rest.SelectAsync("user_data", $"select=doc&user_id=eq.{userId}");
        var doc = ListDocument.Parse(rows.FirstOrDefault()?["doc"]);
        Cached = doc;
        return doc;
    }

    /// <summary>Aplica <paramref name="change"/> sobre a versão mais nova do servidor e grava.</summary>
    public async Task<ListDocument> UpdateAsync(Action<ListDocument> change)
    {
        await _writeLock.WaitAsync();
        try
        {
            var doc = await LoadAsync();
            change(doc);
            await _rest.UpsertAsync("user_data", new JsonObject
            {
                ["user_id"] = await _rest.UserIdAsync(),
                ["doc"] = doc.ToJson(),
                ["device"] = "app",
                ["updated_at"] = DateTimeOffset.UtcNow.ToString("O"),
            }, "Não foi possível salvar sua lista. Tente de novo.");
            Cached = doc;
            Changed?.Invoke(doc);
            return doc;
        }
        finally { _writeLock.Release(); }
    }

    /// <summary>Hora atual em milissegundos (o formato de <c>updatedAt</c> no site).</summary>
    public static long Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}
