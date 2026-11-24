namespace Shiori.Core.List;

/// <summary>Uma entrada da lista, só para leitura nas telas.</summary>
public sealed record ListEntryView(
    int MediaId,
    string Title,
    string? Cover,
    ListStatus Status,
    int Progress,
    int? Total,
    int Score,
    bool Favorite,
    string Type,
    long UpdatedAt)
{
    public bool IsManga => Type == "MANGA";

    /// <summary>"3/12" ou "3/?" quando o total ainda não é conhecido.</summary>
    public string ProgressText => $"{Progress}/{(Total?.ToString() ?? "?")}";
}
