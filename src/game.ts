// Session controller: identity, connection, host loop, encrypted private channel,
// and the derived view the UI renders from.
import { Engine, EngineState, PubState, PrivState, newState, BotMsg, Cfg } from './engine';
import { Net, joinNet, makeKeys, Keys, sharedKey, seal, open, bytes, newCode, newId, normCode } from './net';
import { autoBalance, MAX_PLAYERS } from './roles';

export type Status = 'home' | 'connecting' | 'nohost' | 'name' | 'in' | 'locked' | 'full' | 'hostgone';

export interface ChatItem { key: string; ep: number; seat: number; text?: string; bot?: BotMsg; sys?: { k: 'claim'; r: number }; at: number }
export interface ClaimView { role: number; id: string }

export interface View {
  status: Status;
  code: string; pid: string; name: string; isHost: boolean;
  netKind: 'room' | 'peer' | 'local' | null; connected: boolean;
  pub: PubState | null; priv: PrivState | null; mySeat: number;
  offset: number;
  claims: Record<number, ClaimView>;
  peace: Record<number, boolean>;
  chat: ChatItem[];
  pending: boolean;
  myVote: number; myLocked: boolean;
  hostSeen: boolean;
  testMode: boolean;
  err: string | null;
}

export interface ThrowEvent { id: string; from: number; to: number; item: number }
export interface ClaimEvent { id: string; seat: number; role: number }

const SS = 'onuw:sess';
const ssGet = (k: string) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };
const ssSet = (k: string, v: any) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

interface Saved { code: string; pid: string; name: string; host: boolean; jwk: any; nonce: number; eng?: EngineState; hid?: number }

const PRESENCE_LIMIT = 3900;
// control, zero-width, bidi and other invisible characters the platform refuses in presence
const STRIP = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff\\ue000-\\uf8ff]', 'g');

export class Game {
  private subs = new Set<() => void>();
  private ev = { claim: new Set<(e: ClaimEvent) => void>(), throw: new Set<(e: ThrowEvent) => void>() };
  v: View;
  private net: Net | null = null;
  private unsub: (() => void) | null = null;
  private keys: Keys | null = null;
  engine: Engine | null = null;
  private nonce = 0; private hid = 0; private cid = 0; private mid = 0; private tid = 0;
  private hostPeerPresence: Record<string, any> | null = null;
  private lastPrivSealed = '';
  private hostHk = '';
  private hostShared: CryptoKey | null = null;
  private seenClaim = new Set<string>(); private seenMsg = new Set<string>(); private seenThrow = new Set<string>();
  private synced = false; private syncAt = 0;
  private myA: [number, string][] = [];
  private myM: [number, number, string][] = [];
  private myTh: [number, number, number, number][] = [];
  private tickT: any = null; private hbT: any = null;
  private sealedCache = new Map<string, { j: string; s: string }>();
  private lastSeen = new Map<string, number>();
  private publishQueued = false;
  private lastSq = -1;
  private lastHb = 0;
  private hostMissingSince = 0;
  private privAtAction = -1;
  private nameOk = false;
  private retriedCode = false;

  constructor() {
    this.v = {
      status: 'home', code: '', pid: '', name: lsGet('onuw:name') || '', isHost: false,
      netKind: null, connected: false, pub: null, priv: null, mySeat: -1, offset: 0,
      claims: {}, peace: {}, chat: [], pending: false, myVote: -2, myLocked: false,
      hostSeen: false, testMode: lsGet('onuw:test') === '1', err: null,
    };
  }

  // ------------------------------------------------------------ store
  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  get = () => this.v;
  private set(p: Partial<View>) { this.v = { ...this.v, ...p }; this.subs.forEach(f => f()); }
  on<K extends 'claim' | 'throw'>(k: K, fn: K extends 'claim' ? (e: ClaimEvent) => void : (e: ThrowEvent) => void) {
    (this.ev[k] as Set<any>).add(fn); return () => { (this.ev[k] as Set<any>).delete(fn); };
  }
  now() { return Date.now() + this.v.offset; }   // host clock

  setTestMode(on: boolean) {
    lsSet('onuw:test', on ? '1' : '0'); this.set({ testMode: on });
    if (this.engine) { this.engine.setCfg({ tm: on }); if (!on) this.engine.removeBots(); this.afterHostChange(); }
  }

  // ------------------------------------------------------------ session
  async resume(): Promise<boolean> {
    const s: Saved | null = ssGet(SS);
    if (!s || !s.code || !s.pid) return false;
    await this.connect(s.code, s.host, s);
    return true;
  }

  async create() {
    const code = newCode();
    await this.connect(code, true, null);
  }

  async join(codeRaw: string) {
    const code = normCode(codeRaw);
    if (code.length !== 5) { this.set({ err: 'badCode' }); return; }
    await this.connect(code, false, null);
  }

  private save() {
    const s: Saved = { code: this.v.code, pid: this.v.pid, name: this.v.name, host: this.v.isHost, jwk: this.keys?.jwk, nonce: this.nonce, hid: this.hid };
    if (this.engine) s.eng = this.engine.s;
    ssSet(SS, s);
  }

  snapshot() { this.save(); return ssGet(SS); }

  private async connect(code: string, host: boolean, saved: Saved | null): Promise<void> {
    this.set({ status: 'connecting', code, isHost: host, err: null });
    const pid = saved?.pid && /^[a-z]/.test(saved.pid) ? saved.pid : 'p' + newId(6);
    this.nonce = saved?.nonce || 0; this.hid = saved?.hid || 0;
    this.keys = await makeKeys(saved?.jwk);
    const name = saved?.name || this.v.name || '';
    this.nameOk = !!saved?.name;
    this.set({ pid, name });
    if (host) {
      if (saved?.eng && saved.eng.code === code) this.engine = new Engine(saved.eng);
      else {
        const st = newState(newId(6), code, { pid, name: name || 'Host', bot: false });
        st.cfg.tm = this.v.testMode;
        this.engine = new Engine(st);
      }
    }
    try { this.net = await joinNet(code, host); }
    catch (e: any) {
      // a brand-new room whose code is taken by someone else: pick another code
      if (host && !saved && e?.type === 'unavailable-id' && !this.retriedCode) {
        this.retriedCode = true; this.engine = null;
        return this.connect(newCode(), true, null);
      }
      this.engine = null;
      this.set({ status: 'home', err: 'connect' }); return;
    }
    this.retriedCode = false;
    this.set({ netKind: this.net.kind, connected: this.net.connected() });
    this.synced = false; this.syncAt = 0;
    this.net.set({ app: 'onuw', v: 1, pid, k: this.keys.pub, n: this.nameOk ? name : null, a: [], c: null, m: [], th: [], pc: null, hn: null, rd: null });
    this.unsub = this.net.onPeers(() => this.onPeers());
    if (host) {
      // players get a grace period to reconnect after the host's page reloads
      const grace = Date.now() + 15000;
      for (const seat of this.engine!.s.seats) if (!seat.bot && seat.pid !== pid) this.lastSeen.set(seat.pid, grace);
      this.tickT = setInterval(() => this.hostTick(), 250);
      this.hbT = setInterval(() => this.hostPublish(true), 4000);
      this.set({ status: this.nameOk ? 'in' : 'name', hostSeen: true });
      if (this.nameOk) this.engine!.rename(pid, name);
      this.hostPublish(true);
    } else {
      // give the room a moment to introduce the host
      setTimeout(() => {
        if (!this.v.hostSeen && this.v.status === 'connecting') this.set({ status: 'nohost' });
      }, 7000);
    }
    this.save();
    this.onPeers();
  }

  leave() {
    clearInterval(this.tickT); clearInterval(this.hbT);
    this.unsub?.(); this.net?.leave();
    this.net = null; this.engine = null; this.unsub = null;
    try { sessionStorage.removeItem(SS); } catch { /* ignore */ }
    this.seenClaim.clear(); this.seenMsg.clear(); this.seenThrow.clear();
    this.myA = []; this.myM = []; this.myTh = []; this.lastPrivSealed = ''; this.hostShared = null; this.hostHk = '';
    this.set({ status: 'home', code: '', isHost: false, pub: null, priv: null, mySeat: -1, claims: {}, peace: {}, chat: [], hostSeen: false, netKind: null, pending: false, err: null });
  }

  setName(nameRaw: string) {
    const name = nameRaw.replace(STRIP, '').trim().slice(0, 12);
    if (!name) return;
    lsSet('onuw:name', name);
    this.nameOk = true;
    this.set({ name });
    this.net?.set({ n: name });
    if (this.engine) { this.engine.rename(this.v.pid, name); this.afterHostChange(); }
    if (this.v.status === 'name') this.set({ status: 'in' });
    this.save();
  }

  // ------------------------------------------------------------ peers
  private onPeers() {
    if (!this.net) return;
    const peers = this.net.peers();
    const conn = this.net.connected();
    if (conn !== this.v.connected) this.set({ connected: conn });
    const now = Date.now();
    const byPid = new Map<string, Record<string, any>>();
    for (const p of peers) {
      const pr = p.presence;
      if (!pr || pr.app !== 'onuw' || typeof pr.pid !== 'string') continue;
      if (p.isMe) continue;
      byPid.set(pr.pid, pr);
      this.lastSeen.set(pr.pid, now);
    }
    if (this.engine) this.hostIngest(byPid);
    else this.playerIngest(byPid);
    this.deriveSocial(byPid);
  }

  // ---- player side
  private playerIngest(byPid: Map<string, Record<string, any>>) {
    let host: Record<string, any> | null = null;
    for (const pr of byPid.values()) if (pr.host === 1 && pr.code === this.v.code && pr.s) { host = pr; break; }
    if (!host) {
      if (this.v.hostSeen) {
        if (!this.hostMissingSince) this.hostMissingSince = Date.now();
        setTimeout(() => this.checkHostGone(), 4500);
      }
      return;
    }
    this.hostMissingSince = 0;
    this.hostPeerPresence = host;
    const pub: PubState = host.s;
    if (typeof host.hb === 'number' && host.hb !== this.lastHb) { this.lastHb = host.hb; this.set({ offset: host.hb - Date.now() }); }
    const seat = pub.seats.findIndex(x => x[0] === this.v.pid);
    let status: Status = this.v.status;
    if (status === 'connecting' || status === 'nohost' || status === 'hostgone' || status === 'locked' || status === 'full') {
      if (seat >= 0) status = this.nameOk ? 'in' : 'name';
      else if (pub.ph !== 'lobby') status = 'locked';
      else if (pub.seats.length >= MAX_PLAYERS) status = 'full';
      else status = this.nameOk ? 'in' : 'name';
    } else if (status === 'in' && seat < 0 && pub.ph !== 'lobby') status = 'locked';
    const patch: Partial<View> = { pub, mySeat: seat, hostSeen: true, status };
    if (pub.ph !== 'vote') { patch.myVote = -2; patch.myLocked = false; }
    if (this.v.pub && this.v.pub.ep !== pub.ep) { patch.claims = {}; patch.peace = {}; }
    this.set(patch);
    if (host.hk && host.hk !== this.hostHk) {
      this.hostHk = host.hk;
      sharedKey(this.keys!, host.hk).then(k => { this.hostShared = k; this.lastPrivSealed = ''; this.readPriv(); });
    } else this.readPriv();
  }

  private checkHostGone() {
    if (this.engine || !this.net || !this.hostMissingSince) return;
    if (Date.now() - this.hostMissingSince > 4000 && this.v.status === 'in') this.set({ status: 'hostgone' });
  }

  private async readPriv() {
    const host = this.hostPeerPresence;
    if (!host) return;
    const sealed = host.p && host.p[this.v.pid];
    if (!sealed) { if (this.v.priv && (!this.v.pub || this.v.pub.ph === 'lobby')) this.set({ priv: null }); return; }
    if (sealed === this.lastPrivSealed) return;
    if (!this.hostShared && !sealed.startsWith('p:')) return;
    const my = ++this.privSeq;
    const priv = await open<PrivState>(this.hostShared, sealed);
    if (!priv || my !== this.privSeq) return;
    this.lastPrivSealed = sealed;
    const patch: Partial<View> = { priv };
    if (this.v.pending && (priv.i.length !== this.privAtAction)) patch.pending = false;
    if (priv.v !== undefined) { patch.myVote = priv.v; patch.myLocked = !!priv.lk; }
    this.set(patch);
  }

  // ---- host side
  private hostIngest(byPid: Map<string, Record<string, any>>) {
    const e = this.engine!; const now = Date.now();
    const st = e.s;
    for (const [pid, pr] of byPid) {
      if (pr.host === 1) continue;
      const seat = e.seatOf(pid);
      if (st.ph === 'lobby') {
        if (seat < 0 && typeof pr.n === 'string' && pr.n.trim()) e.addSeat({ pid, name: pr.n.trim().slice(0, 12), bot: false });
        else if (seat >= 0 && typeof pr.n === 'string' && pr.n.trim()) e.rename(pid, pr.n.trim().slice(0, 12));
      }
      if (seat < 0) continue;
      // public intents
      if (Array.isArray(pr.c) && pr.c[0] === st.ep && typeof pr.c[2] === 'number') st.claims[seat] = pr.c[2];
      if (typeof pr.rd === 'number' && pr.rd === st.ep) e.setReady(seat);
      if (Array.isArray(pr.hn) && pr.hn[0] === st.ep && pr.hn[1] > (st.hunts[pid] || 0)) {
        st.hunts[pid] = pr.hn[1];
        if (pr.hn[2] === 'aim') e.huntAim(seat, now);
        else if (pr.hn[2] === 'cancel') e.huntCancel(seat, now);
        else if (pr.hn[2] === 'shoot') e.huntShoot(seat, pr.hn[3]);
      }
      // encrypted actions
      if (Array.isArray(pr.a) && typeof pr.k === 'string') {
        const fresh = pr.a.filter((x: any) => Array.isArray(x) && x[0] > (st.nonces[pid] || 0)).sort((a: any, b: any) => a[0] - b[0]);
        if (fresh.length) {
          st.nonces[pid] = fresh[fresh.length - 1][0];
          sharedKey(this.keys!, pr.k).then(async key => {
            for (const [, sealed] of fresh) {
              const msg = await open(key, sealed);
              if (msg) this.hostHandle(e.seatOf(pid), msg);
            }
            this.afterHostChange();
          });
        }
      }
    }
    // presence bookkeeping
    const offline: number[] = [];
    st.seats.forEach((seat, i) => {
      if (seat.bot || seat.pid === this.v.pid) return;
      if (!byPid.has(seat.pid)) offline.push(i);
    });
    if (st.ph === 'lobby') {
      for (const i of offline.slice().reverse()) {
        const pid = st.seats[i].pid; const seen = this.lastSeen.get(pid) || 0;
        if (now - seen > 6000) { e.removeSeat(pid); }
        else setTimeout(() => this.onPeers(), 6500);
      }
      e.setOffline([]);
    } else e.setOffline(offline);
    this.afterHostChange();
  }

  private hostHandle(seat: number, msg: any) {
    const e = this.engine!; const now = Date.now();
    if (seat < 0 || !msg || msg.ep !== e.s.ep) return;
    if (msg.t === 'night') e.act(seat, msg.ti, msg.x, now);
    else if (msg.t === 'vote') e.vote(seat, msg.v, !!msg.lk);
  }

  private hostTick() {
    if (!this.engine) return;
    this.engine.tick(Date.now());
    this.afterHostChange();
  }

  private afterHostChange() {
    const e = this.engine; if (!e) return;
    if (e.s.sq === this.lastSq) return;
    this.lastSq = e.s.sq;
    const pub = e.pub();
    const seat = e.seatOf(this.v.pid);
    const priv = e.priv(seat);
    const patch: Partial<View> = { pub, priv, mySeat: seat };
    if (this.v.pending && priv && priv.i.length !== this.privAtAction) patch.pending = false;
    if (priv?.v !== undefined) { patch.myVote = priv.v; patch.myLocked = !!priv.lk; }
    else if (pub.ph !== 'vote') { patch.myVote = -2; patch.myLocked = false; }
    if (this.v.pub && this.v.pub.ep !== pub.ep) { patch.claims = {}; patch.peace = {}; }
    this.set(patch);
    this.save();
    this.hostPublish(false);
    this.deriveSocial(this.currentByPid());
  }

  private currentByPid() {
    const m = new Map<string, Record<string, any>>();
    for (const p of this.net?.peers() || []) if (!p.isMe && p.presence?.app === 'onuw') m.set(p.presence.pid, p.presence);
    return m;
  }

  private pubSeq = 0; private privSeq = 0;
  private hostPublish(heartbeat: boolean) {
    if (!this.engine || !this.net) return;
    if (this.publishQueued) return;
    this.publishQueued = true;
    queueMicrotask(async () => {
      this.publishQueued = false;
      const my = ++this.pubSeq;
      const e = this.engine; if (!e || !this.net) return;
      const pub = e.pub();
      const peers = this.currentByPid();
      const p: Record<string, string> = {};
      if (pub.ph !== 'lobby' && pub.ph !== 'end') {
        await Promise.all(e.s.seats.map(async (seat, i) => {
          if (seat.bot || seat.pid === this.v.pid) return;
          const pr = peers.get(seat.pid); if (!pr || typeof pr.k !== 'string') return;
          const priv = e.priv(i); if (!priv) return;
          const j = JSON.stringify(priv);
          const cached = this.sealedCache.get(seat.pid + '|' + pr.k);
          if (cached && cached.j === j) { p[seat.pid] = cached.s; return; }
          const key = await sharedKey(this.keys!, pr.k);
          const sealed = await seal(key, priv);
          this.sealedCache.set(seat.pid + '|' + pr.k, { j, s: sealed });
          p[seat.pid] = sealed;
        }));
      }
      if (my !== this.pubSeq || !this.net) return;      // a newer publish superseded this one
      const out: Record<string, any> = { host: 1, code: e.s.code, gid: e.s.gid, hk: this.keys!.pub, s: pub, p, hb: Date.now() };
      // keep the whole presence inside the platform's 4 KiB budget
      const fits = () => this.net!.sizeWith(out) <= PRESENCE_LIMIT;
      const steps: (() => void)[] = [
        () => { if (this.myM.length > 1) { this.myM = this.myM.slice(-1); this.net!.set({ m: this.myM }); } },
        () => { pub.soc = { ...pub.soc, m: pub.soc.m.slice(-2) }; },
        () => { if (pub.res) pub.res = { ...pub.res, log: pub.res.log.slice(-8) }; },
        () => { pub.soc = { ...pub.soc, m: [], t: pub.soc.t.slice(-1) }; },
        () => { if (this.myM.length) { this.myM = []; this.net!.set({ m: [] }); } },
        () => { if (pub.res) pub.res = { ...pub.res, log: [] }; },
      ];
      for (const step of steps) { if (fits()) break; step(); }
      if (!fits()) console.warn('host presence over budget', this.net.sizeWith(out));
      void heartbeat;
      this.net.set(out);
    });
  }

  // ------------------------------------------------------------ social (claims, chat, throws)
  private deriveSocial(byPid: Map<string, Record<string, any>>) {
    const pub = this.v.pub; if (!pub) return;
    const ep = pub.ep;
    const seatOfPid = new Map(pub.seats.map((x, i) => [x[0], i] as [string, number]));
    const claims: Record<number, ClaimView> = {};
    const peace: Record<number, boolean> = {};
    const newClaims: ClaimEvent[] = []; const newThrows: ThrowEvent[] = []; const newChat: ChatItem[] = [];
    const now = Date.now();
    const consider = (seat: number, c: any, own: boolean) => {
      if (!Array.isArray(c) || c[0] !== ep) return;
      const id = `${ep}:${seat}:${c[1]}`; const role = c[2];
      if (typeof role === 'number' && role >= 0) claims[seat] = { role, id };
      if (!this.seenClaim.has(id)) {
        this.seenClaim.add(id);
        if (typeof role === 'number' && role >= 0) {
          if (this.synced || own) newClaims.push({ id, seat, role });
          newChat.push({ key: 'c' + id, ep, seat, sys: { k: 'claim', r: role }, at: now });
        }
      }
    };
    const msgs = (seat: number, m: any) => {
      if (!Array.isArray(m)) return;
      for (const x of m) {
        if (!Array.isArray(x) || x[0] !== ep || typeof x[2] !== 'string') continue;
        const key = `m${ep}:${seat}:${x[1]}`;
        if (this.seenMsg.has(key)) continue;
        this.seenMsg.add(key); newChat.push({ key, ep, seat, text: x[2].slice(0, 140), at: now });
      }
    };
    const throws = (seat: number, th: any) => {
      if (!Array.isArray(th)) return;
      for (const x of th) {
        if (!Array.isArray(x) || x[0] !== ep) continue;
        const id = `${ep}:${seat}:${x[1]}`;
        if (this.seenThrow.has(id)) continue;
        this.seenThrow.add(id);
        if (this.synced || seat === this.v.mySeat) newThrows.push({ id, from: seat, to: x[3], item: x[2] });
      }
    };
    // other humans
    for (const [pid, pr] of byPid) {
      const seat = seatOfPid.get(pid); if (seat === undefined) continue;
      consider(seat, pr.c, false); msgs(seat, pr.m); throws(seat, pr.th);
      if (Array.isArray(pr.pc) && pr.pc[0] === ep && pr.pc[1]) peace[seat] = true;
    }
    // me
    const me = this.v.mySeat;
    if (me >= 0) {
      const mine = this.myPresenceSocial;
      consider(me, mine.c, true); msgs(me, this.myM.map(x => x)); throws(me, this.myTh);
      if (mine.pc) peace[me] = true;
    }
    // bots
    for (const [seat, cid, role] of pub.soc.c) consider(seat, [ep, 'b' + cid, role], false);
    for (const [seat, id, raw] of pub.soc.m) {
      const key = `b${ep}:${seat}:${id}`;
      if (this.seenMsg.has(key)) continue;
      this.seenMsg.add(key);
      let msg: BotMsg | null = null;
      try { msg = typeof raw === 'string' ? JSON.parse(raw) : (raw as any); } catch { msg = null; }
      if (msg && typeof msg.k === 'string') newChat.push({ key, ep, seat, bot: msg, at: now });
    }
    for (const [seat, id, item, to] of pub.soc.t) throws(seat, [[ep, 'b' + id, item, to]]);
    const patch: Partial<View> = {};
    if (JSON.stringify(claims) !== JSON.stringify(this.v.claims)) patch.claims = claims;
    if (JSON.stringify(peace) !== JSON.stringify(this.v.peace)) patch.peace = peace;
    if (newChat.length || this.v.chat.some(c => c.ep !== ep)) patch.chat = [...this.v.chat.filter(c => c.ep === ep), ...newChat].slice(-120);
    if (Object.keys(patch).length) this.set(patch);
    if (!this.syncAt) this.syncAt = Date.now() + 2500;
    else if (Date.now() > this.syncAt) this.synced = true;
    newClaims.forEach(c => this.ev.claim.forEach(f => f(c)));
    newThrows.forEach(t => this.ev.throw.forEach(f => f(t)));
  }

  private myPresenceSocial: { c: any; pc: boolean } = { c: null, pc: false };

  // ------------------------------------------------------------ player actions
  private async sendSecret(msg: any) {
    if (this.engine) { this.hostHandle(this.v.mySeat, msg); this.afterHostChange(); return; }
    if (!this.net) return;
    const key = this.hostShared;
    if (!key && this.hostHk !== 'plain') { setTimeout(() => this.sendSecret(msg), 400); return; }
    const sealed = await seal(key, msg);
    this.nonce++;
    this.myA = [...this.myA, [this.nonce, sealed] as [number, string]].slice(-3);
    this.net.set({ a: this.myA });
    this.save();
  }

  nightAct(x: any) {
    const pub = this.v.pub; if (!pub) return;
    this.privAtAction = this.v.priv?.i.length ?? 0;
    this.set({ pending: true });
    const ti = pub.ti;
    setTimeout(() => { if (this.v.pending && this.v.pub?.ti === ti) this.set({ pending: false }); }, 5000);
    this.sendSecret({ t: 'night', ep: pub.ep, ti: pub.ti, x });
  }
  vote(target: number, lock: boolean) {
    const pub = this.v.pub; if (!pub || this.v.myLocked) return;
    this.set({ myVote: target, myLocked: lock });
    this.sendSecret({ t: 'vote', ep: pub.ep, v: target, lk: lock ? 1 : 0 });
  }
  ready() {
    const pub = this.v.pub; if (!pub) return;
    if (this.engine) { this.engine.setReady(this.v.mySeat); this.afterHostChange(); return; }
    this.net?.set({ rd: pub.ep });
  }
  claim(role: number) {
    const pub = this.v.pub; if (!pub) return;
    const c = [pub.ep, ++this.cid, role];
    this.myPresenceSocial.c = c;
    this.net?.set({ c });
    if (this.engine) { this.engine.s.claims[this.v.mySeat] = role; }
    this.deriveSocial(this.currentByPid());
  }
  setPeace(on: boolean) {
    const pub = this.v.pub; if (!pub) return;
    this.myPresenceSocial.pc = on;
    this.net?.set({ pc: [pub.ep, on ? 1 : 0] });
    this.deriveSocial(this.currentByPid());
  }
  chat(textRaw: string) {
    const pub = this.v.pub; if (!pub) return;
    const text = textRaw.replace(STRIP, ' ').trim().slice(0, 120);
    if (!text) return;
    this.myM = [...this.myM.filter(x => x[0] === pub.ep), [pub.ep, ++this.mid, text] as [number, number, string]].slice(-4);
    this.net?.set({ m: this.myM });
    this.deriveSocial(this.currentByPid());
  }
  throwAt(item: number, to: number) {
    const pub = this.v.pub; if (!pub) return;
    this.myTh = [...this.myTh.filter(x => x[0] === pub.ep), [pub.ep, ++this.tid, item, to] as [number, number, number, number]].slice(-3);
    this.net?.set({ th: this.myTh });
    this.deriveSocial(this.currentByPid());
  }
  private hunterIntent(kind: 'aim' | 'cancel' | 'shoot', target?: number) {
    const pub = this.v.pub; if (!pub) return;
    if (this.engine) {
      const e = this.engine; const now = Date.now(); const seat = this.v.mySeat;
      if (kind === 'aim') e.huntAim(seat, now); else if (kind === 'cancel') e.huntCancel(seat, now); else e.huntShoot(seat, target!);
      this.afterHostChange(); return;
    }
    this.hid++;
    this.net?.set({ hn: [pub.ep, this.hid, kind, target ?? -1] });
    this.save();
  }
  huntAim() { this.hunterIntent('aim'); }
  huntCancel() { this.hunterIntent('cancel'); }
  huntShoot(t: number) { this.hunterIntent('shoot', t); }

  // ------------------------------------------------------------ host controls
  hostCfg(p: Partial<Cfg>, custom?: boolean) { if (!this.engine) return; this.engine.setCfg(p, custom); this.afterHostChange(); }
  addBot() { if (!this.engine) return; this.engine.addBot(); this.afterHostChange(); }
  fillBots(n: number) { if (!this.engine) return; for (let i = 0; i < 12 && this.engine.n < n; i++) this.engine.addBot(); this.afterHostChange(); }
  removeBots() { if (!this.engine) return; this.engine.removeBots(); this.afterHostChange(); }
  removeSeat(pid: string) { if (!this.engine) return; this.engine.removeSeat(pid); this.afterHostChange(); }
  autoPool() { if (!this.engine) return; this.engine.setCfg({ pool: autoBalance(Math.max(3, this.engine.n)) }, false); this.afterHostChange(); }
  start() { if (!this.engine) return; this.engine.start(Date.now()); this.afterHostChange(); }
  skipToVote() { if (!this.engine) return; this.engine.skipToVote(Date.now()); this.afterHostChange(); }
  playAgain() {
    if (!this.engine) return;
    const e = this.engine;
    // drop humans who left during the game
    const peers = this.currentByPid();
    e.backToLobby();
    e.s.seats = e.s.seats.filter((x, i) => i === 0 || x.bot || peers.has(x.pid));
    if (!e.s.custom && e.s.cfg.pool.length !== e.n + 3) e.s.cfg.pool = autoBalance(Math.max(3, e.n));
    e.s.sq++;
    this.myM = []; this.myTh = []; this.myPresenceSocial = { c: null, pc: false };
    this.net?.set({ m: [], th: [], c: null, pc: null });
    this.afterHostChange();
  }
  forceResume() { if (!this.engine) return; this.engine.huntCancel(null, Date.now()); this.afterHostChange(); }
}

export const game = new Game();
