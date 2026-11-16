import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Globe, Lock } from 'lucide-react';
import { useCloudUser } from '../sync/cloud';
import { getMyProfile, profileUrl, saveProfile, USERNAME_RE } from '../sync/profile';
import { useUI } from '../store/ui';
import { Spinner } from './ui';

import { t } from '../lib/i18n';

/** Card em Sync: cria/edita o perfil público (/u/apelido). */
export default function PublicProfileCard() {
  const user = useCloudUser((s) => s.user);
  const nickname = useUI((s) => s.nickname);
  const toast = useUI((s) => s.toast);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [display, setDisplay] = useState(nickname);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.is_anonymous) return;
    getMyProfile(user.id)
      .then((p) => {
        if (p) {
          setSaved(p.username);
          setUsername(p.username);
          setDisplay(p.display_name ?? '');
          setIsPublic(p.is_public);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || user.is_anonymous) return (
    <p>{t(
      'Entre na sua conta Shiori (card ao lado) pra criar um perfil público com link.'
    )}</p>
  );
  if (loading) return <Spinner className="h-5 w-5 text-pink" />;

  const valid = USERNAME_RE.test(username);
  const save = async () => {
    setBusy(true);
    try {
      await saveProfile(user.id, { username, display_name: display, is_public: isPublic });
      setSaved(username);
      toast(isPublic ? t('Perfil público salvo!') : t('Perfil salvo como privado'));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p>{t(
        'Uma página com sua lista, números e conquistas pra mandar pros amigos (suas anotações ficam de fora).'
      )}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold">
          {t('Apelido (link)')}
          <input
            className={`field mt-1 ${username && !valid ? '!border-red-400' : ''}`}
            value={username}
            maxLength={20}
            placeholder={t('jotas')}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          />
        </label>
        <label className="text-xs font-bold">
          {t('Nome de exibição')}
          <input className="field mt-1" value={display} maxLength={30} placeholder={t('Jotas')} onChange={(e) => setDisplay(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={`chip ${isPublic ? 'on' : ''}`} onClick={() => setIsPublic(true)}>
          <Globe size={14} />{' '}{t('Público')}
        </button>
        <button className={`chip ${!isPublic ? 'on' : ''}`} onClick={() => setIsPublic(false)}>
          <Lock size={14} />{' '}{t('Privado')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="manga-btn" onClick={save} disabled={!valid || busy}>
          {busy && <Spinner className="h-4 w-4" />}{' '}{t('Salvar perfil')}
        </button>
        {saved && isPublic && (
          <>
            <Link to={`/u/${saved}`} className="manga-btn ghost">
              {t('Ver')}
            </Link>
            <button
              className="manga-btn cyan"
              onClick={() =>
                navigator.clipboard
                  .writeText(profileUrl(saved))
                  .then(() => toast(t('Link copiado!')))
                  .catch(() => toast(profileUrl(saved), 'info'))
              }
            >
              <Copy size={16} />{' '}{t('Copiar link')}
            </button>
          </>
        )}
      </div>
    </>
  );
}
