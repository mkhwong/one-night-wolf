import { React, useState, useEffect } from '../react';
import { game } from '../game';
import { roomCapability, normCode, peerAvailable } from '../net';
import { ROLES, R, countPool, poolFromCounts, poolProblem, POOL_ORDER, MAX_PLAYERS, randomPool } from '../roles';
import { useT, useView } from './store';
import { RoleArt, Seg } from './common';
import { sfx } from '../sound';

const LINEUP = [R.WITCH, R.ROBBER, R.SEER, R.WEREWOLF, R.TROUBLEMAKER, R.HUNTER, R.DRUNK];

export function Home() {
  const t = useT(); const v = useView();
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'room' | 'peer' | 'local' | null>(null);
  useEffect(() => { let on = true; roomCapability().then(r => { if (on) setMode(r ? 'room' : peerAvailable() ? 'peer' : 'local'); }); return () => { on = false; }; }, []);
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-sky" aria-hidden="true"><span className="hero-moon" /></div>
        <div className="hero-copy">
          <h1 className="hero-title">一夜狼人殺<small>{t('appSub')}</small></h1>
          <p className="hero-tag">{t('tagline')}</p>
          <p className="hero-lead">{t('lead')}</p>
        </div>
        <div className="lineup" aria-hidden="true">
          {LINEUP.map((r, i) => <RoleArt key={r} r={r} className={`lineup-${i}`} />)}
          <span className="lineup-hill" />
        </div>
      </section>
      <section className="entry">
        <div className="entry-card">
          <h2>{t('create')}</h2>
          <p className="muted">{t('shareHint')}</p>
          <button type="button" className="btn btn-moon btn-lg" id="create-room" onClick={() => { sfx.click(); game.create(); }}>{t('create')}</button>
        </div>
        <form className="entry-card" onSubmit={e => { e.preventDefault(); sfx.click(); game.join(code); }}>
          <h2>{t('joinTitle')}</h2>
          <div className="code-row">
            <input id="join-code" className="code-input" value={code} onChange={e => setCode(normCode(e.target.value))}
              placeholder={t('codePh')} maxLength={5} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" aria-label={t('codePh')} />
            <button type="submit" className="btn btn-lg" disabled={code.length !== 5}>{t('join')}</button>
          </div>
          {v.err === 'badCode' && <p className="err">{t('badCode')}</p>}
          {v.err === 'connect' && <p className="err">{t('connectErr')}</p>}
        </form>
      </section>
      {mode && <p className={`mode-note mode-${mode}`}>{t(mode === 'room' ? 'modeRoom' : mode === 'peer' ? 'modePeer' : 'modeLocal')}</p>}
    </main>
  );
}

export function NameEntry() {
  const t = useT(); const v = useView();
  const [name, setName] = useState(v.name);
  return (
    <main className="center-screen">
      <form className="panel name-panel" onSubmit={e => { e.preventDefault(); sfx.click(); game.setName(name); }}>
        <p className="eyebrow">{t('roomCode')} <b className="mono">{v.code}</b></p>
        <h1 className="display">{t('nameTitle')}</h1>
        <p className="muted">{t('nameHint')}</p>
        <input id="player-name" className="text-input" value={name} maxLength={12} onChange={e => setName(e.target.value)} placeholder={t('namePh')} autoFocus autoComplete="nickname" />
        <button type="submit" className="btn btn-moon btn-lg" disabled={!name.trim()}>{t('cont')}</button>
      </form>
    </main>
  );
}

export function StatusScreen() {
  const t = useT(); const v = useView();
  const map: Record<string, [string, string]> = {
    connecting: [t('connecting'), ''],
    nohost: [t('nohost', { c: v.code }), t('nohostBody')],
    locked: [t('lockedTitle'), t('lockedBody')],
    full: [t('fullTitle'), t('fullBody')],
    hostgone: [t('hostGone'), t('hostGoneBody')],
  };
  const [title, body] = map[v.status] || ['', ''];
  return (
    <main className="center-screen">
      <div className="panel status-panel">
        {v.status === 'connecting' ? <span className="spinner" aria-hidden="true" /> : <RoleArt r={v.status === 'locked' ? R.MINION : R.INSOMNIAC} className="status-art" />}
        <h1 className="display">{title}</h1>
        {body && <p className="muted">{body}</p>}
        <div className="row-gap">
          {v.status === 'nohost' && <button type="button" className="btn btn-moon" onClick={() => { const c = v.code; game.leave(); game.join(c); }}>{t('retry')}</button>}
          {v.status !== 'connecting' && <button type="button" className="btn" onClick={() => game.leave()}>{t('back')}</button>}
        </div>
      </div>
    </main>
  );
}

function CopyCode({ code }: { code: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-sm" onClick={e => {
      const el = (e.currentTarget.parentElement?.querySelector('.room-code') as HTMLElement) || null;
      navigator.clipboard?.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {
        if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
      });
    }}>{done ? t('copied') : t('copy')}</button>
  );
}

export function Lobby() {
  const t = useT(); const v = useView();
  const pub = v.pub!;
  const host = v.isHost;
  const n = pub.seats.length;
  const need = n + 3;
  const counts = countPool(pub.cfg.pool);
  const problem = poolProblem(pub.cfg.pool, n);
  const setCount = (r: number, d: number) => {
    const c = counts.slice();
    const step = ROLES[r].pair ? 2 : 1;
    c[r] = Math.max(0, Math.min(ROLES[r].max, c[r] + d * step));
    if (ROLES[r].pair && c[r] === 1) c[r] = d > 0 ? 2 : 0;
    sfx.click();
    game.hostCfg({ pool: poolFromCounts(c) }, true);
  };
  const cfg = pub.cfg;
  return (
    <main className="lobby">
      <section className="lobby-side">
        <div className="panel room-panel">
          <p className="eyebrow">{t('roomCode')}</p>
          <div className="room-code-row"><span className="room-code mono">{v.code}</span><CopyCode code={v.code} /></div>
          <p className="muted small">{t('shareHint')}</p>
        </div>
        <div className="panel seats-panel">
          <header className="panel-head"><h2>{t('players')}</h2><span className="count mono">{n} / {MAX_PLAYERS}</span></header>
          <ol className="seat-list">
            {pub.seats.map(([pid, name, bot], i) => (
              <li key={pid} className={`seat-row ${pid === v.pid ? 'is-me' : ''}`}>
                <span className="seat-no mono">{i + 1}</span>
                <span className="seat-name">{name}</span>
                <span className="seat-tags">
                  {i === 0 && <span className="tag tag-moon">{t('host')}</span>}
                  {pid === v.pid && <span className="tag">{t('you')}</span>}
                  {bot ? <span className="tag tag-dim">{t('bot')}</span> : null}
                </span>
                {host && bot ? <button type="button" className="icon-btn" aria-label="remove bot" onClick={() => game.removeSeat(pid)}>×</button> : null}
              </li>
            ))}
          </ol>
          {host && v.testMode && (
            <div className="bot-tools hscroll">
              <button type="button" className="btn btn-sm" onClick={() => game.addBot()} disabled={n >= MAX_PLAYERS}>{t('addBot')}</button>
              <button type="button" className="btn btn-sm" onClick={() => game.fillBots(5)} disabled={n >= 5}>{t('fillTo', { n: 5 })}</button>
              <button type="button" className="btn btn-sm" onClick={() => game.fillBots(8)} disabled={n >= 8}>{t('fillTo', { n: 8 })}</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => game.removeBots()}>{t('removeBots')}</button>
            </div>
          )}
          {v.mySeat < 0 && <p className="muted small">{t('joining')}</p>}
        </div>
      </section>

      <section className="lobby-main">
        <div className="panel">
          <header className="panel-head wrap">
            <div>
              <h2>{t('pool')}</h2>
              <p className={`small ${pub.cfg.pool.length === need ? 'muted' : 'warn-text'}`}>{t('poolCount', { n: pub.cfg.pool.length, m: need, p: n })}</p>
            </div>
            {host && (
              <div className="row-gap hscroll">
                <button type="button" className="btn btn-sm" onClick={() => { sfx.click(); game.autoPool(); }}>{t('autoBalance')}</button>
                <button type="button" className="btn btn-sm" onClick={() => { sfx.click(); game.hostCfg({ pool: randomPool(Math.max(3, n)) }, true); }}>{t('randomize')}</button>
              </div>
            )}
          </header>
          <div className="pool-grid">
            {POOL_ORDER.map(r => (
              <div key={r} className={`pool-tile team-${ROLES[r].team} ${counts[r] ? 'is-in' : ''}`}>
                <div className="pool-art"><RoleArt r={r} /></div>
                <div className="pool-name"><b>{ROLES[r].zh}</b><small>{ROLES[r].en}</small></div>
                <div className="stepper" aria-label={t.role(r)}>
                  <button type="button" disabled={!host || counts[r] === 0} onClick={() => setCount(r, -1)} aria-label="−">−</button>
                  <span className="mono">{counts[r]}</span>
                  <button type="button" disabled={!host || counts[r] >= ROLES[r].max} onClick={() => setCount(r, 1)} aria-label="+">+</button>
                </div>
              </div>
            ))}
          </div>
          <p className="muted small">{t('pairNote')}{counts[R.ALPHA] ? ' · ' + t('alphaNote') : ''}{host ? '' : ' · ' + t('hostOnly')}</p>
        </div>

        <div className="panel">
          <header className="panel-head"><h2>{t('timers')}</h2></header>
          <div className="cfg-grid">
            <div className="cfg-row"><span>{t('nightTurn')}</span>
              <Seg id="cfg-tn" value={cfg.tn} disabled={!host} onChange={x => game.hostCfg({ tn: x })} options={[6, 10, 12, 16, 20].map(x => ({ v: x, label: x + t('sec') }))} />
            </div>
            <div className="cfg-row"><span>{t('discussion')}</span>
              <Seg id="cfg-dd" value={cfg.dd} disabled={!host} onChange={x => game.hostCfg({ dd: x })} options={[60, 120, 180, 300, 480, 600].map(x => ({ v: x, label: x / 60 + ' ' + t('min') }))} />
            </div>
            <div className="cfg-row"><span>{t('voting')}</span>
              <Seg id="cfg-vd" value={cfg.vd} disabled={!host} onChange={x => game.hostCfg({ vd: x })} options={[20, 30, 45, 60].map(x => ({ v: x, label: x + t('sec') }))} />
            </div>
            <label className="switch">
              <input id="cfg-hr" type="checkbox" checked={cfg.hr} disabled={!host} onChange={e => game.hostCfg({ hr: e.target.checked })} />
              <span className="switch-ui" aria-hidden="true" />
              <span>{t('houseHunter')}</span>
            </label>
          </div>
        </div>
      </section>

      <footer className="startbar">
        {host ? (
          <>
            <span className={`small ${problem ? 'warn-text' : 'muted'}`}>{problem ? t('r_' + problem, { m: need }) : t('poolCount', { n: pub.cfg.pool.length, m: need, p: n })}</span>
            <button type="button" id="start-game" className="btn btn-moon btn-lg" disabled={!!problem} onClick={() => { sfx.howl(); game.start(); }}>{t('start')}</button>
          </>
        ) : <span className="muted">{t('waitingHost')}</span>}
      </footer>
    </main>
  );
}
