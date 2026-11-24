using System.Text.Json.Nodes;
using Shiori.Core.AniList;
using Shiori.Core.List;

namespace Shiori.Core.Tests;

public class ListDocumentTests
{
    private const long T0 = 1_700_000_000_000;

    private static MediaSummary Frieren(int? episodes = 28) => new(
        Id: 154587, IdMal: 52991, Title: "Sousou no Frieren", TitleEnglish: "Frieren: Beyond Journey's End", TitleNative: "葬送のフリーレン",
        Cover: "https://img/frieren.jpg", Color: "#e4c9a1", Format: "TV", Episodes: episodes, Chapters: null, Volumes: null,
        Country: "JP", Year: 2023, Genres: ["Adventure", "Drama"], AverageScore: 91, Type: "ANIME");

    private static MediaSummary Berserk() => new(
        Id: 30002, IdMal: 2, Title: "Berserk", TitleEnglish: "Berserk", TitleNative: "ベルセルク",
        Cover: "https://img/berserk.jpg", Color: null, Format: "MANGA", Episodes: null, Chapters: null, Volumes: null,
        Country: "JP", Year: null, Genres: ["Action"], AverageScore: 93, Type: "MANGA");

    private const string SiteDoc = """
    {
      "entries": {
        "21": { "mediaId": 21, "title": "One Piece", "cover": "c.jpg", "status": "WATCHING", "progress": 1000,
                "episodes": null, "score": 9, "favorite": true, "notes": "minha nota", "addedAt": 1, "updatedAt": 5 }
      },
      "deleted": { "99": 10 },
      "lists": { "l1": { "id": "l1", "name": "Top", "emoji": "🔥", "mediaIds": [21], "updatedAt": 3 } },
      "skipped": [7],
      "history": [ { "m": 21, "t": "add", "at": 1 } ],
      "gacha": { "pulls": 3 }
    }
    """;

    [Fact]
    public void Parse_ReadsEntries()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));

        var e = Assert.Single(doc.Entries);
        Assert.Equal(new ListEntryView(21, "One Piece", "c.jpg", ListStatus.WATCHING, 1000, null, 9, true, "ANIME", 5), e);
        Assert.Equal(e, doc.Get(21));
        Assert.Null(doc.Get(1));
    }

    [Fact]
    public void MissingDoc_CreatesEmpty()
    {
        var json = ListDocument.Parse(null).ToJson();
        Assert.Empty(json["entries"]!.AsObject());
        Assert.Empty(json["deleted"]!.AsObject());
        Assert.Empty(json["lists"]!.AsObject());
        Assert.Empty(json["skipped"]!.AsArray());
        Assert.Empty(json["history"]!.AsArray());
    }

    [Fact]
    public void Upsert_NewEntry_HasSiteFields()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(Frieren(), ListStatus.PLANNING, T0);

        var e = doc.ToJson()["entries"]!["154587"]!;
        Assert.Equal(154587, (int)e["mediaId"]!);
        Assert.Equal(52991, (int)e["idMal"]!);
        Assert.Equal("Sousou no Frieren", (string)e["title"]!);
        Assert.Equal("Frieren: Beyond Journey's End", (string)e["titleEnglish"]!);
        Assert.Equal("葬送のフリーレン", (string)e["titleNative"]!);
        Assert.Equal("https://img/frieren.jpg", (string)e["cover"]!);
        Assert.Equal("#e4c9a1", (string)e["color"]!);
        Assert.Equal("TV", (string)e["format"]!);
        Assert.Equal(28, (int)e["episodes"]!);
        Assert.Equal(2023, (int)e["year"]!);
        Assert.Equal(["Adventure", "Drama"], e["genres"]!.AsArray().Select(g => (string)g!));
        Assert.Equal(91, (int)e["averageScore"]!);
        Assert.Equal("PLANNING", (string)e["status"]!);
        Assert.Equal(0, (int)e["score"]!);
        Assert.Equal(0, (int)e["progress"]!);
        Assert.Equal(T0, (long)e["addedAt"]!);
        Assert.Equal(T0, (long)e["updatedAt"]!);
        Assert.Null(e["type"]);
        Assert.Contains(doc.ToJson()["history"]!.AsArray(), h => (string)h!["t"]! == "add" && (int)h["m"]! == 154587);
    }

    [Fact]
    public void Upsert_Manga_HasTypeAndChapters()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(Berserk(), ListStatus.WATCHING, T0);
        var e = doc.ToJson()["entries"]!["30002"]!;
        Assert.Equal("MANGA", (string)e["type"]!);
        Assert.True(e.AsObject().ContainsKey("chapters"));
        Assert.Equal("MANGA", doc.Get(30002)!.Type);
    }

    [Fact]
    public void Upsert_Completed_SetsProgressToTotal()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(Frieren(), ListStatus.COMPLETED, T0);
        Assert.Equal(28, doc.Get(154587)!.Progress);
    }

    [Fact]
    public void Upsert_Existing_KeepsProgressAndScore()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        var onePiece = Frieren() with { Id = 21, Title = "One Piece", Episodes = null };
        doc.Upsert(onePiece, ListStatus.PAUSED, T0);
        var e = doc.Get(21)!;
        Assert.Equal(ListStatus.PAUSED, e.Status);
        Assert.Equal(1000, e.Progress);
        Assert.Equal(9, e.Score);
        Assert.Equal(T0, e.UpdatedAt);
        Assert.Equal("minha nota", (string)doc.ToJson()["entries"]!["21"]!["notes"]!);
    }

    [Fact]
    public void SetProgress_Clamps()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(Frieren(), ListStatus.PLANNING, T0);

        doc.SetProgress(154587, -3, T0 + 1);
        Assert.Equal(0, doc.Get(154587)!.Progress);

        doc.SetProgress(154587, 5, T0 + 2);
        Assert.Equal(5, doc.Get(154587)!.Progress);
        Assert.Equal(ListStatus.WATCHING, doc.Get(154587)!.Status); // começou a ver → Assistindo

        doc.SetProgress(154587, 99, T0 + 3);
        Assert.Equal(28, doc.Get(154587)!.Progress);
        Assert.Equal(ListStatus.COMPLETED, doc.Get(154587)!.Status); // último episódio → Completo
        Assert.Equal(T0 + 3, doc.Get(154587)!.UpdatedAt);
    }

    [Fact]
    public void SetProgress_UnknownTotal_NoUpperClamp()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        doc.SetProgress(21, 1001, T0);
        Assert.Equal(1001, doc.Get(21)!.Progress);
        Assert.Equal(ListStatus.WATCHING, doc.Get(21)!.Status);
        Assert.Contains(doc.ToJson()["history"]!.AsArray(), h => (string)h!["t"]! == "ep" && (int)h["v"]! == 1);
    }

    [Fact]
    public void SetStatus_Completed_FillsProgress()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(Frieren(), ListStatus.WATCHING, T0);
        doc.SetStatus(154587, ListStatus.COMPLETED, T0 + 1);
        Assert.Equal(28, doc.Get(154587)!.Progress);
        Assert.Contains(doc.ToJson()["history"]!.AsArray(), h => (string)h!["t"]! == "done");
    }

    [Fact]
    public void SetScore_ClampsAndLogs()
    {
        var doc = ListDocument.Parse(null);
        doc.Upsert(Frieren(), ListStatus.WATCHING, T0);
        doc.SetScore(154587, 15, T0 + 1);
        Assert.Equal(10, doc.Get(154587)!.Score);
        doc.SetScore(154587, -1, T0 + 2);
        Assert.Equal(0, doc.Get(154587)!.Score);
    }

    [Fact]
    public void ToggleFavorite_Flips()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        doc.ToggleFavorite(21, T0);
        Assert.False(doc.Get(21)!.Favorite);
        Assert.Equal(T0, doc.Get(21)!.UpdatedAt);
    }

    [Fact]
    public void UnknownFields_Preserved()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        doc.SetProgress(21, 1001, T0);
        var json = doc.ToJson();

        Assert.Equal("Top", (string)json["lists"]!["l1"]!["name"]!);
        Assert.Equal(3, (int)json["gacha"]!["pulls"]!);
        Assert.Equal(7, (int)json["skipped"]![0]!);
        Assert.Equal("minha nota", (string)json["entries"]!["21"]!["notes"]!);
        Assert.Equal(10, (long)json["deleted"]!["99"]!);
    }

    [Fact]
    public void Remove_AddsTombstone()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        doc.Remove(21, T0);
        var json = doc.ToJson();
        Assert.Null(json["entries"]!["21"]);
        Assert.Equal(T0, (long)json["deleted"]!["21"]!);
        Assert.Null(doc.Get(21));
    }

    [Fact]
    public void ReAdd_AfterDelete_ClearsTombstone()
    {
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        doc.Upsert(Frieren() with { Id = 99 }, ListStatus.WATCHING, T0);
        var json = doc.ToJson();
        Assert.Null(json["deleted"]!["99"]);
        Assert.True((long)json["entries"]!["99"]!["updatedAt"]! > 10);
    }

    [Fact]
    public void Changes_OnMissingEntry_AreIgnored()
    {
        var doc = ListDocument.Parse(null);
        doc.SetProgress(1, 3, T0);
        doc.SetStatus(1, ListStatus.DROPPED, T0);
        doc.ToggleFavorite(1, T0);
        doc.Remove(1, T0);
        Assert.Empty(doc.Entries);
    }

    [Fact]
    public void StatusInfo_MatchesSite()
    {
        Assert.Equal([ListStatus.WATCHING, ListStatus.PLANNING, ListStatus.COMPLETED, ListStatus.PAUSED, ListStatus.DROPPED], ListStatusInfo.Order);
        Assert.Equal("Quero ver", ListStatusInfo.Label(ListStatus.PLANNING));
        Assert.Equal("#ff6b6b", ListStatusInfo.Color(ListStatus.DROPPED));
    }
    [Fact]
    public void AddProgress_UsesStoredProgress()
    {
        // O site já foi para o ep 1000; a tela do app ainda mostrava outro número. +1 tem que dar 1001.
        var doc = ListDocument.Parse(JsonNode.Parse(SiteDoc));
        doc.AddProgress(21, +1, T0);
        Assert.Equal(1001, doc.Get(21)!.Progress);
        doc.AddProgress(999, +1, T0); // não está na lista: nada acontece
        Assert.Null(doc.Get(999));
    }

    [Fact]
    public void ToView_ToleratesDecimalNumbers()
    {
        var doc = ListDocument.Parse(JsonNode.Parse("""
            { "entries": { "5": { "mediaId": 5, "title": "A", "status": "WATCHING", "progress": 3.0, "score": 7.5, "episodes": 12.0, "updatedAt": 1.7e12 } } }
            """));
        var e = Assert.Single(doc.Entries);
        Assert.Equal(8, e.Score);
        Assert.Equal(3, e.Progress);
        Assert.Equal(12, e.Total);
        Assert.Equal(1_700_000_000_000, e.UpdatedAt);
        doc.SetProgress(5, 4, T0); // e também dá para mexer nela
        Assert.Equal(4, doc.Get(5)!.Progress);
    }
}
