import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Crown, Heart, Loader2, Sparkles, X } from 'lucide-react';
import { SectionTitle } from '../components/ui';
import Badges from '../components/Badges';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useCloudUser } from '../sync/cloud';
import { brl, createPix, DONATIONS, isPlus, paymentStatus, PLANS, useConfig, useMyPerks, type PixCharge } from '../sync/perks';

const ERR: Record<string, () => string> = {
  payments_off: () => t('Os pagamentos ainda não foram ligados. Volte em breve!'),
  not_logged: () => t('Entre na sua conta para continuar.'),
  too_many: () => t('Muitas tentativas. Espere um pouco e tente de novo.'),
  bad_amount: () => t('Escolha um valor entre R$ 2 e R$ 500.'),
};

export default function Support() {
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const toast = useUI((s) => s.toast);
  const cfg = useConfig().data;
  const perks = useMyPerks();
  const [charge, setCharge] = useState<{ pix: PixCharge; label: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const payOn = !!cfg?.payments_on;

  const start = async (key: string, label: string, body: Parameters<typeof createPix>[0]) => {
    if (!logged) return toast(t('Entre na sua conta para continuar.'), 'err');
    setBusy(key);
    try {
      setCharge({ pix: await createPix(body), label });
    } catch (e) {
      const m = (e as Error).message;
      toast(ERR[m]?.() ?? t('Não deu para gerar o Pix agora. Tente de novo.'), 'err');
    } finally {
      setBusy(null);
    }
  };

  const plusUntil = perks?.plus_until && new Date(perks.plus_until) > new Date() ? new Date(perks.plus_until) : null;

  return (
    <>
      <SectionTitle title={t('Apoie o Shiori')} jp="応援" />
      <p className="mb-6 max-w-2xl text-sm text-ink/85">
        {t('O Shiori é feito por uma pessoa só, sem anúncios. Servidor, domínio e e-mail custam dinheiro todo mês. Se o site te ajuda, dá pra apoiar de dois jeitos:')}
      </p>

      {perks && (isPlus(perks) || perks.supporter_since) && (
        <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4">
          <Badges userId={user?.id} size="md" />
          <span className="text-sm font-bold">
            {perks.owner
              ? t('Você é o dono: tudo liberado.')
              : plusUntil
                ? t('Shiori+ ativo até {0}.', plusUntil.toLocaleDateString('pt-BR'))
                : t('Obrigado pelo apoio! 💜')}
          </span>
        </div>
      )}

      {/* Shiori+ */}
      <section className="panel relative mb-8 overflow-hidden p-6">
        <div className="banner-fx banner-galaxia pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="badge-plus inline-flex items-center gap-1 rounded-full border-2 border-black px-3 py-1 text-sm font-black">
              <Sparkles size={14} /> Shiori+
            </span>
            <span className="font-jp text-sm font-black text-pink">プラス</span>
          </div>
          <h2 className="mt-3 font-display text-2xl">{t('Extras pra quem quer apoiar e se destacar')}</h2>
          <p className="mt-1 text-sm text-muted">{t('Nada do básico fica bloqueado: lista, jogos, chat e watch party continuam grátis pra todo mundo.')}</p>
          <ul className="mt-4 grid gap-2 text-sm font-bold sm:grid-cols-2">
            {[
              t('Selo Shiori+ brilhante no perfil, chat e feed'),
              t('Banner animado no perfil (5 estilos)'),
              t('Temas exclusivos'),
              t('Estilos exclusivos de card pro story'),
              t('Suas ligas aceitam até 60 pessoas (normal: 30)'),
              t('Ajuda a manter o Shiori no ar 💜'),
            ].map((x) => (
              <li key={x} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-green-400" /> {x}
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PLANS.map((p) => {
              const label = p.months === 1 ? t('1 mês') : t('{0} meses', p.months);
              const per = p.months > 1 ? brl(Math.round(p.cents / p.months)) + t('/mês') : null;
              return (
                <button
                  key={p.months}
                  disabled={!payOn || !!busy}
                  onClick={() => start(`p${p.months}`, `Shiori+ · ${label}`, { kind: 'plus', months: p.months })}
                  className={`rounded-[var(--radius)] border-[3px] border-black bg-panel-2 p-4 text-left shadow-[4px_4px_0_#000] transition hover:-translate-y-0.5 disabled:opacity-60 ${p.months === 12 ? 'ring-2 ring-yellow' : ''}`}
                >
                  {p.months === 12 && <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-yellow">{t('Melhor preço')}</div>}
                  <div className="font-display text-lg">{label}</div>
                  <div className="text-2xl font-black text-pink">{brl(p.cents)}</div>
                  {per && <div className="text-xs font-bold text-muted">{per}</div>}
                  {busy === `p${p.months}` && <Loader2 className="mt-2 animate-spin" size={18} />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            {payOn ? t('Pagamento único por Pix, sem renovação automática. Se você já tem Shiori+, o tempo é somado.') : t('Em breve: os pagamentos ainda estão sendo configurados.')}
          </p>
        </div>
      </section>

      {/* Doação */}
      <section className="panel mb-8 p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Heart className="text-pink" fill="currentColor" /> {t('Doação')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('Qualquer valor ajuda. Quem doa pelo Pix daqui ganha o selo de Apoiador pra sempre.')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {DONATIONS.map((v) => (
            <button key={v} disabled={!payOn || !!busy} className="manga-btn !py-2 disabled:opacity-60" onClick={() => start(`d${v}`, t('Doação de {0}', brl(v * 100)), { kind: 'donation', amount: v })}>
              {busy === `d${v}` ? <Loader2 className="animate-spin" size={16} /> : brl(v * 100)}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <input className="field !w-28" inputMode="numeric" placeholder={t('Outro valor')} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            <button
              disabled={!payOn || !!busy || !custom}
              className="manga-btn ghost !py-2 disabled:opacity-60"
              onClick={() => start('dc', t('Doação de {0}', brl(Number(custom) * 100)), { kind: 'donation', amount: Number(custom) })}
            >
              {t('Doar')}
            </button>
          </div>
        </div>
        {(cfg?.kofi_url || cfg?.apoiase_url) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t-2 border-line pt-4">
            {cfg.kofi_url && (
              <a className="manga-btn ghost !py-2" href={cfg.kofi_url} target="_blank" rel="noreferrer">
                ☕ Ko-fi
              </a>
            )}
            {cfg.apoiase_url && (
              <a className="manga-btn ghost !py-2" href={cfg.apoiase_url} target="_blank" rel="noreferrer">
                {t('Apoio mensal no Apoia.se')}
              </a>
            )}
            <span className="self-center text-xs text-muted">{t('Por esses links o selo é dado manualmente.')}</span>
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        <Crown size={12} className="mr-1 inline" />
        {t('Dúvidas ou problema com pagamento?')}{' '}
        <Link to="/feedback" className="font-bold text-pink underline">
          {t('Fale com a gente')}
        </Link>
        . {t('Você pode pedir reembolso em até 7 dias.')}{' '}
        <Link to="/termos" className="underline">
          {t('Termos')}
        </Link>
      </p>

      {charge && <PixModal charge={charge.pix} label={charge.label} onClose={() => setCharge(null)} />}
    </>
  );
}

function PixModal({ charge, label, onClose }: { charge: PixCharge; label: string; onClose: () => void }) {
  const toast = useUI((s) => s.toast);
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  useEffect(() => {
    if (status !== 'pending') return;
    const end = new Date(charge.expires_at).getTime();
    const id = setInterval(async () => {
      if (Date.now() > end) {
        setStatus('expired');
        return;
      }
      const s = await paymentStatus(charge.id).catch(() => 'pending');
      if (s !== 'pending') {
        setStatus(s);
        if (s === 'approved') qc.invalidateQueries({ queryKey: ['perks'] });
      }
    }, 4000);
    return () => clearInterval(id);
  }, [charge, status, qc]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="pop-in panel relative w-full max-w-sm p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-3 top-3 text-muted hover:text-ink" onClick={onClose} aria-label={t('Fechar')}>
          <X size={20} />
        </button>
        {status === 'approved' ? (
          <div className="py-6">
            <div className="text-5xl">🎉</div>
            <h3 className="mt-3 font-display text-2xl">{t('Pagamento confirmado!')}</h3>
            <p className="mt-2 text-sm text-muted">{t('Muito obrigado por apoiar o Shiori. Seu selo já aparece no perfil.')}</p>
            <button className="manga-btn mt-5" onClick={onClose}>{t('Fechar')}</button>
          </div>
        ) : (
          <>
            <h3 className="font-display text-xl">{label}</h3>
            <div className="text-2xl font-black text-pink">{brl(charge.amount_cents)}</div>
            <img src={`data:image/png;base64,${charge.qr_base64}`} alt="QR code Pix" className="mx-auto mt-3 w-56 rounded-xl border-[3px] border-black bg-white p-2" />
            <p className="mt-3 text-xs text-muted">{t('Abra o app do seu banco, escolha Pix → ler QR code, ou copie o código:')}</p>
            <button
              className="manga-btn mt-2 w-full justify-center !py-2"
              onClick={async () => {
                await navigator.clipboard.writeText(charge.qr_code).catch(() => null);
                toast(t('Código Pix copiado'));
              }}
            >
              <Copy size={16} /> {t('Copiar Pix copia e cola')}
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-muted">
              {status === 'pending' ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> {t('Esperando o pagamento…')}
                </>
              ) : status === 'expired' ? (
                t('Esse Pix expirou. Feche e gere outro.')
              ) : (
                t('Pagamento não concluído ({0}).', status)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
