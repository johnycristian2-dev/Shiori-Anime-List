/** Aviso de episódio novo: inscreve este aparelho no Web Push e guarda a inscrição na conta. */
import { supabase } from '../lib/supabase';
import { getLang, t } from '../lib/i18n';

/** Chave pública dos avisos (gerada pelo servidor, ver supabase/functions/shiori-tick). */
async function vapidPublic() {
  const { data, error } = await supabase!.rpc('vapid_public');
  if (error || !data) throw new Error(t('Os avisos ainda não estão prontos no servidor. Tente mais tarde.'));
  return data as string;
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  return navigator.serviceWorker.ready;
}

export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await registration();
  return !!(await reg.pushManager.getSubscription());
}

export async function enablePush() {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error(t('Entre na sua conta pra receber avisos.'));
  if (!pushSupported()) throw new Error(t('Este navegador não aceita notificações.'));
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(t('Você bloqueou as notificações. Libere nas configurações do navegador.'));
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(await vapidPublic()) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await supabase.from('push_subscriptions').delete().eq('endpoint', j.endpoint);
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ user_id: data.session.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, lang: getLang() });
  if (error) throw new Error(error.message);
}

export async function disablePush() {
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

// ─── avisos da equipe (denúncia, bug, pagamento) neste aparelho ───
async function currentEndpoint() {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  const sub = await (await registration()).pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

export async function staffAlertsOn() {
  const ep = await currentEndpoint();
  if (!ep || !supabase) return false;
  const { data } = await supabase.rpc('my_staff_alerts', { p_endpoint: ep });
  return !!data;
}

export async function setStaffAlerts(on: boolean) {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  let ep = await currentEndpoint();
  if (!ep && on) {
    await enablePush();
    ep = await currentEndpoint();
  }
  if (!ep) return;
  const { data, error } = await supabase.rpc('set_staff_alerts', { p_endpoint: ep, p_on: on });
  if (error) throw new Error(error.message);
  if (on && !data) {
    // inscrição deste aparelho é de outra conta (ou sumiu): refaz
    await enablePush();
    await supabase.rpc('set_staff_alerts', { p_endpoint: ep, p_on: on });
  }
}
