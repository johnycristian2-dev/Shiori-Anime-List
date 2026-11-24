using System.Text;
using Shiori.Core.Web;

namespace Shiori.Core.Tests;

public class WebBridgeTests
{
    [Fact]
    public void InjectScript_WritesSessionAndGoesToRoute()
    {
        var json = Sessions.Json(access: "a\"b</script>");
        var script = WebBridge.BuildInjectScript(json, "/calendario");

        Assert.Contains($"localStorage.setItem(\"{Config.SessionStorageKey}\"", script);
        Assert.Contains("location.replace(\"/calendario\")", script);
        // o JSON vai como string JS escapada: aspas e </script> não quebram o script
        Assert.DoesNotContain("a\"b", script);
        Assert.DoesNotContain("</script>", script);
    }

    [Theory]
    [InlineData("/jogos", "/jogos")]
    [InlineData("jogos", "/jogos")]
    [InlineData("/u/fulano?tab=2", "/u/fulano?tab=2")]
    [InlineData("https://evil.com/x", "/")]
    [InlineData("//evil.com", "/")]
    [InlineData("javascript:alert(1)", "/")]
    [InlineData("", "/")]
    public void SafeRoute_OnlyRelativePaths(string input, string expected)
    {
        Assert.Equal(expected, WebBridge.SafeRoute(input));
    }

    [Fact]
    public void ReadResult_DecodesBase64FromAnyPlatform()
    {
        var json = Sessions.Json(email: "ção@shiori.app");
        var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(json));

        Assert.Equal(json, WebBridge.DecodeReadResult(b64));          // Windows devolve a string pura
        Assert.Equal(json, WebBridge.DecodeReadResult($"\"{b64}\""));  // Android devolve entre aspas
        Assert.Null(WebBridge.DecodeReadResult(null));
        Assert.Null(WebBridge.DecodeReadResult("null"));
        Assert.Null(WebBridge.DecodeReadResult(""));
        Assert.Null(WebBridge.DecodeReadResult("%%%"));
    }

    [Theory]
    [InlineData("https://shiori-anime-list.vercel.app/jogos", true)]
    [InlineData("https://shiori-anime-list.vercel.app", true)]
    [InlineData("https://www.crunchyroll.com/watch/X", false)]
    [InlineData("https://shiori-anime-list.vercel.app.evil.com/", false)]
    [InlineData("about:blank", true)]
    public void IsSiteUrl(string url, bool expected)
    {
        Assert.Equal(expected, WebBridge.IsSiteUrl(url));
    }

    [Fact]
    public void Sections_CoverEveryNonNativeRoute()
    {
        string[] expected = ["/explorar", "/swipe", "/calendario", "/pra-voce", "/roleta", "/amigos", "/chat", "/party",
            "/maratona", "/retrospectiva", "/comparar", "/jogos", "/liga", "/temas", "/apoiar", "/feedback", "/sync",
            "/roadmap", "/perfil/editar", "/moderacao", "/termos", "/privacidade"];
        var routes = SiteSections.All.Select(s => s.Route).ToArray();
        Assert.Equal(expected.Order(), routes.Order());
        Assert.All(SiteSections.All, s =>
        {
            Assert.False(string.IsNullOrWhiteSpace(s.Title));
            Assert.False(string.IsNullOrWhiteSpace(s.Description));
            Assert.False(string.IsNullOrWhiteSpace(s.Group));
        });
    }
    [Fact]
    public void Sections_NativeScreensAreMarked()
    {
        var native = SiteSections.All.Where(s => s.IsNative).ToDictionary(s => s.Route, s => s.NativeRoute);
        Assert.Equal(new Dictionary<string, string?>
        {
            ["/explorar"] = "explore", ["/swipe"] = "swipe", ["/calendario"] = "calendar", ["/pra-voce"] = "foryou", ["/roleta"] = "roulette",
        }, native);
    }

    [Fact]
    public void InjectScript_ClearsSiteDataOnlyWhenAsked()
    {
        var json = Sessions.Json();
        var clear = WebBridge.BuildInjectScript(json, "/", clearSiteData: true);
        Assert.StartsWith("localStorage.clear();", clear);
        Assert.DoesNotContain("localStorage.clear()", WebBridge.BuildInjectScript(json, "/"));
    }
}
