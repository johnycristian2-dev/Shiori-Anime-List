import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

import { t } from '../lib/i18n';

export function SectionTitle({ title, jp, action }: { title: string; jp?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 mt-2 flex items-end justify-between gap-4">
      <div className="relative pt-4">
        {jp && <span className="jp-ghost">{jp}</span>}
        <h2 className="section-title relative font-display text-2xl leading-none sm:text-3xl">{title}</h2>
        <span className="title-underline" />
      </div>
      {action && <div className="shrink-0 text-sm font-extrabold text-cyan">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ small }: { small?: boolean }) {
  return (
    <div className={small ? 'w-36 shrink-0 sm:w-40' : 'w-full'}>
      <div className="skeleton aspect-[2/3] rounded-xl" />
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} />;
}

export function EmptyState({ jp, title, children }: { jp: string; title: string; children?: ReactNode }) {
  return (
    <div className="panel halftone relative mx-auto max-w-xl overflow-hidden p-8 text-center">
      <div className="font-jp text-6xl font-black text-pink/80">{jp}</div>
      <h3 className="mt-3 font-display text-xl">{title}</h3>
      <div className="mt-3 text-sm text-muted">{children}</div>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="panel border-red-400/60 p-5 text-center">
      <div className="font-jp text-3xl font-black text-pink">エラー</div>
      <p className="mt-2 text-sm text-muted">{(error as Error)?.message ?? t('Algo deu errado.')}</p>
      {onRetry && (
        <button className="manga-btn ghost mt-4" onClick={onRetry}>
          {t('Tentar de novo')}
        </button>
      )}
    </div>
  );
}

/** Botão que pede confirmação no segundo clique (sem window.confirm). */
export function ConfirmButton({
  children,
  confirmText,
  onConfirm,
  className = 'manga-btn ghost',
}: {
  children: ReactNode;
  confirmText?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmText ?? t('Clique de novo pra confirmar') : children}
    </button>
  );
}

export function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Fecha um popover ao clicar fora dele ou apertar Esc. */
export function useOutsideClose(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close]);
}
