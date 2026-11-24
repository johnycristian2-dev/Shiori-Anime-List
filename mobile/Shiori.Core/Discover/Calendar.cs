using Shiori.Core.AniList;

namespace Shiori.Core.Discover;

/// <summary>Um dia na grade do calendário ("Hoje", "Amanhã", "Sexta, 27/11").</summary>
public sealed record AiringDay(DateOnly Date, string Label, IReadOnlyList<AiringItem> Items);

/// <summary>Regras da tela Calendário.</summary>
public static class Calendar
{
    private static readonly string[] WeekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    /// <summary>Agrupa os episódios pelo dia NO FUSO DO CELULAR, em ordem de horário.</summary>
    public static IReadOnlyList<AiringDay> GroupByDay(IEnumerable<AiringItem> items, TimeZoneInfo zone, DateTimeOffset now)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, zone).DateTime);
        return items
            .OrderBy(i => i.AiringAt)
            .GroupBy(i => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(i.AiringAt, zone).DateTime))
            .OrderBy(g => g.Key)
            .Select(g => new AiringDay(g.Key, Label(g.Key, today), g.ToList()))
            .ToList();
    }

    /// <summary>Só o que está na minha lista (filtro "Só os meus").</summary>
    public static IReadOnlyList<AiringItem> OnlyMine(IEnumerable<AiringItem> items, IReadOnlySet<int> myIds) =>
        items.Where(i => myIds.Contains(i.Media.Id)).ToList();

    /// <summary>Hora local do episódio, ex.: "22:30".</summary>
    public static string Time(DateTimeOffset at, TimeZoneInfo zone) => TimeZoneInfo.ConvertTime(at, zone).ToString("HH:mm");

    private static string Label(DateOnly day, DateOnly today)
    {
        if (day == today) return "Hoje";
        if (day == today.AddDays(1)) return "Amanhã";
        if (day == today.AddDays(-1)) return "Ontem";
        return $"{WeekDays[(int)day.DayOfWeek]}, {day:dd/MM}";
    }
}
