import { React, useState, useEffect, useRef, useMemo, useLayoutEffect } from '../react';
import { game } from '../game';
import { ROLES, R } from '../roles';
import { INTRO_MS, Info } from '../engine';
import { describeInfo } from '../i18n';
import { useT, useView, useNow, seatName } from './store';
import { RoleArt, CardBack, Countdown, OrderBar, Reminder } from './common';
import { sfx } from '../sound';

type Spec = { kind: 'none' | 'player' | 'center'; count: number; self: boolean; skip: boolean; hint: string };
const NONE: Spec = { kind: 'none', count: 0, self: false, skip: false, hint: '' };

function actionSpec(role: number, info: Info[], seerMode: 'p' | 'c'): Spec {
  const acted = info.some(i => i.k !== 'team' && i.k !== 'lone' && i.k !== 'me' && !(role === R.WITCH && i.k === 'pc'));
  if (acted) return NONE;
  switch (role) {
    case R.WEREWOLF: return info.some(i => i.k === 'lone') && !info.some(i => i.k === 'pc') ? { kind: 'center', count: 1, self: false, skip: true, hint: 'pickCenter' } : NONE;
    case R.MYSTIC: return { kind: 'player', count: 1, self: false, skip: true, hint: 'pickPlayer' };
    case R.SEER: return seerMode === 'p' ? { kind: 'player', count: 1, self: false, skip: true, hint: 'pickPlayer' } : { kind: 'center', count: 2, self: false, skip: true, hint: 'pickTwoCenter' };
    case R.APPRENTICE: return { kind: 'center', count: 1, self: false, skip: true, hint: 'pickCenter' };
    case R.ROBBER: return { kind: 'player', count: 1, self: false, skip: true, hint: 'pickPlayer' };
    case R.WITCH: return info.some(i => i.k === 'pc') ? { kind: 'player', count: 1, self: true, skip: false, hint: 'pickGive' } : { kind: 'center', count: 1, self: false, skip: true, hint: 'pickCenter' };
    case R.TROUBLEMAKER: return { kind: 'player', count: 2, self: false, skip: true, hint: 'pickTwoPlayers' };
    case R.GREMLIN: return { kind: 'player', count: 2, self: true, skip: true, hint: 'pickTwoPlayers' };
    case R.DRUNK: return { kind: 'center', count: 1, self: false, skip: false, hint: 'pickCenter' };
    case R.ALPHA: return { kind: 'player', count: 1, self: false, skip: false, hint: 'pickAlpha' };
    default: return NONE;
  }
}

interface Anim { id: string; kind: 'swap' | 'look'; a: string; b: string }

function seatPos(i: number, n: number, me: number) {
  const base = me >= 0 ? me : 0;
  const th = Math.PI / 2 + (2 * Math.PI * (i - base)) / n;
  return { x: 50 + 41 * Math.cos(th), y: 50 + 38 * Math.sin(th) };
}
const CENTER_POS = [{ x: 37, y: 50 }, { x: 50, y: 50 }, { x: 63, y: 50 }];
// with the Alpha Wolf's extra Werewolf card the middle row shifts left to make room
const CENTER_POS_ALPHA = [{ x: 31, y: 50 }, { x: 43, y: 50 }, { x: 55, y: 50 }];
const WOLF_POS = { x: 69, y: 50 };

export function Table({ n, names, me, pickKind, picked, canPick, onPick, faces, arrows, anim, dim, wolf = false }: {
  n: number; names: string[]; me: number; pickKind: Spec['kind']; picked: { s: number[]; c: number[] };
  canPick: (kind: 's' | 'c', i: number) => boolean; onPick: (kind: 's' | 'c', i: number) => void;
  faces: { s: Record<number, number>; c: Record<number, number> }; arrows: number[]; anim: Anim | null; dim: boolean; wolf?: boolean;
}) {
  const centers = wolf ? CENTER_POS_ALPHA : CENTER_POS;
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const posOf = (key: string) => {
    const [k, iStr] = key.split(':'); const i = Number(iStr);
    return k === 's' ? seatPos(i, n, me) : k === 'w' ? WOLF_POS : centers[i];
  };
  useLayoutEffect(() => {
    if (!anim || !box.current) return;
    const el = box.current;
    const W = el.clientWidth, H = el.clientHeight;
    const A = posOf(anim.a), B = posOf(anim.b);
    const ax = (A.x / 100) * W, ay = (A.y / 100) * H, bx = (B.x / 100) * W, by = (B.y / 100) * H;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fly = (x0: number, y0: number, x1: number, y1: number, lift: number, cls: string) => {
      const g = document.createElement('div'); g.className = 'ghost-card ' + cls;
      el.appendChild(g);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const dx = x1 - x0, dy = y1 - y0; const len = Math.hypot(dx, dy) || 1;
      const cx = mx - (dy / len) * lift, cy = my + (dx / len) * lift;
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 14; k++) {
        const u = k / 14; const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1; const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
        frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${Math.sin(u * Math.PI) * 18}deg) scale(${1 + Math.sin(u * Math.PI) * 0.25})` });
      }
      const a = g.animate(frames, { duration: reduce ? 1 : 1100, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
      a.onfinish = () => g.remove();
    };
    if (anim.kind === 'swap') {
      fly(ax, ay, bx, by, Math.min(W, H) * 0.18, 'ghost-a');
      fly(bx, by, ax, ay, Math.min(W, H) * 0.18, 'ghost-b');
    } else {
      const beam = document.createElement('div'); beam.className = 'beam';
      const len = Math.hypot(bx - ax, by - ay);
      beam.style.width = len + 'px'; beam.style.left = ax + 'px'; beam.style.top = ay + 'px';
      beam.style.transform = `rotate(${Math.atan2(by - ay, bx - ax)}rad)`;
      el.appendChild(beam);
      const a = beam.animate([{ opacity: 0, transform: beam.style.transform + ' scaleX(0)' }, { opacity: 1, transform: beam.style.transform + ' scaleX(1)', offset: 0.35 }, { opacity: 0, transform: beam.style.transform + ' scaleX(1)' }], { duration: reduce ? 1 : 1300, easing: 'ease-out', transformOrigin: 'left center' } as any);
      a.onfinish = () => beam.remove();
    }
  }, [anim?.id]);

  const mePos = me >= 0 ? seatPos(me, n, me) : null;
  return (
    <div className={`table ${dim ? 'is-dim' : ''}`} ref={box}>
      <div className="table-top" aria-hidden="true" />
      <svg className="table-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
        {mePos && arrows.map(s => {
          const p = seatPos(s, n, me);
          const dx = p.x - mePos.x, dy = p.y - mePos.y; const L = Math.hypot(dx, dy) || 1;
          const sx = mePos.x + (dx / L) * 7, sy = mePos.y + (dy / L) * 7, ex = p.x - (dx / L) * 8, ey = p.y - (dy / L) * 8;
          return <path key={s} className="team-arrow" d={`M${sx} ${sy} Q${(sx + ex) / 2 - dy * 0.12} ${(sy + ey) / 2 + dx * 0.12} ${ex} ${ey}`} markerEnd="url(#ah)" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {[0, 1, 2].map(c => {
        const p = centers[c]; const sel = picked.c.includes(c); const ok = pickKind === 'center' && canPick('c', c);
        return (
          <button key={'c' + c} type="button" className={`tcard tcard-center ${sel ? 'is-sel' : ''} ${ok ? 'is-pickable' : ''}`} style={{ left: p.x + '%', top: p.y + '%' }}
            disabled={!ok && !sel} onClick={() => onPick('c', c)} aria-label={t('centerN', { n: c + 1 })} data-spot={'c:' + c}>
            {faces.c[c] !== undefined ? <span className="tcard-face"><RoleArt r={faces.c[c]} /></span> : <CardBack />}
            <span className="tcard-label">{t('centerN', { n: c + 1 })}</span>
          </button>
        );
      })}
      {wolf && (
        <div className="tcard tcard-center tcard-wolf" style={{ left: WOLF_POS.x + '%', top: WOLF_POS.y + '%' }} data-spot="w:0" role="img" aria-label={t('wolfCenter')}>
          <CardBack />
          <span className="tcard-label">{t('wolfCenter')}</span>
        </div>
      )}
      {Array.from({ length: n }, (_, i) => {
        const p = seatPos(i, n, me); const sel = picked.s.includes(i); const ok = pickKind === 'player' && canPick('s', i);
        return (
          <button key={'s' + i} type="button" className={`tcard tcard-seat ${i === me ? 'is-me' : ''} ${sel ? 'is-sel' : ''} ${ok ? 'is-pickable' : ''} ${arrows.includes(i) ? 'is-mate' : ''}`}
            style={{ left: p.x + '%', top: p.y + '%' }} disabled={!ok && !sel} onClick={() => onPick('s', i)} aria-label={names[i]} data-spot={'s:' + i}>
            {faces.s[i] !== undefined ? <span className="tcard-face"><RoleArt r={faces.s[i]} /></span> : <CardBack />}
            <span className="tcard-label"><b className="mono">{i + 1}</b> {names[i]}{i === me ? ` · ${t('you_short')}` : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Night() {
  const v = useView(); const t = useT(); const now = useNow(200);
  const pub = v.pub!; const priv = v.priv;
  const n = pub.seats.length; const me = v.mySeat;
  const ti = pub.ti;
  const role = ti >= 0 && ti < pub.tr.length ? pub.tr[ti] : -1;
  const inIntro = now < pub.ts + INTRO_MS;
  const myRole = priv?.r ?? -1;
  // the Alpha Wolf wakes with the werewolves too
  const myTurn = role >= 0 && (myRole === role || (role === R.WEREWOLF && myRole === R.ALPHA));
  const allInfo = priv?.i || [];
  const turnInfo = useMemo(() => allInfo.filter(i => i.t === role), [allInfo, role]);
  const alphaInPlay = pub.cfg.pool.includes(R.ALPHA);
  const knownWolves = useMemo(() => {
    const tm = allInfo.find(i => i.k === 'team' && i.t === R.WEREWOLF);
    return tm && tm.k === 'team' ? tm.s : [];
  }, [allInfo.length]);
  const [seerMode, setSeerMode] = useState<'p' | 'c'>('p');
  const [picked, setPicked] = useState<{ s: number[]; c: number[] }>({ s: [], c: [] });
  const [anim, setAnim] = useState<Anim | null>(null);
  const seenInfo = useRef(allInfo.length);
  const names = pub.seats.map(x => x[1]);
  const nm = (s: number) => seatName(v, s);

  useEffect(() => { setPicked({ s: [], c: [] }); setSeerMode('p'); }, [ti]);
  useEffect(() => { if (ti >= 0) { sfx.drum(); setTimeout(() => sfx.slash(), 380); } else sfx.howl(); }, [ti]);
  useEffect(() => { if (myTurn && !inIntro) sfx.chime(); }, [myTurn, inIntro]);

  // animate my own action results
  useEffect(() => {
    const fresh = allInfo.slice(seenInfo.current);
    seenInfo.current = allInfo.length;
    for (const i of fresh) {
      const id = Math.random().toString(36).slice(2);
      if (i.k === 'rob') { setAnim({ id, kind: 'swap', a: 's:' + me, b: 's:' + i.s }); sfx.swap(); }
      else if (i.k === 'sw') { setAnim({ id, kind: 'swap', a: 's:' + i.a, b: 's:' + i.b }); sfx.swap(); }
      else if (i.k === 'ws') { setAnim({ id, kind: 'swap', a: 'c:' + i.c, b: 's:' + i.s }); sfx.swap(); }
      else if (i.k === 'dr') { setAnim({ id, kind: 'swap', a: 's:' + me, b: 'c:' + i.c }); sfx.swap(); }
      else if (i.k === 'aw') { setAnim({ id, kind: 'swap', a: 'w:0', b: 's:' + i.s }); sfx.howl(); }
      else if (i.k === 'pp') { setAnim({ id, kind: 'look', a: 's:' + me, b: 's:' + i.s }); sfx.reveal(); }
      else if (i.k === 'pc') { setAnim({ id, kind: 'look', a: 's:' + me, b: 'c:' + i.c[0] }); sfx.reveal(); }
    }
  }, [allInfo.length]);

  const spec = myTurn && !inIntro && !v.pending ? actionSpec(role, turnInfo, seerMode) : NONE;
  const canPick = (kind: 's' | 'c', i: number) => {
    if (kind === 's') return spec.kind === 'player' && (spec.self || i !== me) && !(role === R.ALPHA && knownWolves.includes(i));
    return spec.kind === 'center';
  };
  const onPick = (kind: 's' | 'c', i: number) => {
    sfx.click();
    setPicked(p => {
      const list = kind === 's' ? p.s : p.c;
      let next = list.includes(i) ? list.filter(x => x !== i) : [...list, i];
      if (next.length > spec.count) next = next.slice(-spec.count);
      return kind === 's' ? { s: next, c: [] } : { s: [], c: next };
    });
  };
  const ready = spec.kind === 'player' ? picked.s.length === spec.count : spec.kind === 'center' ? picked.c.length === spec.count : false;
  const confirm = () => {
    if (!ready) return;
    let x: any;
    if (spec.kind === 'player') x = spec.count === 1 ? { s: picked.s[0] } : { a: picked.s[0], b: picked.s[1] };
    else x = spec.count === 1 ? { c: picked.c[0] } : { c: picked.c.slice(0, 2) };
    game.nightAct(x); setPicked({ s: [], c: [] });
  };

  // faces I know this night
  const faces = useMemo(() => {
    const f = { s: {} as Record<number, number>, c: {} as Record<number, number> };
    for (const i of allInfo) {
      if (i.k === 'pp') f.s[i.s] = i.r;
      if (i.k === 'pc') i.c.forEach((c, k) => { f.c[c] = i.r[k]; });
      if (i.k === 'rob') { f.s[me] = i.r; delete f.s[i.s]; }
      if (i.k === 'me') f.s[me] = i.r;
      if (i.k === 'ws') { delete f.c[i.c]; delete f.s[i.s]; }
      if (i.k === 'sw') { const fa = f.s[i.a], fb = f.s[i.b]; delete f.s[i.a]; delete f.s[i.b]; if (fa !== undefined) f.s[i.b] = fa; if (fb !== undefined) f.s[i.a] = fb; }
      if (i.k === 'dr') { delete f.s[me]; delete f.c[i.c]; }
      if (i.k === 'aw') delete f.s[i.s];
    }
    return f;
  }, [allInfo.length, me]);

  const arrows = useMemo(() => {
    const tm = turnInfo.find(i => i.k === 'team');
    return tm && tm.k === 'team' ? tm.s : [];
  }, [turnInfo]);

  const quiet = role < 0;
  return (
    <main className={`night play ${myTurn && !inIntro ? 'has-dock' : ''}`}>
      <Reminder />
      <div className="night-stage">
        <section className={`theater ${myTurn ? 'is-mine' : ''}`} key={'th' + ti} aria-live="polite">
          <div className="theater-sky" aria-hidden="true"><span className="fog f1" /><span className="fog f2" /></div>
          {!quiet && <div className="theater-slash" aria-hidden="true" />}
          <div className="theater-row">
            {!quiet ? (
              <div className={`theater-hero team-${ROLES[role].team} ${!myTurn && !inIntro ? 'is-asleep' : ''}`} key={'h' + ti + ':' + allInfo.length}>
                <RoleArt r={role} alt={role === R.SEER && myTurn && turnInfo.length > 0} className="theater-art" />
              </div>
            ) : <div className="theater-hero"><RoleArt r={R.INSOMNIAC} className="theater-art" /></div>}
            <div className="theater-copy">
              <p className="eyebrow mono">{quiet ? t('night') : t('turnOf', { i: ti + 1, n: pub.tr.length })}</p>
              <h1 className="theater-title">{quiet ? t('nightPasses') : <><span>{ROLES[role].zh}</span><small>{ROLES[role].en}</small></>}</h1>
              {!quiet && <p className="theater-act">{ROLES[role].act[t.lang]}</p>}
              <div className="theater-status">
                {quiet ? null : myTurn ? <span className="pill pill-moon">{t('yourTurn')}</span> : <span className="pill">{t('closeEyes')} {t('awake', { role: t.role(role) })}</span>}
                {!inIntro && <Countdown end={pub.te} total={pub.cfg.tn * 1000} warnAt={4000} />}
              </div>
            </div>
          </div>
        </section>

        <div className="night-grid">
          <Table n={n} names={names} me={me} pickKind={spec.kind} picked={picked} canPick={canPick} onPick={onPick}
            faces={faces} arrows={arrows} anim={anim} dim={!myTurn && !quiet} wolf={alphaInPlay} />

          <section className="action-panel panel" aria-live="polite">
            {myTurn ? (
              <>
                <h2>{t('yourTurn')}</h2>
                {inIntro ? <p className="muted">{ROLES[role].act[t.lang]}</p> : (
                  <>
                    <div className="action-dock is-on">
                      {role === R.SEER && spec.kind !== 'none' && (
                        <div className="seg" role="radiogroup">
                          <button type="button" role="radio" aria-checked={seerMode === 'p'} className={seerMode === 'p' ? 'is-on' : ''} onClick={() => { setSeerMode('p'); setPicked({ s: [], c: [] }); }}>{t('seerPlayer')}</button>
                          <button type="button" role="radio" aria-checked={seerMode === 'c'} className={seerMode === 'c' ? 'is-on' : ''} onClick={() => { setSeerMode('c'); setPicked({ s: [], c: [] }); }}>{t('seerCenter')}</button>
                        </div>
                      )}
                      {spec.kind !== 'none' && <p className="hint">{t(spec.hint)}</p>}
                      {spec.kind === 'center' && (
                        <div className="center-pick">
                          {[0, 1, 2].map(c => <button key={c} type="button" className={`btn btn-sm ${picked.c.includes(c) ? 'is-on' : ''}`} onClick={() => onPick('c', c)}>{t('centerN', { n: c + 1 })}</button>)}
                        </div>
                      )}
                      {spec.kind === 'player' && picked.s.length > 0 && <p className="dock-picked">{picked.s.map(s2 => `${s2 + 1} ${names[s2]}`).join(' ⇄ ')}</p>}
                      {spec.kind !== 'none' && (
                        <div className="row-gap">
                          <button type="button" className="btn btn-moon" id="night-confirm" disabled={!ready} onClick={confirm}>{t('confirm')}</button>
                          {spec.skip && <button type="button" className="btn btn-ghost" onClick={() => game.nightAct({ skip: 1 })}>{t('skip')}</button>}
                        </div>
                      )}
                      {v.pending && <p className="muted">{t('waitingResult')}</p>}
                      {spec.kind === 'none' && !v.pending && turnInfo.length > 0 && <p className="dock-result">{describeInfo(turnInfo[turnInfo.length - 1], t.lang, nm)}</p>}
                    </div>
                    <ul className="info-list">
                      {turnInfo.map((i, k) => <li key={k} className={`info info-${i.k}`}>{describeInfo(i, t.lang, nm)}</li>)}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <>
                <h2>{quiet ? t('night') : t('closeEyes')}</h2>
                <p className="muted">{quiet ? t('nightPasses') : t('awake', { role: t.role(role) })}</p>
              </>
            )}
            {allInfo.filter(i => i.t !== role).length > 0 && (
              <div className="learned">
                <h3>{t('learned')}</h3>
                <ul className="info-list">
                  {allInfo.filter(i => i.t !== role).map((i, k) => <li key={k} className={`info info-${i.k}`}>{describeInfo(i, t.lang, nm)}</li>)}
                </ul>
              </div>
            )}
          </section>
        </div>
        <OrderBar pub={pub} />
      </div>
    </main>
  );
}
