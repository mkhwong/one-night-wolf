import { React, useState, useEffect, useRef, useMemo } from '../react';
import { game } from '../game';
import { ROLES, R, countPool } from '../roles';
import { describeInfo, describeBot } from '../i18n';
import { useT, useView, useMarks, editMark, setAutoApplied, marksAuto, seatName, PINS, Pin, Mark } from './store';
import { RoleArt, RoleChip, Countdown, OrderBar, Reminder } from './common';
import { sfx } from '../sound';

export const ITEMS = [
  { k: 'egg', icon: '🥚' },
  { k: 'tomato', icon: '🍅' },
  { k: 'poo', icon: '💩' },
];

/** Apply night knowledge to this device's private markers once. */
function useAutoMarkers(key: string) {
  const v = useView();
  useEffect(() => {
    const priv = v.priv; if (!priv) return;
    const done = marksAuto(key);
    if (priv.i.length <= done) return;
    const me = priv.seat;
    const addR = (kind: 's' | 'c', i: number, r: number) => editMark(key, kind, i, m => ({ ...m, r: m.r.includes(r) ? m.r : [...m.r, r] }));
    const addP = (kind: 's' | 'c', i: number, p: Pin) => editMark(key, kind, i, m => ({ ...m, p: m.p.includes(p) ? m.p : [...m.p, p] }));
    let witchCard = -1;
    priv.i.slice(done).forEach(i => {
      switch (i.k) {
        case 'team': i.s.forEach(s => { addR('s', s, i.t === R.MASON ? R.MASON : R.WEREWOLF); addP('s', s, i.t === R.MASON ? 'safe' : 'wolf'); }); break;
        case 'pp': addR('s', i.s, i.r); addP('s', i.s, 'peek'); break;
        case 'pc': i.c.forEach((c, k) => { addR('c', c, i.r[k]); addP('c', c, 'peek'); }); if (i.t === R.WITCH) witchCard = i.r[0]; break;
        case 'rob': addR('s', i.s, R.ROBBER); addP('s', i.s, 'swap'); addR('s', me, i.r); break;
        case 'sw': addP('s', i.a, 'swap'); addP('s', i.b, 'swap'); break;
        case 'ws': addP('c', i.c, 'swap'); addP('s', i.s, 'swap'); if (witchCard >= 0) addR('s', i.s, witchCard); break;
        case 'dr': addR('c', i.c, R.DRUNK); addP('c', i.c, 'swap'); addP('s', me, 'swap'); break;
        case 'me': addR('s', me, i.r); addP('s', me, 'sure'); break;
      }
    });
    setAutoApplied(key, priv.i.length);
  }, [key, v.priv?.i.length]);
}

function MarkerBox({ mkey, kind, idx, mark, roles, tall }: { mkey: string; kind: 's' | 'c'; idx: number; mark?: Mark; roles: number[]; tall?: boolean }) {
  const t = useT();
  const m = mark || { r: [], p: [], n: '' };
  const id = `mk-${kind}-${idx}`;
  return (
    <div className={`markers ${tall ? 'markers-tall' : ''}`}>
      <div className="markers-top">
        <select id={id} className="mini-select" value="" aria-label={t('suspect')} onChange={e => { const r = Number(e.target.value); if (!isNaN(r)) editMark(mkey, kind, idx, x => ({ ...x, r: x.r.includes(r) ? x.r : [...x.r, r] })); }}>
          <option value="">{t('suspect')}</option>
          {roles.map(r => <option key={r} value={r}>{t.role(r)}</option>)}
        </select>
        <span className="lock-note" title={t('onlyYou')}>🔒</span>
      </div>
      {m.r.length > 0 && (
        <div className="marker-chips">
          {m.r.map(r => <RoleChip key={r} r={r} onRemove={() => editMark(mkey, kind, idx, x => ({ ...x, r: x.r.filter(y => y !== r) }))} />)}
        </div>
      )}
      <div className="pins" role="group" aria-label={t('onlyYou')}>
        {PINS.map(p => (
          <button key={p.k} type="button" className={`pin ${m.p.includes(p.k) ? 'is-on' : ''}`} title={t('pin_' + p.k)} aria-pressed={m.p.includes(p.k)}
            onClick={() => editMark(mkey, kind, idx, x => ({ ...x, p: x.p.includes(p.k) ? x.p.filter(y => y !== p.k) : [...x.p, p.k] }))}>
            <span aria-hidden="true">{p.icon}</span><span className="sr">{t('pin_' + p.k)}</span>
          </button>
        ))}
      </div>
      <textarea id={id + '-n'} className="note" rows={tall ? 3 : 2} placeholder={t('notePh')} value={m.n} maxLength={200}
        onChange={e => { const val = e.target.value; editMark(mkey, kind, idx, x => ({ ...x, n: val })); }} />
    </div>
  );
}

function PlayerCard({ seat, mkey, roles, aiming, onAim, contested, hunted }: { seat: number; mkey: string; roles: number[]; aiming: number; onAim: (s: number) => void; contested: Record<number, number>; hunted?: boolean }) {
  const v = useView(); const t = useT();
  const marks = useMarks(mkey);
  const pub = v.pub!;
  const [pid, name, bot] = pub.seats[seat];
  const me = seat === v.mySeat;
  const claim = v.claims[seat];
  const off = pub.off.includes(seat);
  return (
    <article className={`pcard ${me ? 'is-me' : ''} ${aiming >= 0 && !me ? 'is-target' : ''} ${hunted ? 'is-hunted' : ''}`} data-pseat={seat}
      onClick={() => { if (aiming >= 0 && !me) onAim(seat); }}>
      <header className="pcard-head">
        {aiming >= 0 && !me
          ? <span className="pcard-no pcard-aim" aria-hidden="true">{ITEMS[aiming].icon}</span>
          : <span className="pcard-no mono">{seat + 1}</span>}
        <span className="pcard-name">{name}</span>
        <span className="pcard-tags">
          {me && <span className="tag">{t('you')}</span>}
          {bot ? <span className="tag tag-dim">{t('bot')}</span> : null}
          {off && <span className="tag tag-warn">{t('offline')}</span>}
        </span>
      </header>
      <div className="pcard-claim">
        {claim ? <RoleChip r={claim.role} extra={contested[claim.role] > 1 ? <span className="clash" title="⚔">⚔{contested[claim.role]}</span> : null} /> : <span className="muted small">—</span>}
        {v.peace[seat] && <span className="dove" title={t('peaceBadge')}>🕊 {t('peaceBadge')}</span>}
      </div>
      {!me && <MarkerBox mkey={mkey} kind="s" idx={seat} mark={marks.s[seat]} roles={roles} />}
      {me && <MarkerBox mkey={mkey} kind="s" idx={seat} mark={marks.s[seat]} roles={roles} />}
      <span className="splat-slot" aria-hidden="true" />
      <span hidden>{pid}</span>
    </article>
  );
}

function Chat({ open, setOpen }: { open: boolean; setOpen: (b: boolean) => void }) {
  const v = useView(); const t = useT();
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(0);
  const nm = (s: number) => seatName(v, s);
  useEffect(() => { if (open) { setSeen(v.chat.length); requestAnimationFrame(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }); } }, [open, v.chat.length]);
  const unread = Math.max(0, v.chat.length - seen);
  if (!open) return (
    <button type="button" className="chat-pill" id="chat-open" onClick={() => setOpen(true)}>
      💬 {t('chat')} {unread > 0 && <span className="badge">{unread}</span>}
    </button>
  );
  return (
    <section className="chat-drawer" aria-label={t('chat')}>
      <header className="chat-head"><h3>{t('chat')}</h3><button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>{t('minimize')}</button></header>
      <div className="chat-list" ref={list}>
        {v.chat.map(c => (
          <p key={c.key} className={`chat-line ${c.sys ? 'is-sys' : ''} ${c.seat === v.mySeat ? 'is-me' : ''}`}>
            <b>{c.seat + 1}·{nm(c.seat)}</b>{' '}
            {c.sys ? <span>{t('claimedChat', { role: t.role(c.sys.r) })}</span> : c.bot ? <span>{describeBot(c.bot, t.lang, nm)}</span> : <span>{c.text}</span>}
          </p>
        ))}
      </div>
      <form className="chat-form" onSubmit={e => { e.preventDefault(); if (text.trim()) { game.chat(text); setText(''); } }}>
        <input id="chat-input" value={text} onChange={e => setText(e.target.value)} maxLength={120} placeholder={t('chatPh')} autoComplete="off" />
        <button type="submit" className="btn btn-sm btn-moon">{t('send')}</button>
      </form>
    </section>
  );
}

export function HuntButton() {
  const v = useView(); const t = useT();
  const pub = v.pub; const priv = v.priv;
  if (!pub || !priv || !pub.cfg.hr || priv.r !== R.HUNTER || !(pub.ph === 'day' || pub.ph === 'vote')) return null;
  return <button type="button" className="btn btn-ember" id="hunt-btn" title={t('huntAs')} onClick={() => { sfx.bow(); game.huntAim(); }}>🏹 {t('hunt')}</button>;
}

export function Day() {
  const v = useView(); const t = useT();
  const pub = v.pub!; const priv = v.priv;
  const n = pub.seats.length;
  const mkey = `${v.code}:${pub.ep}:${v.pid}`;
  useAutoMarkers(mkey);
  const marks = useMarks(mkey);
  const [chatOpen, setChatOpen] = useState(false);
  const [armOpen, setArmOpen] = useState(false);
  const [armed, setArmed] = useState(-1);
  const armRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!armOpen) return;
    const close = (e: PointerEvent) => { if (armRef.current && !armRef.current.contains(e.target as Node)) setArmOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [armOpen]);
  const lastThrow = useRef(0);
  const roles = useMemo(() => Array.from(new Set(pub.cfg.pool)).sort((a, b) => a - b), [pub.cfg.pool.join()]);
  const contested = useMemo(() => {
    const c: Record<number, number> = {};
    Object.values(v.claims).forEach(x => { c[x.role] = (c[x.role] || 0) + 1; });
    return c;
  }, [v.claims]);
  const claimers = (r: number) => Object.entries(v.claims).filter(([, x]) => x.role === r).map(([s]) => Number(s));
  const myClaim = v.claims[v.mySeat]?.role ?? -1;
  const nm = (s: number) => seatName(v, s);
  const throwAt = (s: number) => {
    if (armed < 0 || s === v.mySeat) return;
    const now = Date.now(); if (now - lastThrow.current < 900) return;
    lastThrow.current = now;
    game.throwAt(armed, s);
    setArmed(-1);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setArmed(-1); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  useEffect(() => {
    if (armed < 0) return;
    // a tap anywhere else cancels; `click` (not pointerdown) so scrolling to find someone doesn't
    const off = (e: MouseEvent) => {
      const el = e.target as Element;
      if (el.closest && !el.closest('.pcard.is-target') && !el.closest('.armory')) setArmed(-1);
    };
    const id = setTimeout(() => {
      document.addEventListener('click', off);
      // if no flashing player is on screen (phones), bring the nearest one into view
      const targets = Array.from(document.querySelectorAll('.pcard.is-target'));
      const onScreen = targets.some(el => { const r = el.getBoundingClientRect(); return r.bottom > 60 && r.top < window.innerHeight - 60; });
      if (!onScreen && targets.length) {
        const mid = window.innerHeight / 2;
        const near = targets.reduce((a, b) => Math.abs(a.getBoundingClientRect().top - mid) < Math.abs(b.getBoundingClientRect().top - mid) ? a : b);
        near.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      }
    }, 0);
    return () => { clearTimeout(id); document.removeEventListener('click', off); };
  }, [armed]);
  useEffect(() => { sfx.dawn(); }, []);
  const half = Math.ceil(n / 2);
  const left = Array.from({ length: half }, (_, i) => i);
  const right = Array.from({ length: n - half }, (_, i) => i + half);
  const info = priv?.i || [];
  const counts = countPool(pub.cfg.pool);
  const card = (s: number) => <PlayerCard key={s} seat={s} mkey={mkey} roles={roles} aiming={armed} onAim={throwAt} contested={contested} />;

  return (
    <main className={`day ${armed >= 0 ? 'is-aiming' : ''}`}>
      <header className="day-bar">
        <Reminder variant="chip" />
        <div className="day-title"><p className="eyebrow">{t('dawn')}</p><h1 className="display">{t('discussion')}</h1></div>
        <div className="day-actions hscroll">
          <Countdown end={pub.te} total={pub.cfg.dd * 1000} big warnAt={30000} />
          <HuntButton />
          {v.isHost && <button type="button" className="btn btn-moon" id="start-vote" onClick={() => { sfx.gavel(); game.skipToVote(); }}>{t('startVote')}</button>}
        </div>
      </header>
      <p className="sr" role="status">{armed >= 0 ? t('aimHint', { item: t(ITEMS[armed].k) }) : ''}</p>
      <div className="council">
        <div className="bench bench-left">{left.map(card)}</div>
        <section className="desk panel">
          <header className="panel-head"><h2>{t('claimDesk')}</h2></header>
          <p className="muted small">{t('claimHint')}</p>
          <div className="claim-grid">
            {roles.map(r => {
              const who = claimers(r);
              return (
                <button key={r} type="button" className={`claim-btn team-${ROLES[r].team} ${myClaim === r ? 'is-mine' : ''}`} onClick={() => { sfx.herald(); game.claim(r); }} data-role={r}>
                  <RoleArt r={r} className="claim-art" />
                  <span className="claim-name">{t.role(r)}{counts[r] > 1 ? <small> ×{counts[r]}</small> : null}</span>
                  {who.length > 0 && <span className="claim-who mono">{who.map(s => '#' + (s + 1)).join(' ')}</span>}
                  {who.length > 1 && <span className="clash">⚔{who.length}</span>}
                </button>
              );
            })}
          </div>
          {myClaim >= 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => game.claim(-1)}>{t('unclaim')}</button>}

          <div className="learned">
            <h3>{t('learned')}</h3>
            {info.length ? <ul className="info-list">{info.map((i, k) => <li key={k} className={`info info-${i.k}`}>{describeInfo(i, t.lang, nm)}</li>)}</ul> : <p className="muted small">{t('nothing')}</p>}
          </div>

          <div className="center-marks">
            <h3>{t('centerCards')} <small className="muted">· {t('onlyYou')}</small></h3>
            <div className="center-mark-grid">
              {[0, 1, 2].map(c => (
                <div key={c} className="center-box">
                  <div className="center-box-head"><span className="mini-back" aria-hidden="true" /> {t('centerN', { n: c + 1 })}</div>
                  <MarkerBox mkey={mkey} kind="c" idx={c} mark={marks.c[c]} roles={roles} tall />
                </div>
              ))}
            </div>
          </div>

          <label className="switch">
            <input id="peace-toggle" type="checkbox" checked={!!v.peace[v.mySeat]} onChange={e => game.setPeace(e.target.checked)} />
            <span className="switch-ui" aria-hidden="true" />
            <span>🕊 {t('peaceToggle')}</span>
          </label>
        </section>
        <div className="bench bench-right">{right.map(card)}</div>
      </div>

      <div className={`armory ${armOpen ? 'is-open' : ''}`} ref={armRef}
        onPointerEnter={e => { if (e.pointerType === 'mouse') setArmOpen(true); }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setArmOpen(false); }}>
        <button type="button" className={`armory-tab ${armed >= 0 ? 'is-armed' : ''}`} aria-expanded={armOpen} aria-label={armed >= 0 ? t('cancel') : t('armory')}
          onClick={e => {
            const pt = (e.nativeEvent as PointerEvent).pointerType;
            // cancelling with a mouse leaves the tray open (the pointer is still over it) so another item is one click away
            if (armed >= 0) { setArmed(-1); setArmOpen(pt === 'mouse'); return; }
            if (pt === 'mouse') setArmOpen(true); else setArmOpen(o => !o);
          }}>
          {armed >= 0
            ? <span className="armory-armed" aria-hidden="true">{ITEMS[armed].icon}<b>×</b></span>
            : <><span className="armory-tab-desk" aria-hidden="true">«</span><span className="armory-tab-phone" aria-hidden="true">🍅</span></>}
        </button>
        <div className="armory-tray">
          <p className="armory-title">{t('armory')}</p>
          {ITEMS.map((it, i) => (
            <button key={it.k} type="button" className={`armory-item item-${it.k} ${armed === i ? 'is-on' : ''}`} onClick={() => { sfx.click(); setArmed(a => (a === i ? -1 : i)); setArmOpen(false); }}>
              <span className="armory-icon" aria-hidden="true">{it.icon}</span><span>{t(it.k)}</span>
            </button>
          ))}
        </div>
      </div>

      <Chat open={chatOpen} setOpen={setChatOpen} />
      <OrderBar pub={pub} />
    </main>
  );
}
