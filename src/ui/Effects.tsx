import { React, useEffect, useState } from '../react';
import { game, ClaimEvent, ThrowEvent } from '../game';
import { useT, useView, seatName } from './store';
import { RoleArt } from './common';
import { ITEMS } from './Day';
import { sfx } from '../sound';

export function ClaimToasts() {
  const v = useView(); const t = useT();
  const [toasts, setToasts] = useState<ClaimEvent[]>([]);
  useEffect(() => game.on('claim', (e: ClaimEvent) => {
    sfx.herald();
    setToasts(ts => [...ts.slice(-2), e]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== e.id)), 1000);
  }), []);
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(e => {
        const name = seatName(v, e.seat);
        return (
          <div key={e.id} className="claim-toast">
            <RoleArt r={e.role} className="toast-art" />
            <span>{t('announce', { n: e.seat + 1, name, role: t.role(e.role) })}</span>
          </div>
        );
      })}
    </div>
  );
}

const STAIN: Record<string, string> = { egg: 'stain-egg', tomato: 'stain-tomato', poo: 'stain-poo' };

function centerOf(el: Element) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

export function Throws() {
  const v = useView(); const t = useT();
  const [hit, setHit] = useState<{ id: string; item: number; from: number } | null>(null);
  useEffect(() => game.on('throw', (e: ThrowEvent) => {
    const item = ITEMS[e.item] || ITEMS[0];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fromEl = document.querySelector(`[data-pseat="${e.from}"]`);
    const toEl = document.querySelector(`[data-pseat="${e.to}"]`);
    const mine = e.to === game.get().mySeat;
    sfx.whoosh();
    if (mine) {
      // first-person: it flies straight at you
      const p = document.createElement('div'); p.className = 'fp-proj'; p.textContent = item.icon;
      document.body.appendChild(p);
      const a = p.animate([{ transform: 'translate(-50%,-50%) scale(.15) rotate(0deg)', opacity: 0.4 }, { transform: 'translate(-50%,-50%) scale(5) rotate(540deg)', opacity: 1 }], { duration: reduce ? 1 : 650, easing: 'cubic-bezier(.6,0,.9,.5)' });
      a.onfinish = () => { p.remove(); sfx.splat(); setHit({ id: e.id, item: e.item, from: e.from }); setTimeout(() => setHit(h => (h && h.id === e.id ? null : h)), 5500); };
    }
    if (fromEl && toEl && !mine) {
      const A = centerOf(fromEl), B = centerOf(toEl);
      const p = document.createElement('div'); p.className = 'proj'; p.textContent = item.icon;
      document.body.appendChild(p);
      const lift = Math.max(80, Math.abs(B.x - A.x) * 0.35);
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        const x = A.x + (B.x - A.x) * u; const y = A.y + (B.y - A.y) * u - Math.sin(u * Math.PI) * lift;
        frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${u * 720}deg)` });
      }
      const a = p.animate(frames, { duration: reduce ? 1 : 850, easing: 'linear' });
      a.onfinish = () => {
        p.remove(); sfx.splat();
        const slot = toEl.querySelector('.splat-slot');
        toEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 });
        if (slot) {
          const s = document.createElement('span'); s.className = 'stain ' + STAIN[item.k]; slot.appendChild(s);
          setTimeout(() => s.remove(), 6000);
        }
      };
    }
  }), []);
  if (!hit) return null;
  const item = ITEMS[hit.item] || ITEMS[0];
  return (
    <div className={`fp-splat fp-${item.k}`} role="status" aria-label={t(item.k)}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g className="fp-blob">
          <path d="M200 60c30 0 34 30 58 34s52-14 62 10-24 36-16 58 40 34 22 56-48 2-68 18-26 46-58 44-30-36-54-46-56 8-66-18 22-38 14-60-34-36-18-58 46 6 66-6 28-32 58-32z" />
          <circle cx="92" cy="84" r="14" /><circle cx="318" cy="70" r="10" /><circle cx="330" cy="236" r="16" /><circle cx="70" cy="226" r="9" /><circle cx="250" cy="40" r="7" />
        </g>
        {item.k === 'egg' && <ellipse className="fp-yolk" cx="204" cy="150" rx="46" ry="40" />}
        {item.k === 'tomato' && <g className="fp-mold"><circle cx="170" cy="130" r="10" /><circle cx="236" cy="170" r="14" /><circle cx="214" cy="110" r="6" /><circle cx="160" cy="190" r="8" /></g>}
        <g className="fp-drips"><rect x="150" y="200" width="10" height="60" rx="5" /><rect x="210" y="210" width="12" height="80" rx="6" /><rect x="262" y="190" width="8" height="50" rx="4" /></g>
      </svg>
      {item.k === 'poo' && <div className="flies" aria-hidden="true"><span>·</span><span>·</span><span>·</span></div>}
      <p className="fp-from">{item.icon} {seatName(v, hit.from)}</p>
      <button type="button" className="btn btn-moon" onClick={() => setHit(null)}>🧽 {t('wipe')}</button>
    </div>
  );
}
