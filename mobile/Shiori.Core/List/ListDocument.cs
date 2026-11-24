using System.Text.Json.Nodes;
using Shiori.Core.AniList;

namespace Shiori.Core.List;

/// <summary>
/// A lista do usuário é UM documento JSON salvo na tabela <c>user_data.doc</c> (o mesmo que o site usa):
/// <code>
/// { "entries": { "154587": { mediaId, title, status, progress, score, updatedAt, ... } },
///   "deleted": { "99": 1700000000000 },   // removidos (lápide), para outro aparelho não "ressuscitar"
///   "lists": {...}, "skipped": [...], "history": [...], "gacha": {...} }
/// </code>
/// O site junta versões de aparelhos diferentes pela regra: em cada anime vence o <c>updatedAt</c> mais novo.
/// Por isso toda mudança aqui grava <c>updatedAt = agora</c> e mexe só na entrada alterada.
/// O documento é mantido como JsonObject para NÃO perder campos que o app não conhece.
/// </summary>
public sealed class ListDocument
{
    private const int HistoryMax = 4000; // igual ao site (HISTORY_MAX)
    private readonly JsonObject _root;

    private ListDocument(JsonObject root)
    {
        _root = root;
        _root["entries"] ??= new JsonObject();
        _root["deleted"] ??= new JsonObject();
        _root["lists"] ??= new JsonObject();
        _root["skipped"] ??= new JsonArray();
        _root["history"] ??= new JsonArray();
    }

    /// <summary>Lê o doc do banco. <c>null</c> (usuário novo) vira um doc vazio.</summary>
    public static ListDocument Parse(JsonNode? doc) =>
        new(doc is JsonObject obj ? (JsonObject)obj.DeepClone() : new JsonObject());

    private JsonObject EntriesNode => _root["entries"]!.AsObject();
    private JsonObject DeletedNode => _root["deleted"]!.AsObject();
    private JsonArray HistoryNode => _root["history"]!.AsArray();

    public IReadOnlyList<ListEntryView> Entries =>
        EntriesNode.Select(kv => ToView(kv.Value)).OfType<ListEntryView>().ToList();

    public ListEntryView? Get(int id) => ToView(EntriesNode[Key(id)]);

    /// <summary>Adiciona à lista ou muda o status (igual ao "add" do site).</summary>
    public void Upsert(MediaSummary media, ListStatus status, long now)
    {
        var key = Key(media.Id);
        if (EntriesNode[key] is JsonObject prev)
        {
            var wasCompleted = ReadStatus(prev) == ListStatus.COMPLETED;
            prev["status"] = status.ToString();
            if (status == ListStatus.COMPLETED && TotalOf(prev) is { } total) prev["progress"] = total;
            prev["updatedAt"] = now;
            if (status == ListStatus.COMPLETED && !wasCompleted) Log(media.Id, "done", now);
        }
        else
        {
            EntriesNode[key] = NewEntry(media, status, now);
            Log(media.Id, "add", now);
            if (status == ListStatus.COMPLETED) Log(media.Id, "done", now);
        }

        // voltou para a lista: tira a lápide e o "pulado"
        DeletedNode.Remove(key);
        var skipped = _root["skipped"]!.AsArray();
        foreach (var s in skipped.Where(n => (int?)n == media.Id).ToList()) skipped.Remove(s);
    }

    /// <summary>
    /// Muda o progresso, com as mesmas automações do site:
    /// começou a ver (Quero ver → Assistindo) e chegou no último episódio (→ Completo).
    /// </summary>
    public void SetProgress(int id, int progress, long now)
    {
        if (EntriesNode[Key(id)] is not JsonObject e) return;
        var before = Int(e["progress"]) ?? 0;
        var status = ReadStatus(e);
        var total = TotalOf(e);

        var next = Math.Max(0, total is { } t ? Math.Min(progress, t) : progress);
        e["progress"] = next;
        e["updatedAt"] = now;

        if (total is { } tot && next == tot && status != ListStatus.COMPLETED)
        {
            e["status"] = ListStatus.COMPLETED.ToString();
            Log(id, "done", now);
        }
        else if (next > 0 && status == ListStatus.PLANNING)
        {
            e["status"] = ListStatus.WATCHING.ToString();
        }
        if (next > before) Log(id, "ep", now, next - before);
    }

    /// <summary>
    /// Soma ao progresso SALVO (não ao que a tela mostrava): se o site andou enquanto o app estava aberto,
    /// o +1 parte do número novo e não desfaz o que foi feito lá.
    /// </summary>
    public void AddProgress(int id, int delta, long now)
    {
        if (Get(id) is { } entry) SetProgress(id, entry.Progress + delta, now);
    }

    /// <summary>Ids que a pessoa pulou no Swipe (o site guarda igual, em <c>skipped</c>).</summary>
    public IReadOnlyList<int> Skipped =>
        _root["skipped"]!.AsArray().Select(Int).OfType<int>().ToList();

    /// <summary>Pular no Swipe: não mostra mais esse título.</summary>
    public void Skip(int id)
    {
        if (Skipped.Contains(id)) return;
        _root["skipped"]!.AsArray().Add(id);
    }

    public void SetStatus(int id, ListStatus status, long now)
    {
        if (EntriesNode[Key(id)] is not JsonObject e) return;
        var was = ReadStatus(e);
        e["status"] = status.ToString();
        if (status == ListStatus.COMPLETED && TotalOf(e) is { } total) e["progress"] = total;
        e["updatedAt"] = now;
        if (status == ListStatus.COMPLETED && was != ListStatus.COMPLETED) Log(id, "done", now);
    }

    /// <summary>Nota de 0 (sem nota) a 10.</summary>
    public void SetScore(int id, int score, long now)
    {
        if (EntriesNode[Key(id)] is not JsonObject e) return;
        var value = Math.Clamp(score, 0, 10);
        var before = Int(e["score"]) ?? 0;
        e["score"] = value;
        e["updatedAt"] = now;
        if (value > 0 && value != before) Log(id, "score", now, value);
    }

    public void ToggleFavorite(int id, long now)
    {
        if (EntriesNode[Key(id)] is not JsonObject e) return;
        e["favorite"] = !((bool?)e["favorite"] ?? false);
        e["updatedAt"] = now;
    }

    /// <summary>Remove e deixa a lápide em <c>deleted</c>.</summary>
    public void Remove(int id, long now)
    {
        var key = Key(id);
        if (!EntriesNode.Remove(key)) return;
        DeletedNode[key] = now;
    }

    public JsonObject ToJson() => (JsonObject)_root.DeepClone();

    // ------------------------------------------------------------------

    private static string Key(int id) => id.ToString(System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>Mesmos campos que o <c>mediaToEntry</c> do site.</summary>
    private static JsonObject NewEntry(MediaSummary m, ListStatus status, long now)
    {
        var e = new JsonObject
        {
            ["mediaId"] = m.Id,
            ["idMal"] = m.IdMal,
            ["title"] = m.Title,
            ["titleEnglish"] = m.TitleEnglish,
            ["titleNative"] = m.TitleNative,
            ["cover"] = m.Cover,
            ["color"] = m.Color,
            ["format"] = m.Format,
            ["episodes"] = m.Episodes,
        };
        if (m.IsManga)
        {
            e["type"] = "MANGA";
            e["chapters"] = m.Chapters;
            e["volumes"] = m.Volumes;
            e["country"] = m.Country;
        }
        e["year"] = m.Year;
        e["genres"] = new JsonArray(m.Genres.Select(g => (JsonNode?)JsonValue.Create(g)).ToArray());
        e["averageScore"] = m.AverageScore;
        e["status"] = status.ToString();
        e["score"] = 0;
        e["progress"] = status == ListStatus.COMPLETED ? m.Total ?? 0 : 0;
        e["addedAt"] = now;
        e["updatedAt"] = now;
        return e;
    }

    private static int? TotalOf(JsonObject e) =>
        (string?)e["type"] == "MANGA" ? Int(e["chapters"]) : Int(e["episodes"]);

    /// <summary>Lê um número inteiro mesmo que tenha vindo como 7.5 ou 3.0 (listas importadas).</summary>
    private static int? Int(JsonNode? n) => Long(n) is { } v ? (int)v : null;

    private static long? Long(JsonNode? n)
    {
        if (n is not JsonValue v) return null;
        if (v.TryGetValue<int>(out var i)) return i;      // criado pelo app
        if (v.TryGetValue<long>(out var l)) return l;     // lido do banco
        if (v.TryGetValue<double>(out var d) && double.IsFinite(d)) return (long)Math.Round(d, MidpointRounding.AwayFromZero);
        return null;
    }

    private static ListStatus ReadStatus(JsonObject e) =>
        Enum.TryParse<ListStatus>((string?)e["status"], out var s) ? s : ListStatus.PLANNING;

    private static ListEntryView? ToView(JsonNode? node)
    {
        if (node is not JsonObject e || Int(e["mediaId"]) is not { } id) return null;
        return new ListEntryView(
            id,
            (string?)e["titleEnglish"] ?? (string?)e["title"] ?? "???",
            (string?)e["cover"],
            ReadStatus(e),
            Int(e["progress"]) ?? 0,
            TotalOf(e),
            Int(e["score"]) ?? 0,
            (bool?)e["favorite"] ?? false,
            (string?)e["type"] ?? "ANIME",
            Long(e["updatedAt"]) ?? 0);
    }

    /// <summary>Histórico usado pela Retrospectiva do site.</summary>
    private void Log(int id, string type, long at, int? value = null)
    {
        var ev = new JsonObject { ["m"] = id, ["t"] = type, ["at"] = at };
        if (value is { } v) ev["v"] = v;
        HistoryNode.Add(ev);
        while (HistoryNode.Count > HistoryMax) HistoryNode.RemoveAt(0);
    }
}
