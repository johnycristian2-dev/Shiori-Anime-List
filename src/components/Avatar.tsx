import { useState } from 'react';

/** Foto de perfil; sem foto (ou se a imagem não carregar), mostra a inicial num quadrado colorido. */
export default function Avatar({ url, name, size = 36, className = '' }: { url?: string | null; name?: string | null; size?: number; className?: string }) {
  const initial = (name || '?').trim()[0]?.toUpperCase() ?? '?';
  const [failed, setFailed] = useState<string | null>(null);
  return url && failed !== url ? (
    <img
      onError={() => setFailed(url)}
      src={url}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={`shrink-0 rounded-[calc(var(--radius-sm)*0.8)] border-2 border-black object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[calc(var(--radius-sm)*0.8)] border-2 border-black bg-pink font-display text-[var(--on-pink)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45, color: 'var(--on-pink, #fff)' }}
    >
      {initial}
    </span>
  );
}
