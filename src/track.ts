// Accounts (Google sign-in or guest), login history, room heartbeats and game records.
// Everything goes to the owner's Google Apps Script web app, which writes it into a Google Sheet.
import { useSyncExternalStore } from './react';
import { SCRIPT_URL, TRACK_HOSTS } from './config';
import { game, View } from './game';
import { ROLES } from './roles';

export interface Account { id: string; email: string; name: string; picture?: string; wins: number; losses: number; owner?: boolean }
interface Saved { token: string; account: Account }

const LS_ACC = 'onuw:acct', LS_GUEST = 'onuw:guest', SS_VISIT = 'onuw:visited';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/** The web app URL, or '' when logging is off here. Tests may set window.ONUW_TRACK. */
export function trackUrl(): string {
  const w = window as any;
  if (typeof w.ONUW_TRACK === 'string') return w.ONUW_TRACK;
  return SCRIPT_URL && TRACK_HOSTS.test(location.hostname) ? SCRIPT_URL : '';
}

// ---------------------------------------------------------------- store
export interface AuthState { on: boolean; clientId: string; saved: Saved | null; busy: boolean; err: string }
let st: AuthState = { on: false, clientId: '', saved: load(), busy: false, err: '' };
const subs = new Set<() => void>();
function set(p: Partial<AuthState>) { st = { ...st, ...p }; subs.forEach(f => f()); }
export function useAuth(): AuthState { return useSyncExternalStore(fn => { subs.add(fn); return () => { subs.delete(fn); }; }, () => st); }
export const authState = () => st;

function load(): Saved | null {
  try { const s = JSON.parse(lsGet(LS_ACC) || 'null'); return s && s.token && s.account ? s : null; } catch { return null; }
}
function save(s: Saved | null) { lsSet(LS_ACC, s ? JSON.stringify(s) : null); set({ saved: s }); }

export function guestId(): string {
  let g = lsGet(LS_GUEST);
  if (!g || !/^g[a-z0-9]{8,}$/.test(g)) {
    const a = new Uint8Array(8); crypto.getRandomValues(a);
    g = 'g' + Array.from(a, b => (b % 36).toString(36)).join('');
    lsSet(LS_GUEST, g);
  }
  return g;
}

const device = () => (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop');
const lang = () => document.documentElement.lang || '';

async function call(body: Record<string, any>, keepalive = false): Promise<any> {
  const url = trackUrl();
  if (!url) return { ok: false, error: 'off' };
  try {
    // text/plain keeps this a "simple" request: no CORS preflight, which Apps Script can't answer
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body), keepalive, redirect: 'follow' });
    return await r.json();
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

// ---------------------------------------------------------------- sign-in
let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (!gisLoading) gisLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisLoading = null; rej(new Error('gsi')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

let gisReady = false;
/** Draw Google's own sign-in button into el. */
export async function renderGoogleButton(el: HTMLElement, zh: boolean) {
  if (!st.clientId) return;
  try { await loadGis(); } catch { set({ err: 'gsi' }); return; }
  const g = (window as any).google.accounts.id;
  if (!gisReady) {
    g.initialize({ client_id: st.clientId, callback: (r: any) => onCredential(r.credential), auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup' });
    gisReady = true;
  }
  el.innerHTML = '';
  g.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: zh ? 'zh-TW' : 'en' });
}

export async function onCredential(credential: string) {
  set({ busy: true, err: '' });
  const r = await call({ a: 'login', credential, name: game.get().name, gid: guestId(), dev: device(), lang: lang() });
  if (r.ok) {
    save({ token: r.token, account: r.account });
    try { sessionStorage.setItem(SS_VISIT, '1'); } catch { /* ignore */ }
    if (!game.get().name && r.account?.name) game.rememberName(r.account.name);
    set({ busy: false });
  } else set({ busy: false, err: 'login' });
}

export function signOut() {
  save(null);
  try { (window as any).google?.accounts.id.disableAutoSelect(); } catch { /* not loaded */ }
}

/** Refresh the signed-in account (wins/losses) from the sheet. */
export async function refreshMe() {
  const s = st.saved; if (!s) return;
  const r = await call({ a: 'me', token: s.token });
  if (r.ok) save({ token: s.token, account: { ...r.account, picture: s.account.picture } });
  else if (r.error === 'signed out') save(null);
}

export async function fetchDashboard(days = 30): Promise<any> {
  if (!st.saved) return { ok: false, error: 'signed out' };
  return call({ a: 'dashboard', token: st.saved.token, days });
}

// ---------------------------------------------------------------- game watching
let lastName = '';
let roomCode = ''; let roomPh = ''; let roomAt = 0; let roomEp = -1;
let startedAt = 0; let reported = '';

function roomBeat(v: View, closed = false) {
  const pub = v.pub;
  if (!closed && !pub) return;
  roomAt = Date.now();
  const humans = pub ? pub.seats.filter(x => !x[2]).length : 0;
  const bots = pub ? pub.seats.filter(x => x[2]).length : 0;
  call({ a: 'room', code: roomCode, host: v.name, players: humans, bots, phase: pub?.ph || 'closed', round: pub ? pub.ep : roomEp, closed: closed ? 1 : 0 }, closed);
}

function watch() {
  if (!trackUrl()) return;
  const v = game.get();
  // keep the account nickname in step with the in-game name
  if (st.saved && v.name && v.name !== lastName) {
    if (lastName) call({ a: 'rename', token: st.saved.token, name: v.name });
    lastName = v.name;
  }
  const inRoom = v.status === 'in' && !!v.pub;
  // host: room heartbeat
  if (v.isHost && inRoom) {
    if (roomCode !== v.code) { roomCode = v.code; roomPh = ''; }
    roomEp = v.pub!.ep;
    if (v.pub!.ph !== roomPh) { roomPh = v.pub!.ph; roomBeat(v); }
  } else if (roomCode && !v.isHost && v.status === 'home') {
    roomBeat(v, true); roomCode = ''; roomPh = '';
  }
  if (!inRoom) return;
  const pub = v.pub!;
  if (pub.ph === 'reveal' || pub.ph === 'night') { if (!startedAt) startedAt = Date.now(); }
  if (pub.ph !== 'end' || !pub.res) { if (pub.ph === 'lobby') startedAt = 0; return; }
  const id = `${v.code}-${pub.gid || 'x'}-${pub.ep}`;
  if (reported === id) return;
  reported = id;
  const res = pub.res;
  const bots = pub.seats.filter(x => x[2]).length;
  if (v.isHost) {
    const winner = [res.w.v && '村民', res.w.w && '狼人', res.w.t && '皮匠'].filter(Boolean).join('+') || '無人';
    const how: Record<string, string> = { vote: '投票', peace: '和平', none: '無人被殺', hunt: '獵人開槍', misfire: '獵人誤射' };
    call({
      a: 'game', id, code: v.code, host: v.name, winner, how: how[res.how] || res.how,
      secs: startedAt ? Math.round((Date.now() - startedAt) / 1000) : '',
      players: pub.seats.map((x, i) => ({ n: x[1], bot: x[2] ? 1 : 0, r0: ROLES[res.st[i]]?.zh || '', r1: ROLES[res.fn[i]]?.zh || '', won: res.win.includes(i) ? 1 : 0 })),
    });
  }
  startedAt = 0;
  if (st.saved && v.mySeat >= 0) {
    call({ a: 'result', token: st.saved.token, id, won: res.win.includes(v.mySeat) ? 1 : 0, bots }).then(r => {
      if (r.ok && r.account && st.saved) save({ token: st.saved.token, account: { ...r.account, picture: st.saved.account.picture, owner: st.saved.account.owner } });
    });
  }
}

export function initTrack() {
  if (!trackUrl()) return;
  set({ on: true });
  call({ a: 'config' }).then(r => { if (r.ok) set({ clientId: r.clientId || '' }); });
  // one visit per browser tab session (the sheet also ignores repeats within 30 minutes)
  let first = true;
  try { first = !sessionStorage.getItem(SS_VISIT); sessionStorage.setItem(SS_VISIT, '1'); } catch { /* ignore */ }
  if (first) call({ a: 'visit', token: st.saved?.token, gid: guestId(), name: game.get().name, dev: device(), lang: lang() })
    .then(() => refreshMe());
  else refreshMe();
  lastName = game.get().name;
  game.subscribe(watch);
  setInterval(() => { const v = game.get(); if (v.isHost && v.status === 'in' && v.pub && Date.now() - roomAt > 60000) roomBeat(v); }, 15000);
  window.addEventListener('pagehide', () => { const v = game.get(); if (v.isHost && roomCode) roomBeat(v, true); });
}
