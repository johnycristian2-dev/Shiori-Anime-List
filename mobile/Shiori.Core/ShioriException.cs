namespace Shiori.Core;

/// <summary>Erro com mensagem já pronta para mostrar na tela (em português).</summary>
public sealed class ShioriException(string message, Exception? inner = null) : Exception(message, inner)
{
    public const string NoConnection = "Sem conexão. Toque para tentar de novo.";
}
