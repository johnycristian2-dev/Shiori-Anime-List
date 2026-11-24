namespace Shiori.Core;

/// <summary>Erro com mensagem já pronta para mostrar na tela (em português).</summary>
public sealed class ShioriException(string message, Exception? inner = null) : Exception(message, inner)
{
    public const string NoConnection = "Sem conexão. Toque para tentar de novo.";
    public const string ServerTrouble = "O servidor está com problema. Tente de novo em instantes.";

    /// <summary>Código HTTP da resposta que causou o erro (null = sem resposta, ex.: sem internet).</summary>
    public int? StatusCode { get; init; }
}
