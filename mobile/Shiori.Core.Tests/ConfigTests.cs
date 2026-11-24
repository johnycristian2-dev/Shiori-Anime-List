using Shiori.Core;

namespace Shiori.Core.Tests;

public class ConfigTests
{
    [Fact]
    public void SiteUrl_IsProduction()
    {
        Assert.Equal("https://shiori-anime-list.vercel.app", Config.SiteUrl);
        Assert.Equal("sb-ahtalxodwxzmjltbxmaz-auth-token", Config.SessionStorageKey);
    }
}
