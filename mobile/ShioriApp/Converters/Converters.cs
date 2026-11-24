using System.Globalization;
using Shiori.Core.List;

namespace ShioriApp.Converters;

/// <summary>true → false e vice-versa (ex.: esconder o botão enquanto carrega).</summary>
public sealed class InvertBoolConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value is not true;
    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => value is not true;
}

/// <summary>true quando o valor existe (texto não vazio ou objeto não nulo).</summary>
public sealed class NotNullConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is string s ? !string.IsNullOrWhiteSpace(s) : value is not null;
    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}

/// <summary>Status da lista → cor do status (mesmas do site).</summary>
public sealed class StatusColorConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is ListStatus s ? Color.FromArgb(ListStatusInfo.Color(s)) : Color.FromArgb("#a59fca");
    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}
