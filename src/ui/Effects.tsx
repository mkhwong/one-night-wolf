import { React, useEffect, useState } from '../react';
import { game, ClaimEvent, ThrowEvent } from '../game';
import { useT, useView, seatName } from './store';
import { RoleArt } from './common';
import { ITEMS, isGift } from './Day';
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
  const [gift, setGift] = useState<{ id: string; from: number } | null>(null);
  useEffect(() => game.on('throw', (e: ThrowEvent) => {
    const item = ITEMS[e.item] || ITEMS[0];
    if (isGift(e.item)) { giveFlowers(e, setGift); return; }
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
  if (gift) return <Bouquet from={seatName(v, gift.from)} onClose={() => setGift(null)} />;
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

// ---- flower bouquet: a gift, not a throw
function giveFlowers(e: ThrowEvent, setGift: (g: { id: string; from: number } | null) => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fromEl = document.querySelector(`[data-pseat="${e.from}"]`);
  const toEl = document.querySelector(`[data-pseat="${e.to}"]`);
  sfx.chime();
  if (e.to === game.get().mySeat) {
    setGift({ id: e.id, from: e.from });
    setTimeout(() => setGift(null), 6500);
    return;
  }
  if (!fromEl || !toEl) return;
  // everyone else sees the bouquet float gently across, then petals on the receiver's card
  const A = centerOf(fromEl), B = centerOf(toEl);
  const p = document.createElement('div'); p.className = 'proj proj-gift'; p.textContent = '💐';
  document.body.appendChild(p);
  const lift = Math.max(60, Math.abs(B.x - A.x) * 0.25);
  const frames: Keyframe[] = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16;
    const x = A.x + (B.x - A.x) * u; const y = A.y + (B.y - A.y) * u - Math.sin(u * Math.PI) * lift;
    frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${Math.sin(u * Math.PI * 2) * 12}deg) scale(${1 + Math.sin(u * Math.PI) * 0.3})` });
  }
  const a = p.animate(frames, { duration: reduce ? 1 : 1300, easing: 'ease-in-out' });
  a.onfinish = () => {
    p.remove();
    const slot = toEl.querySelector('.splat-slot');
    if (slot) {
      const s = document.createElement('span'); s.className = 'stain stain-flower'; s.textContent = '💐';
      slot.appendChild(s); setTimeout(() => s.remove(), 6000);
    }
  };
}

const PETALS = Array.from({ length: 14 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 0.37) % 3, dur: 3.2 + (i % 5) * 0.5, hue: i % 3 }));

/** First-person: a hand rises from the bottom of the screen offering a bouquet. */
function Bouquet({ from, onClose }: { from: string; onClose: () => void }) {
  const t = useT();
  return (
    <div className="gift" role="status" aria-label={t('giftFrom', { name: from })} onClick={onClose}>
      <div className="gift-petals" aria-hidden="true">
        {PETALS.map((pt, i) => <span key={i} className={`petal petal-${pt.hue}`} style={{ left: pt.left + '%', animationDelay: pt.delay + 's', animationDuration: pt.dur + 's' }} />)}
      </div>
      <p className="gift-from">{t('giftFrom', { name: from })}</p>
      <svg className="gift-hand" viewBox="0 0 300 420" aria-hidden="true">
        <defs>
          <linearGradient id="gSleeve" x1="0" x2="1"><stop offset="0" stopColor="#3a4f86" /><stop offset="1" stopColor="#24345c" /></linearGradient>
          <linearGradient id="gPaper" x1="0" x2="1"><stop offset="0" stopColor="#f7e7c6" /><stop offset=".5" stopColor="#fff6e2" /><stop offset="1" stopColor="#e9d3a8" /></linearGradient>
          <radialGradient id="gSkin" cx=".4" cy=".35" r=".8"><stop offset="0" stopColor="#ffd9b5" /><stop offset="1" stopColor="#e9ad84" /></radialGradient>
        </defs>
        <g className="gift-bunch" stroke="#1b1d24" strokeWidth="3" strokeLinejoin="round">
          {/* leaves */}
          <path d="M96 120 Q60 96 54 60 Q92 70 112 112 Z" fill="#4f9a5a" />
          <path d="M204 120 Q240 96 246 60 Q208 70 188 112 Z" fill="#4f9a5a" />
          <path d="M150 98 Q138 52 150 20 Q166 54 158 98 Z" fill="#5fae66" />
          {/* flowers */}
          {[[110, 92, '#e2574c'], [150, 70, '#f2c65a'], [190, 92, '#d070b0'], [128, 124, '#f08c9a'], [174, 124, '#9c80e0'], [150, 108, '#e2574c']].map(([x, y, c], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {[0, 72, 144, 216, 288].map(r => <ellipse key={r} rx="11" ry="17" cy="-12" fill={c as string} transform={`rotate(${r})`} />)}
              <circle r="8" fill="#ffe08a" />
            </g>
          ))}
          {/* paper cone */}
          <path d="M84 132 L216 132 L168 268 L132 268 Z" fill="url(#gPaper)" />
          <path d="M84 132 Q150 156 216 132" fill="none" />
          <path d="M120 236 Q150 226 180 236 L172 256 Q150 248 128 256 Z" fill="#e2574c" />
        </g>
        {/* hand gripping the cone, then the sleeve */}
        <g stroke="#1b1d24" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          <path d="M112 268 Q108 236 130 230 L176 230 Q194 236 190 268 L184 318 L118 318 Z" fill="url(#gSkin)" />
          <path d="M126 240 Q150 234 174 240 M124 256 Q150 250 176 256 M124 272 Q150 266 178 272" fill="none" opacity=".6" />
          <path d="M112 262 Q96 246 104 228 Q116 220 126 238" fill="url(#gSkin)" />
          <path d="M108 316 L196 316 L204 420 L100 420 Z" fill="url(#gSleeve)" />
          <rect x="104" y="306" width="96" height="20" rx="8" fill="#f2c65a" />
        </g>
      </svg>
      <button type="button" className="btn btn-moon gift-thanks" onClick={e => { e.stopPropagation(); onClose(); }}>💐 {t('thanks')}</button>
    </div>
  );
}
