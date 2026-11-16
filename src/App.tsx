import { lazy, Suspense } from 'react';
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
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/explorar" element={<Explore />} />
          <Route path="/swipe" element={<Swipe />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/pra-voce" element={<Recommendations />} />
          <Route path="/roleta" element={<Roulette />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/lista" element={<MyList />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
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
