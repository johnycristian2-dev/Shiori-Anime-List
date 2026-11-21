import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { captureOAuthToken } from "./store/auth";
import { startCloudSync } from "./sync/cloud";
import { watchPreloadErrors } from "./lib/lazyPage";
import { watchErrors } from "./lib/errorLog";
import { getLang, loadLang } from "./lib/i18n";
import { wireAccount } from "./sync/account";
import { wireSocial } from "./sync/social";
import { startAniListSync } from "./sync/anilistSync";
import "./index.css";

// Links antigos com # (ex.: /#/anime/123) viram endereços normais (/anime/123)
if (window.location.hash.startsWith("#/")) {
  window.history.replaceState(null, "", window.location.hash.slice(1) || "/");
}
captureOAuthToken();
watchPreloadErrors();
watchErrors();
wireAccount();
wireSocial();
startCloudSync();
startAniListSync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: (count, err) =>
        (err as { status?: number })?.status !== 404 && count < 2,
    },
  },
});

void loadLang(getLang()).finally(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  ),
);
