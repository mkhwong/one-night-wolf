import { React, useState, useEffect, useRef } from '../react';
import { ROLES, countPool, nightTurns } from '../roles';
import { useT, useView, useNow } from './store';
import { teamKey } from '../i18n';
import { PubState } from '../engine';

export function RoleArt({ r, alt, className = '' }: { r: number; alt?: boolean; className?: string }) {
  const t = useT();
  const def = ROLES[r];
  if (!def) return null;
  return <img className={'role-art ' + className} src={alt && def.alt ? def.alt : def.art} alt={t.role(r)} draggable={false} />;
}

/** Full role card: art on a dark tile, name, team stripe. */
export function RoleCard({ r, size = 'md', alt, sub = true, className = '' }: { r: number; size?: 'sm' | 'md' | 'lg' | 'xl'; alt?: boolean; sub?: boolean; className?: string }) {
  const t = useT();
  const def = ROLES[r];
  return (
    <div className={`rcard rcard-${size} team-${def.team} ${className}`}>
      <div className="rcard-art"><RoleArt r={r} alt={alt} /></div>
      <div className="rcard-name">
        <span className="rcard-zh">{def.zh}</span>
        {sub && <span className="rcard-en">{def.en}</span>}
      </div>
    </div>
  );
}

export function CardBack({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={'cardback ' + className}>
      <svg viewBox="0 0 40 56" aria-hidden="true">
        <rect x="3" y="3" width="34" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".55" />
        <path d="M23 16 A12 12 0 1 0 23 40 A14 14 0 0 1 23 16 Z" fill="currentColor" transform="translate(4 0)" />
        <circle cx="13" cy="12" r=".9" fill="currentColor" opacity=".7" /><circle cx="29" cy="44" r=".9" fill="currentColor" opacity=".7" /><circle cx="10" cy="40" r=".6" fill="currentColor" opacity=".6" />
      </svg>
      {label && <span className="cardback-label">{label}</span>}
    </div>
  );
}

export function RoleChip({ r, extra, onRemove, title }: { r: number; extra?: React.ReactNode; onRemove?: () => void; title?: string }) {
  const t = useT();
  return (
    <span className={`rchip team-${ROLES[r].team}`} title={title}>
      <RoleArt r={r} className="rchip-art" />
      <span>{t.role(r)}</span>
      {extra}
      {onRemove && <button type="button" className="rchip-x" aria-label="remove" onClick={onRemove}>×</button>}
    </span>
  );
}

export function TeamBadge({ r }: { r: number }) {
  const t = useT();
  return <span className={`team-badge team-${ROLES[r].team}`}>{t(teamKey(r))}</span>;
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}`;
}

export function Countdown({ end, total, big, warnAt = 10000 }: { end: number; total?: number; big?: boolean; warnAt?: number }) {
  const now = useNow(250);
  const left = Math.max(0, end - now);
  const frac = total ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div className={`countdown ${big ? 'countdown-big' : ''} ${left < warnAt ? 'warn' : ''}`} role="timer" aria-live="off">
      {total ? <span className="countdown-bar" style={{ ['--f' as any]: frac }} /> : null}
      <span className="countdown-num">{fmtClock(left)}</span>
    </div>
  );
}

/** Night order of the configured pool, current turn highlighted. */
export function OrderBar({ pub }: { pub: PubState }) {
  const t = useT();
  const counts = countPool(pub.cfg.pool);
  const turns = nightTurns(pub.cfg.pool);
  const current = pub.ph === 'night' && pub.ti >= 0 ? pub.tr[pub.ti] : -1;
  const passive = counts.map((c, r) => (c && !ROLES[r].night ? r : -1)).filter(r => r >= 0);
  const done = (r: number) => pub.ph !== 'night' ? pub.ph !== 'reveal' && pub.ph !== 'lobby' : turns.indexOf(r) < pub.ti;
  return (
    <nav className="orderbar" aria-label={t('order')}>
      <span className="orderbar-label">{t('order')}</span>
      <div className="orderbar-track hscroll">
        {turns.map((r, i) => (
          <span key={r} className={`order-chip ${r === current ? 'is-now' : ''} ${done(r) ? 'is-done' : ''}`}>
            <span className="order-n">{i + 1}</span>
            <RoleArt r={r} className="order-art" />
            <span className="order-name">{t.role(r)}</span>
            {counts[r] > 1 && <span className="order-x">×{counts[r]}</span>}
          </span>
        ))}
        {passive.length > 0 && <span className="order-div">{t('passive')}</span>}
        {passive.map(r => (
          <span key={r} className="order-chip is-passive">
            <RoleArt r={r} className="order-art" />
            <span className="order-name">{t.role(r)}</span>
            {counts[r] > 1 && <span className="order-x">×{counts[r]}</span>}
          </span>
        ))}
      </div>
    </nav>
  );
}

/** Starting-role reminder: a left column at night, a chip at the left of the day bar. */
export function Reminder({ variant = 'column' }: { variant?: 'column' | 'chip' }) {
  const v = useView(); const t = useT();
  const [open, setOpen] = useState(() => variant === 'column' && window.innerWidth >= 1100);
  if (!v.priv || !v.pub || v.pub.ph === 'lobby' || v.pub.ph === 'end') return null;
  const r = v.priv.r;
  return (
    <aside className={`reminder reminder-${variant} ${open ? 'is-open' : ''}`} aria-label={t('startingRole')}>
      <button type="button" className="reminder-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <RoleArt r={r} className="reminder-mini" />
        <span className="reminder-t"><small>{t('startingRole')}</small><b>{t.role(r)}</b></span>
        <span className="reminder-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="reminder-body">
          <RoleCard r={r} size="md" />
          <TeamBadge r={r} />
          <p className="reminder-desc">{ROLES[r].desc[t.lang]}</p>
        </div>
      )}
    </aside>
  );
}

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    ref.current?.querySelector<HTMLElement>('button, [href], input')?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="close">×</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, disabled, id }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; id?: string }) {
  return (
    <div className="seg hscroll" role="radiogroup" id={id}>
      {options.map(o => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={o.v === value ? 'is-on' : ''} disabled={disabled} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}
