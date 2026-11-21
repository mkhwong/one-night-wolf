import { React, useState, useEffect, useRef } from '../react';
import { useAuth, renderGoogleButton, signOut, fetchDashboard, refreshMe, unlockGate, setGate } from '../track';
import { useT, useView } from './store';
import { Modal } from './common';

// which account overlay is open (shared by the nav chip, the home strip and App)
type Overlay = 'acct' | 'owner' | null;
let overlay: Overlay = null;
const ovSubs = new Set<() => void>();
export function openOverlay(o: Overlay) { overlay = o; ovSubs.forEach(f => f()); }
export function useOverlay(): Overlay { return React.useSyncExternalStore(fn => { ovSubs.add(fn); return () => { ovSubs.delete(fn); }; }, () => overlay); }

/** Google's sign-in button (drawn by Google's own script). */
function GoogleButton() {
  const t = useT(); const a = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && a.clientId) renderGoogleButton(ref.current, t.lang === 'zh'); }, [a.clientId, t.lang]);
  if (!a.clientId) return <p className="muted small">{t('acctNoGoogle')}</p>;
  return <div className="gsi-btn" ref={ref} />;
}

function Avatar({ src, name }: { src?: string; name: string }) {
  if (src) return <img className="acct-pic" src={src} alt="" referrerPolicy="no-referrer" />;
  return <span className="acct-pic acct-pic-txt" aria-hidden="true">{(name || '?').slice(0, 1)}</span>;
}

/** Nav chip: who you are playing as. */
export function AccountChip() {
  const onOpen = () => openOverlay('acct');
  const a = useAuth(); const t = useT(); const v = useView();
  if (!a.on) return null;
  const acc = a.saved?.account;
  return (
    <button type="button" id="acct-btn" className="btn btn-sm btn-ghost acct-chip" onClick={onOpen} aria-label={acc ? acc.name : t('acctGuest')}>
      {acc ? <Avatar src={acc.picture} name={acc.name} /> : <span aria-hidden="true">👤</span>}
      <span className="btn-label">{acc ? acc.name : (v.name || t('acctGuest'))}</span>
    </button>
  );
}

/** Home page strip: sign in with Google, or keep playing as a guest. */
export function AccountStrip() {
  const onOpen = () => openOverlay('owner');
  const a = useAuth(); const t = useT();
  if (!a.on) return null;
  const acc = a.saved?.account;
  if (acc) {
    return (
      <section className="acct-strip" id="acct-strip">
        <Avatar src={acc.picture} name={acc.name} />
        <div className="acct-strip-t"><b>{acc.name}</b><span className="muted small">{t('acctRecord', { w: acc.wins, l: acc.losses })}</span></div>
        {acc.owner && <button type="button" className="btn btn-sm btn-moon" id="owner-open" onClick={onOpen}>📊 {t('ownerTitle')}</button>}
      </section>
    );
  }
  return (
    <section className="acct-strip" id="acct-strip">
      <div className="acct-strip-t"><b>{t('acctGuestTitle')}</b><span className="muted small">{t('acctGuestBody')}</span></div>
      <GoogleButton />
      {a.busy && <span className="spinner spinner-sm" aria-label="…" />}
      {a.err && <p className="err small">{t('acctErr')}</p>}
    </section>
  );
}

export function AccountModal() {
  const onClose = () => openOverlay(null); const onOwner = () => openOverlay('owner');
  const a = useAuth(); const t = useT(); const v = useView();
  const acc = a.saved?.account;
  useEffect(() => { refreshMe(); }, []);
  return (
    <Modal title={t('acctTitle')} onClose={onClose}>
      {acc ? (
        <>
          <div className="acct-card">
            <Avatar src={acc.picture} name={acc.name} />
            <div>
              <b>{acc.name}</b>
              <p className="muted small">{acc.email}</p>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat"><b className="mono">{acc.wins}</b><span>{t('acctWins')}</span></div>
            <div className="stat"><b className="mono">{acc.losses}</b><span>{t('acctLosses')}</span></div>
            <div className="stat"><b className="mono">{acc.wins + acc.losses ? Math.round(acc.wins / (acc.wins + acc.losses) * 100) + '%' : '–'}</b><span>{t('acctRate')}</span></div>
          </div>
          <p className="muted small">{t('acctBotsNote')}</p>
          <div className="row-gap end">
            {acc.owner && <button type="button" className="btn btn-moon" id="owner-open-2" onClick={onOwner}>📊 {t('ownerTitle')}</button>}
            <button type="button" className="btn btn-ghost" id="acct-signout" onClick={() => signOut()}>{t('acctSignOut')}</button>
          </div>
        </>
      ) : (
        <>
          <p>{t('acctGuestNow', { n: v.name || t('acctGuest') })}</p>
          <p className="muted small">{t('acctGuestBody')}</p>
          <GoogleButton />
          {a.err && <p className="err small">{t('acctErr')}</p>}
        </>
      )}
      <p className="muted small acct-privacy">{t('acctPrivacy')}</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- entry password screen
export function GateScreen() {
  const t = useT(); const a = useAuth();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  if (a.gate === 'checking') {
    return <main className="center-screen"><div className="panel status-panel"><span className="spinner" aria-hidden="true" /><p className="muted">{t('gateChecking')}</p></div></main>;
  }
  const submit = async () => {
    if (!pw.trim() || busy) return;
    setBusy(true); setWrong(false);
    const ok = await unlockGate(pw.trim());
    setBusy(false);
    if (!ok) { setWrong(true); setPw(''); }
  };
  return (
    <main className="center-screen">
      <form className="panel name-panel gate-panel" id="gate" onSubmit={e => { e.preventDefault(); submit(); }}>
        <h1 className="display">一夜狼人殺</h1>
        <p className="muted">{t('gateBody')}</p>
        <input id="gate-pw" className="text-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={t('gatePh')} autoFocus autoComplete="current-password" maxLength={40} />
        {wrong && <p className="err" id="gate-wrong">{t('gateWrong')}</p>}
        <button type="submit" className="btn btn-moon btn-lg" disabled={!pw.trim() || busy}>{busy ? '…' : t('gateEnter')}</button>
        <details className="gate-owner">
          <summary className="muted small">{t('gateOwner')}</summary>
          <GoogleButton />
        </details>
      </form>
    </main>
  );
}

function GateSetting({ password, on, onSaved }: { password: string; on: boolean; onSaved: () => void }) {
  const t = useT();
  const [pw, setPw] = useState(password);
  const [cur, setCur] = useState({ password, on });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPw(password); setCur({ password, on }); }, [password, on]);
  const apply = async (change: { password?: string; on?: boolean }, done: string) => {
    setBusy(true); setMsg('…');
    const r = await setGate(change);
    setBusy(false);
    if (r.ok) { setCur({ password: r.password || '', on: !!r.on }); setMsg(done); onSaved(); } else setMsg(t('dashErr'));
  };
  const dirty = pw.trim() !== cur.password;
  return (
    <div className="gate-set" id="gate-set">
      <div className="gate-toggle-row">
        <button type="button" role="switch" id="gate-toggle" aria-checked={cur.on} className={`switch ${cur.on ? 'is-on' : ''}`}
          disabled={busy || (!cur.password && !cur.on)} onClick={() => apply({ on: !cur.on }, cur.on ? t('gateOffDone') : t('gateOnDone'))}>
          <span className="switch-knob" aria-hidden="true" />
        </button>
        <b>{cur.on ? t('gateStateOn') : t('gateStateOff')}</b>
      </div>
      <p className="small muted">{cur.on ? t('gateIsOn') : cur.password ? t('gateIsOffSaved') : t('gateNoPw')}</p>
      <div className="row-gap">
        <input id="gate-new" className="text-input" value={pw} onChange={e => setPw(e.target.value)} placeholder={t('gateNewPh')} maxLength={40} autoComplete="off" />
        <button type="button" className="btn btn-sm btn-moon" id="gate-save" disabled={busy || !pw.trim() || !dirty} onClick={() => apply({ password: pw.trim() }, cur.on ? t('gateSaved') : t('gateSavedOff'))}>{t('gateSave')}</button>
      </div>
      {msg && <p className="small muted" id="gate-msg">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- owner dashboard
interface Day { day: string; visitors: number; google: number; guests: number; logins: number; games: number }

function DailyChart({ days }: { days: Day[] }) {
  const t = useT();
  const [tip, setTip] = useState<number>(-1);
  const W = 720, H = 200, P = { l: 30, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...days.map(d => Math.max(d.visitors, d.games)));
  const step = Math.ceil(max / 4) || 1; const top = step * 4;
  const bw = (W - P.l - P.r) / days.length;
  const y = (n: number) => P.t + (H - P.t - P.b) * (1 - n / top);
  const d = tip >= 0 ? days[tip] : null;
  return (
    <figure className="chart">
      <div className="chart-legend small">
        <span><i className="sw sw-g" />{t('dashGoogle')}</span>
        <span><i className="sw sw-u" />{t('dashGuests')}</span>
        <span><i className="sw sw-games" />{t('dashGames')}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('dashDaily')} onMouseLeave={() => setTip(-1)}>
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(step * i)} y2={y(step * i)} className="grid" />
            <text x={P.l - 6} y={y(step * i) + 4} textAnchor="end" className="axis">{step * i}</text>
          </g>
        ))}
        {days.map((dd, i) => {
          const x = P.l + i * bw; const w = Math.max(2, bw * 0.62 - 1);
          const gh = y(0) - y(dd.google), uh = y(0) - y(dd.guests);
          return (
            <g key={dd.day} onMouseEnter={() => setTip(i)} onClick={() => setTip(i)}>
              <rect x={x} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
              <rect x={x + 1} y={y(dd.guests)} width={w} height={uh} rx={1.5} className="bar-u" />
              <rect x={x + 1} y={y(dd.guests) - gh - (gh && uh ? 1 : 0)} width={w} height={gh} rx={1.5} className="bar-g" />
              {dd.games > 0 && <circle cx={x + 1 + w / 2} cy={y(dd.games)} r={3.2} className="dot-games" />}
              {(days.length - 1 - i) % Math.ceil(days.length / 7) === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">{dd.day.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption className="small muted">{d ? t('dashTip', { d: d.day, v: d.visitors, g: d.google, u: d.guests, n: d.games }) : t('dashChartHint')}</figcaption>
    </figure>
  );
}

export function OwnerDashboard() {
  const onClose = () => openOverlay(null);
  const t = useT();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<'logins' | 'games'>('logins');
  const [busy, setBusy] = useState(false);
  const load = async (n = days) => {
    setBusy(true); setErr('');
    const r = await fetchDashboard(n);
    setBusy(false);
    if (r.ok) setData(r); else setErr(r.error || 'error');
  };
  useEffect(() => { load(); const id = setInterval(() => load(), 60000); return () => clearInterval(id); }, [days]);
  return (
    <Modal title={t('ownerTitle')} onClose={onClose} wide>
      <div className="dash" id="owner-dash">
        <div className="dash-bar">
          <span className="muted small">{data ? t('dashUpdated', { t: data.at }) : busy ? t('dashLoading') : ''}</span>
          <div className="row-gap">
            <select className="text-input select-sm" value={days} onChange={e => { setDays(Number(e.target.value)); }} aria-label={t('dashRange')}>
              {[7, 30, 90].map(n => <option key={n} value={n}>{t('dashDays', { n })}</option>)}
            </select>
            <button type="button" className="btn btn-sm" onClick={() => load()} disabled={busy}>↻ {t('dashRefresh')}</button>
            {data?.sheet && <a className="btn btn-sm btn-ghost" href={data.sheet} target="_blank" rel="noopener">{t('dashSheet')} ↗</a>}
          </div>
        </div>
        {err && <p className="err">{err === 'owner only' ? t('dashOwnerOnly') : t('dashErr')}</p>}
        {data && (
          <>
            <div className="stat-row stat-row-4">
              <div className="stat"><b className="mono">{data.totals.live}</b><span>{t('dashLive')}</span></div>
              <div className="stat"><b className="mono">{data.totals.visitorsToday}</b><span>{t('dashVisitorsToday')}</span></div>
              <div className="stat"><b className="mono">{data.totals.gamesToday}</b><span>{t('dashGamesToday')}</span></div>
              <div className="stat"><b className="mono">{data.totals.games}</b><span>{t('dashGamesAll')}</span></div>
              <div className="stat"><b className="mono">{data.totals.accounts}</b><span>{t('dashAccounts')}</span></div>
            </div>

            <h3>{t('gateTitle')}</h3>
            <GateSetting password={data.gatePassword || ''} on={!!data.gateOn} onSaved={() => load()} />

            <h3>{t('dashLiveRooms')}</h3>
            {data.live.length ? (
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>{t('dashRoom')}</th><th>{t('dashHost')}</th><th>{t('dashPlayers')}</th><th>{t('dashPhase')}</th><th>{t('dashRound')}</th><th>{t('dashOpened')}</th></tr></thead>
                <tbody>{data.live.map((r: any) => (
                  <tr key={r.code}><td className="mono">{r.code}</td><td>{r.host}</td><td className="mono">{r.players}{r.bots ? ` +${r.bots}🤖` : ''}</td><td>{t('ph_' + r.phase)}</td><td className="mono">{r.round}</td><td className="mono small">{r.opened.slice(11)}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <p className="muted small">{t('dashNoLive')}</p>}

            <h3>{t('dashDaily')}</h3>
            <DailyChart days={data.daily} />

            <div className="seg seg-sm" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'logins'} className={tab === 'logins' ? 'is-on' : ''} onClick={() => setTab('logins')}>{t('dashLogins')}</button>
              <button type="button" role="tab" aria-selected={tab === 'games'} className={tab === 'games' ? 'is-on' : ''} onClick={() => setTab('games')}>{t('dashRecentGames')}</button>
            </div>
            {tab === 'logins' ? (
              <div className="tbl-wrap tbl-scroll"><table className="tbl" id="dash-logins">
                <thead><tr><th>{t('dashWhen')}</th><th>{t('dashKind')}</th><th>{t('dashName')}</th><th>Email</th><th>{t('dashDevice')}</th></tr></thead>
                <tbody>{data.logins.map((r: any, i: number) => (
                  <tr key={i}><td className="mono small">{r.at}</td><td>{r.kind}</td><td>{r.name}</td><td className="small">{r.email || <span className="muted">{'#' + r.id}</span>}</td><td className="small">{r.dev === 'mobile' ? '📱' : r.dev ? '💻' : ''}</td></tr>
                ))}</tbody>
              </table></div>
            ) : (
              <div className="tbl-wrap tbl-scroll"><table className="tbl">
                <thead><tr><th>{t('dashWhen')}</th><th>{t('dashRoom')}</th><th>{t('dashPlayers')}</th><th>{t('dashWinner')}</th><th>{t('dashMins')}</th><th>{t('dashDetail')}</th></tr></thead>
                <tbody>{data.games.map((r: any, i: number) => (
                  <tr key={i}><td className="mono small">{r.at}</td><td className="mono">{r.code}</td><td className="mono">{r.players}{r.bots ? ` (${r.bots}🤖)` : ''}</td><td>{r.winner}<span className="muted small"> · {r.how}</span></td><td className="mono">{r.secs ? Math.round(r.secs / 60) : ''}</td><td className="small">{r.detail}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export function AccountOverlays() {
  const o = useOverlay();
  if (o === 'acct') return <AccountModal />;
  if (o === 'owner') return <OwnerDashboard />;
  return null;
}
