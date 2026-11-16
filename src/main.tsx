import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { captureOAuthToken } from './store/auth';
import { startCloudSync } from './sync/cloud';
import { wireAccount } from './sync/account';
import { startAniListSync } from './sync/anilistSync';
import './index.css';

captureOAuthToken();
wireAccount();
startCloudSync();
startAniListSync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: (count, err) => (err as { status?: number })?.status !== 404 && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
