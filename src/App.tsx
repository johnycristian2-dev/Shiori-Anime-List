import { lazy, Suspense, useEffect } from 'react';
import { useUI } from './store/ui';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Discover from './pages/Discover';

// Cada página vira um arquivo separado: o site abre mais rápido
const Explore = lazy(() => import('./pages/Explore'));
const Swipe = lazy(() => import('./pages/Swipe'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const MyList = lazy(() => import('./pages/MyList'));
const AnimeDetail = lazy(() => import('./pages/AnimeDetail'));
const Sync = lazy(() => import('./pages/Sync'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const Terms = lazy(() => import('./pages/Terms'));
const Friends = lazy(() => import('./pages/Friends'));
const Moderation = lazy(() => import('./pages/Moderation'));
const Chat = lazy(() => import('./pages/Chat'));
const ChatRoom = lazy(() => import('./pages/ChatRoom'));
const Roulette = lazy(() => import('./pages/Roulette'));
const StudioPage = lazy(() => import('./pages/Studio'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const CharacterPage = lazy(() => import('./pages/CharacterPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Marathon = lazy(() => import('./pages/Marathon'));
const Wrapped = lazy(() => import('./pages/Wrapped'));
const Compare = lazy(() => import('./pages/Compare'));
const Party = lazy(() => import('./pages/Party'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const Themes = lazy(() => import('./pages/Themes'));

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
  return (
    <Layout key={lang}>
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
          <Route path="/party" element={<Party />} />
          <Route path="/party/:code" element={<Party />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/temas" element={<Themes />} />
          <Route path="*" element={<Discover />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
