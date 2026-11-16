/**
 * Posts: reviews (com nota), posts livres e reações a episódio/capítulo, com curtidas e comentários.
 * Quem vê o quê é decidido no banco (supabase/posts.sql).
 */
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import type { MediaType } from '../types';
import { useCloudUser } from './cloud';
import { miniProfiles, type MiniProfile } from './social';

export type PostKind = 'review' | 'post' | 'reaction';
export interface PostMedia {
  id: number;
  title: string;
  titleEnglish?: string | null;
  cover: string | null;
  type?: MediaType;
  country?: string | null;
}
export interface Post {
  id: number;
  user_id: string;
  kind: PostKind;
  media_id: number | null;
  media: PostMedia | null;
  body: string;
  score: number | null;
  spoiler: boolean;
  episode: number | null;
  like_count: number;
  comment_count: number;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}
export interface PostComment {
  id: number;
  post_id: number;
  user_id: string;
  body: string;
  created_at: string;
}

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};
const me = () => {
  const u = useCloudUser.getState().user;
  if (!u || u.is_anonymous) throw new Error(t('Entre na sua conta primeiro.'));
  return u.id;
};
function friendly(e: { message?: string; code?: string } | null) {
  const m = e?.message ?? '';
  if (/hate_terms/.test(m)) return new Error(t('Seu texto tem termos ofensivos e não pode ser publicado.'));
  if (/rate_limited/.test(m)) return new Error(t('Calma! Muitas publicações seguidas. Espere um minuto.'));
  if (/posts_one_review|duplicate key/.test(m)) return new Error(t('Você já escreveu uma review desse título. Edite a sua.'));
  if (/row-level security|violates/i.test(m)) return new Error(t('Não é possível fazer isso com este perfil.'));
  return new Error(m || t('Algo deu errado.'));
}

export interface PostPage {
  posts: Post[];
  profiles: Record<string, MiniProfile>;
  liked: Set<number>;
}

async function withExtras(posts: Post[]): Promise<PostPage> {
  const u = useCloudUser.getState().user;
  const logged = !!u && !u.is_anonymous;
  const [profiles, likes] = await Promise.all([
    logged ? miniProfiles(posts.map((p) => p.user_id)) : publicAuthors(posts.map((p) => p.user_id)),
    logged && posts.length
      ? sb().from('post_likes').select('post_id').eq('user_id', u!.id).in('post_id', posts.map((p) => p.id))
      : Promise.resolve({ data: [] as { post_id: number }[] }),
  ]);
  return { posts, profiles, liked: new Set((likes.data ?? []).map((l) => l.post_id as number)) };
}

/** Visitante sem conta: nome e foto vêm direto dos perfis públicos */
async function publicAuthors(ids: string[]) {
  if (!ids.length) return {};
  const { data } = await sb().from('profiles').select('user_id,username,display_name,avatar_url').in('user_id', [...new Set(ids)]);
  return Object.fromEntries(((data ?? []) as MiniProfile[]).map((p) => [p.user_id, p]));
}

export async function listPosts(opts: { mediaId?: number; userId?: string; userIds?: string[]; before?: string; limit?: number }) {
  let q = sb().from('posts').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 20);
  if (opts.mediaId) q = q.eq('media_id', opts.mediaId);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (opts.userIds) q = q.in('user_id', opts.userIds.length ? opts.userIds : ['00000000-0000-0000-0000-000000000000']);
  if (opts.before) q = q.lt('created_at', opts.before);
  const { data, error } = await q;
  if (error) throw friendly(error);
  return withExtras((data ?? []) as Post[]);
}

export async function myReview(mediaId: number) {
  const u = useCloudUser.getState().user;
  if (!supabase || !u || u.is_anonymous) return null;
  const { data } = await supabase.from('posts').select('*').eq('user_id', u.id).eq('media_id', mediaId).eq('kind', 'review').maybeSingle();
  return data as Post | null;
}

export async function createPost(p: { kind: PostKind; body: string; media?: PostMedia | null; score?: number | null; spoiler?: boolean; episode?: number | null }) {
  me();
  const { data, error } = await sb()
    .from('posts')
    .insert({
      kind: p.kind,
      body: p.body.trim(),
      media_id: p.media?.id ?? null,
      media: p.media ?? null,
      score: p.kind === 'review' ? p.score ?? null : null,
      spoiler: !!p.spoiler,
      episode: p.kind === 'reaction' ? p.episode ?? null : null,
    })
    .select()
    .single();
  if (error) throw friendly(error);
  return data as Post;
}

export async function updatePost(id: number, patch: Partial<Pick<Post, 'body' | 'score' | 'spoiler' | 'episode'>>) {
  const { data, error } = await sb().from('posts').update({ ...patch, body: patch.body?.trim() }).eq('id', id).select().single();
  if (error) throw friendly(error);
  return data as Post;
}

export async function deletePost(id: number) {
  const { error } = await sb().from('posts').delete().eq('id', id);
  if (error) throw friendly(error);
}

/** Moderador: oculta (ou mostra de novo) um post */
export async function setPostHidden(id: number, hidden: boolean) {
  const { error } = await sb().from('posts').update({ hidden }).eq('id', id);
  if (error) throw friendly(error);
}

export async function getPost(id: number) {
  const { data, error } = await sb().from('posts').select('*').eq('id', id).maybeSingle();
  if (error) throw friendly(error);
  return data as Post | null;
}

export async function setLike(postId: number, on: boolean) {
  const uid = me();
  const { error } = on
    ? await sb().from('post_likes').insert({ post_id: postId })
    : await sb().from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
  if (error && error.code !== '23505') throw friendly(error);
}

export async function listComments(postId: number) {
  const { data, error } = await sb().from('post_comments').select('id,post_id,user_id,body,created_at').eq('post_id', postId).order('created_at').limit(200);
  if (error) throw friendly(error);
  const comments = (data ?? []) as PostComment[];
  const u = useCloudUser.getState().user;
  const profiles = u && !u.is_anonymous ? await miniProfiles(comments.map((c) => c.user_id)) : await publicAuthors(comments.map((c) => c.user_id));
  return { comments, profiles };
}

export async function addComment(postId: number, body: string) {
  me();
  const { error } = await sb().from('post_comments').insert({ post_id: postId, body: body.trim() });
  if (error) throw friendly(error);
}

export async function deleteComment(id: number) {
  const { error } = await sb().from('post_comments').delete().eq('id', id);
  if (error) throw friendly(error);
}

/** Moderação: o conteúdo denunciado (post ou comentário) */
export async function reportedContent(kind: string, id: string | null) {
  if (!id) return null;
  if (kind === 'post') {
    const { data } = await sb().from('posts').select('id,body,hidden,media').eq('id', Number(id)).maybeSingle();
    return data as { id: number; body: string; hidden: boolean; media: PostMedia | null } | null;
  }
  if (kind === 'comment') {
    const { data } = await sb().from('post_comments').select('id,body,hidden').eq('id', Number(id)).maybeSingle();
    return data as { id: number; body: string; hidden: boolean } | null;
  }
  return null;
}

export async function setCommentHidden(id: number, hidden: boolean) {
  const { error } = await sb().from('post_comments').update({ hidden }).eq('id', id);
  if (error) throw friendly(error);
}
