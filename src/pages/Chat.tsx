import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Sparkles } from 'lucide-react';
import { EmptyState, SectionTitle, Spinner } from '../components/ui';
import { pickTitle, useTitle } from '../lib/format';
import { t } from '../lib/i18n';
import { currentSeason, SEASON_LABEL } from '../lib/season';
import { CLOUD_ENABLED } from '../lib/supabase';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import { listRooms, mediaRoomId, roomsByIds, seasonRoomId, type Room } from '../sync/chat';
import { timeAgo } from '../components/Social';

const roomPath = (id: string) => `/chat/${encodeURIComponent(id)}`;

function RoomCard({ id, title, cover, jp, room, sub }: { id: string; title: string; cover?: string | null; jp?: string; room?: Room; sub?: string }) {
  return (
    <Link to={roomPath(id)} className="panel group flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:border-pink">
      {cover ? (
        <img src={cover} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-md border-2 border-black object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-sm)] border-2 border-black bg-pink font-jp text-lg font-black text-[var(--on-pink)]">{jp}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-extrabold group-hover:text-pink">{title}</div>
        <div className="truncate text-xs font-bold text-muted">
          {room?.last_message_at ? t('{0} mensagens · última {1}', room.message_count, timeAgo(room.last_message_at)) : sub ?? t('Ninguém falou ainda')}
        </div>
      </div>
      <MessageCircle size={18} className="shrink-0 text-muted group-hover:text-pink" />
    </Link>
  );
}

export default function Chat() {
  const entries = useList((s) => s.entries);
  const lang = useUI((s) => s.titleLang);
  const title = useTitle();
  const cur = currentSeason();
  const seasonId = seasonRoomId(cur.season, cur.year);
  const watching = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.status === 'WATCHING')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12),
    [entries],
  );
  const hot = useQuery({ queryKey: ['rooms'], queryFn: listRooms, enabled: CLOUD_ENABLED, refetchInterval: 30_000 });
  const mine = useQuery({
    queryKey: ['rooms-mine', watching.map((e) => e.mediaId).join(','), seasonId],
    queryFn: () => roomsByIds(['geral', seasonId, ...watching.map((e) => mediaRoomId(e.mediaId))]),
    enabled: CLOUD_ENABLED,
  });
  const byId = Object.fromEntries((mine.data ?? []).map((r) => [r.id, r]));

  if (!CLOUD_ENABLED)
    return (
      <EmptyState jp="準備中" title={t('Chats ainda não estão disponíveis')}>
        {t('As contas ainda não foram ativadas neste site.')}
      </EmptyState>
    );

  return (
    <>
      <SectionTitle title={t('Chats')} jp="チャット" />
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        <RoomCard id="geral" title={t('Sala Geral')} jp="雑談" room={byId.geral} sub={t('Papo livre sobre anime, mangá e tudo mais')} />
        <RoomCard
          id={seasonId}
          title={t('Temporada {0} {1}', SEASON_LABEL[cur.season].pt, cur.year)}
          jp={SEASON_LABEL[cur.season].jp}
          room={byId[seasonId]}
          sub={t('Tudo que está passando nesta temporada')}
        />
      </div>

      <SectionTitle title={t('Do que você está assistindo e lendo')} jp="視聴中" />
      {watching.length ? (
        <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {watching.map((e) => (
            <RoomCard
              key={e.mediaId}
              id={mediaRoomId(e.mediaId)}
              title={title({ title: { romaji: e.title, english: e.titleEnglish, native: e.titleNative }, countryOfOrigin: e.country })}
              cover={e.cover}
              room={byId[mediaRoomId(e.mediaId)]}
            />
          ))}
        </div>
      ) : (
        <p className="panel mb-8 p-5 text-sm font-bold text-muted">{t('Marque algo como "Assistindo" ou "Lendo" e o chat dele aparece aqui. Todo anime e mangá tem um chat na própria página.')}</p>
      )}

      <SectionTitle title={t('Movimentados agora')} jp="話題" />
      {hot.isLoading ? (
        <Spinner className="mx-auto h-7 w-7 text-pink" />
      ) : (hot.data ?? []).length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(hot.data ?? []).map((r) => (
            <RoomCard
              key={r.id}
              id={r.id}
              title={r.media ? pickTitle({ romaji: r.media.title, english: r.media.titleEnglish ?? null, native: null }, lang) : r.id === 'geral' ? t('Sala Geral') : r.title}
              cover={r.media?.cover}
              jp={r.id === 'geral' ? '雑談' : '今期'}
              room={r}
            />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm font-bold text-muted">
          <Sparkles size={15} /> {t('Nenhuma conversa ainda. Que tal começar na Sala Geral?')}
        </p>
      )}
    </>
  );
}
