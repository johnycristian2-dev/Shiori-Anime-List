namespace Shiori.Core.List;

/// <summary>Status de um item na lista (mesmos valores gravados pelo site).</summary>
public enum ListStatus { WATCHING, PLANNING, COMPLETED, PAUSED, DROPPED }

/// <summary>Rótulos e cores de cada status — iguais aos do site (src/store/list.ts).</summary>
public static class ListStatusInfo
{
    public static readonly ListStatus[] Order =
        [ListStatus.WATCHING, ListStatus.PLANNING, ListStatus.COMPLETED, ListStatus.PAUSED, ListStatus.DROPPED];

    public static string Label(ListStatus s) => s switch
    {
        ListStatus.WATCHING => "Assistindo",
        ListStatus.PLANNING => "Quero ver",
        ListStatus.COMPLETED => "Completo",
        ListStatus.PAUSED => "Pausado",
        ListStatus.DROPPED => "Dropado",
        _ => s.ToString(),
    };

    public static string Color(ListStatus s) => s switch
    {
        ListStatus.WATCHING => "#3de2ff",
        ListStatus.PLANNING => "#ffe14d",
        ListStatus.COMPLETED => "#7cff8a",
        ListStatus.PAUSED => "#b98cff",
        ListStatus.DROPPED => "#ff6b6b",
        _ => "#a59fca",
    };
}
