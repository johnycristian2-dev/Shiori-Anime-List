import { Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { lazyPage } from './lib/lazyPage';
import ErrorBoundary from './components/ErrorBoundary';
import { useUI } from './store/ui';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Discover from './pages/Discover';

// Cada página vira um arquivo separado: o site abre mais rápido
const Explore = lazyPage(() => import('./pages/Explore'));
const Support = lazyPage(() => import('./pages/Support'));
const Feedback = lazyPage(() => import('./pages/Feedback'));
const Games = lazyPage(() => import('./pages/Games'));
const League = lazyPage(() => import('./pages/League'));
const Animedle = lazyPage(() => import('./pages/games/Animedle'));
const HigherLower = lazyPage(() => import('./pages/games/HigherLower'));
const CoverGuess = lazyPage(() => import('./pages/games/CoverGuess'));
const Swipe = lazyPage(() => import('./pages/Swipe'));
const Recommendations = lazyPage(() => import('./pages/Recommendations'));
const MyList = lazyPage(() => import('./pages/MyList'));
const AnimeDetail = lazyPage(() => import('./pages/AnimeDetail'));
const Sync = lazyPage(() => import('./pages/Sync'));
const Calendar = lazyPage(() => import('./pages/Calendar'));
const Profile = lazyPage(() => import('./pages/Profile'));
const ProfileEdit = lazyPage(() => import('./pages/ProfileEdit'));
const Terms = lazyPage(() => import('./pages/Terms'));
const Friends = lazyPage(() => import('./pages/Friends'));
const Moderation = lazyPage(() => import('./pages/Moderation'));
const Chat = lazyPage(() => import('./pages/Chat'));
const ChatRoom = lazyPage(() => import('./pages/ChatRoom'));
const Roulette = lazyPage(() => import('./pages/Roulette'));
const StudioPage = lazyPage(() => import('./pages/Studio'));
const Roadmap = lazyPage(() => import('./pages/Roadmap'));
const CharacterPage = lazyPage(() => import('./pages/CharacterPage'));
const StaffPage = lazyPage(() => import('./pages/StaffPage'));
const Quiz = lazyPage(() => import('./pages/Quiz'));
const Marathon = lazyPage(() => import('./pages/Marathon'));
const Wrapped = lazyPage(() => import('./pages/Wrapped'));
const Compare = lazyPage(() => import('./pages/Compare'));
const Party = lazyPage(() => import('./pages/Party'));
const PublicProfile = lazyPage(() => import('./pages/PublicProfile'));
const Themes = lazyPage(() => import('./pages/Themes'));

const Loading = () => (
  <div className="grid h-[50vh] place-items-center">
    <Spinner className="h-10 w-10 text-pink" />
  </div>
);

export default function App() {
  // Trocar o idioma remonta a árvore inteira: todos os textos t() são recalculados
  const lang = useUI((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = { pt: 'pt-BR', en: 'en', ja: 'ja' }[lang];
  }, [lang]);
  const { pathname } = useLocation();
  return (
    <Layout key={lang}>
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/explorar" element={<Explore />} />
          <Route path="/swipe" element={<Swipe />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/pra-voce" element={<Recommendations />} />
          <Route path="/roleta" element={<Roulette />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/perfil/editar" element={<ProfileEdit />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Terms />} />
          <Route path="/amigos" element={<Friends />} />
          <Route path="/moderacao" element={<Moderation />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:roomId" element={<ChatRoom />} />
          <Route path="/lista" element={<MyList />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
          <Route path="/manga/:id" element={<AnimeDetail />} />
          <Route path="/estudio/:id" element={<StudioPage />} />
          <Route path="/sync" element={<Sync />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/personagem/:id" element={<CharacterPage />} />
          <Route path="/dublador/:id" element={<StaffPage />} />
          <Route path="/comecar" element={<Quiz />} />
          <Route path="/maratona" element={<Marathon />} />
          <Route path="/maratona/:id" element={<Marathon />} />
          <Route path="/retrospectiva" element={<Wrapped />} />
          <Route path="/comparar" element={<Compare />} />
          <Route path="/comparar/:source/:name" element={<Compare />} />
          <Route path="/jogos" element={<Games />} />
          <Route path="/liga" element={<League />} />
          <Route path="/liga/:id" element={<League />} />
          <Route path="/jogos/animedle" element={<Animedle />} />
          <Route path="/jogos/mais-ou-menos" element={<HigherLower />} />
          <Route path="/jogos/capa" element={<CoverGuess />} />
          <Route path="/party" element={<Party />} />
          <Route path="/party/:code" element={<Party />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/temas" element={<Themes />} />
          <Route path="/apoiar" element={<Support />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="*" element={<Discover />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
