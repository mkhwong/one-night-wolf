// Transport + crypto. Three ways to reach the other players, all speaking the same
// "presence" model (each page publishes one small object, everyone sees everyone's):
//  - room:  the Claude artifact `room` capability, when the page runs inside Claude;
//  - peer:  PeerJS (WebRTC) on an ordinary website such as GitHub Pages; the host's
//           device is the hub that relays presence between players;
//  - local: a BroadcastChannel between tabs of one browser (solo play with bots).

export interface PeerLite { peer: string; isMe: boolean; presence: Record<string, any> }

export interface Net {
  kind: 'room' | 'peer' | 'local';
  set(patch: Record<string, any>): void;
  /** UTF-8 size of this page's presence once `patch` is merged in. */
  sizeWith(patch: Record<string, any>): number;
  peers(): PeerLite[];
  onPeers(fn: (peers: PeerLite[]) => void): () => void;
  connected(): boolean;
  leave(): void;
}

declare global { interface Window { claude?: any } }

let roomNs: any | null | undefined;
export async function roomCapability(): Promise<any | null> {
  if (roomNs !== undefined) return roomNs;
  try {
    if (!window.claude || typeof window.claude.use !== 'function') { roomNs = null; return null; }
    roomNs = await Promise.race([
      window.claude.use('room'),
      new Promise(res => setTimeout(() => res(null), 11000)),
    ]);
  } catch { roomNs = null; }
  return roomNs;
}

// ---------------------------------------------------------------- claude room
class RoomNet implements Net {
  kind = 'room' as const;
  private nr: any;
  private pending: Record<string, any> = {};
  private timer: any = null;
  private last: Record<string, string> = {};
  constructor(nr: any) { this.nr = nr; }
  sizeWith(patch: Record<string, any>) {
    const merged: Record<string, any> = {};
    for (const [k, j] of Object.entries(this.last)) if (j !== 'null') merged[k] = JSON.parse(j);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete merged[k]; else merged[k] = v; }
    return bytes(merged);
  }
  set(patch: Record<string, any>) {
    // only send fields that actually changed; coalesce within a tick
    for (const [k, v] of Object.entries(patch)) {
      const j = JSON.stringify(v ?? null);
      if (this.last[k] === j) continue;
      this.last[k] = j; this.pending[k] = v ?? null;
    }
    if (!this.timer && Object.keys(this.pending).length) {
      this.timer = setTimeout(() => {
        const p = this.pending; this.pending = {}; this.timer = null;
        this.nr.presence(p).catch((e: any) => console.warn('presence rejected', e?.code, e?.message));
      }, 30);
    }
  }
  peers(): PeerLite[] {
    return (this.nr.peers() || []).filter((p: any) => p.kind !== 'agent').map((p: any) => ({ peer: p.peer, isMe: p.sameTab, presence: p.presence || {} }));
  }
  onPeers(fn: (p: PeerLite[]) => void) {
    return this.nr.onPeers(() => fn(this.peers()), (e: any) => console.warn('room error', e?.code));
  }
  connected() { try { return !!this.nr.connected(); } catch { return false; } }
  leave() { try { this.nr.leave(); } catch { /* ignore */ } }
}

// ---------------------------------------------------------------- local fallback
class LocalNet implements Net {
  kind = 'local' as const;
  private bc: BroadcastChannel | null = null;
  private id = Math.random().toString(36).slice(2, 10);
  private me: Record<string, any> = {};
  private others = new Map<string, { presence: Record<string, any>; seen: number }>();
  private subs = new Set<(p: PeerLite[]) => void>();
  private hb: any; private sweep: any; private emitT: any = null;
  constructor(name: string) {
    try { this.bc = new BroadcastChannel('onuw:' + name); } catch { this.bc = null; }
    if (this.bc) {
      this.bc.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.from === this.id) return;
        if (m.t === 'p') { this.others.set(m.from, { presence: m.presence || {}, seen: Date.now() }); this.emit(); }
        else if (m.t === 'hello') { this.post(); }
        else if (m.t === 'bye') { this.others.delete(m.from); this.emit(); }
      };
      this.bc.postMessage({ t: 'hello', from: this.id });
    }
    this.hb = setInterval(() => this.post(), 2000);
    this.sweep = setInterval(() => {
      const now = Date.now(); let ch = false;
      for (const [k, v] of this.others) if (now - v.seen > 7000) { this.others.delete(k); ch = true; }
      if (ch) this.emit();
    }, 1500);
    window.addEventListener('pagehide', () => this.leave());
    setTimeout(() => this.emit(), 0);
  }
  private post() { try { this.bc?.postMessage({ t: 'p', from: this.id, presence: this.me }); } catch { /* ignore */ } }
  private emit() {
    if (this.emitT) return;
    this.emitT = setTimeout(() => { this.emitT = null; const p = this.peers(); this.subs.forEach(f => f(p)); }, 16);
  }
  sizeWith(patch: Record<string, any>) {
    const merged: Record<string, any> = { ...this.me };
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete merged[k]; else merged[k] = v; }
    return bytes(merged);
  }
  set(patch: Record<string, any>) {
    const next = { ...this.me };
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete next[k]; else next[k] = v; }
    this.me = next; this.post(); this.emit();
    try { (window as any).__onuwCheck?.(next); } catch { /* test hook only */ }
  }
  peers(): PeerLite[] {
    const out: PeerLite[] = [{ peer: this.id, isMe: true, presence: this.me }];
    for (const [k, v] of this.others) out.push({ peer: k, isMe: false, presence: v.presence });
    return out;
  }
  onPeers(fn: (p: PeerLite[]) => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  connected() { return true; }
  leave() {
    clearInterval(this.hb); clearInterval(this.sweep);
    try { this.bc?.postMessage({ t: 'bye', from: this.id }); this.bc?.close(); } catch { /* ignore */ }
    this.bc = null;
  }
}

// ---------------------------------------------------------------- PeerJS (WebRTC)
export const peerAvailable = () => typeof (window as any).Peer === 'function';

type Wire =
  | { t: 'p'; presence: Record<string, any> }                      // client → hub: my presence
  | { t: 'all'; peers: [string, Record<string, any>][] }          // hub → client: everyone (on connect)
  | { t: 'up'; id: string; presence: Record<string, any> }        // hub → client: one peer changed
  | { t: 'gone'; id: string }                                     // hub → client: one peer left
  | { t: 'hb' };

class PeerNet implements Net {
  kind = 'peer' as const;
  private peer: any;
  private me: Record<string, any> = {};
  private others = new Map<string, { presence: Record<string, any>; seen: number }>();
  private subs = new Set<(p: PeerLite[]) => void>();
  private conns = new Map<string, any>();      // hub: connected players
  private conn: any = null;                    // player: link to the hub
  private linked = false;
  private lastHub = 0;
  private emitT: any = null; private sendT: any = null; private hbT: any = null; private retryT: any = null;
  private dead = false;
  constructor(peer: any, private hub: boolean, private hubId: string) {
    this.peer = peer;
    peer.on('disconnected', () => { if (!this.dead) { try { peer.reconnect(); } catch { /* ignore */ } } });
    if (hub) {
      peer.on('connection', (c: any) => this.accept(c));
    } else {
      peer.on('error', (e: any) => { if (e?.type === 'peer-unavailable') this.retry(3000); });
      this.dial();
    }
    this.hbT = setInterval(() => this.beat(), 4000);
    window.addEventListener('pagehide', () => this.leave());
  }

  static open(hubId: string, hub: boolean): Promise<any> {
    const P = (window as any).Peer;
    const opts = (window as any).ONUW_PEER || { debug: 0 };
    return new Promise((resolve, reject) => {
      let tries = 0;
      const attempt = () => {
        const peer = hub ? new P(hubId, opts) : new P(opts);
        let settled = false;
        peer.on('open', () => { settled = true; resolve(peer); });
        peer.on('error', (e: any) => {
          if (settled) return;
          settled = true;
          try { peer.destroy(); } catch { /* ignore */ }
          // after a reload the old registration can linger for a few seconds
          if (hub && e?.type === 'unavailable-id' && ++tries < 6) setTimeout(attempt, 2500);
          else reject(Object.assign(new Error(e?.type || 'peer-error'), { type: e?.type }));
        });
      };
      attempt();
    });
  }

  // ---- hub side
  private accept(c: any) {
    c.on('open', () => {
      this.conns.set(c.peer, c);
      const all: [string, Record<string, any>][] = [['hub', this.me]];
      for (const [k, v] of this.others) all.push([k, v.presence]);
      this.sendTo(c, { t: 'all', peers: all });
    });
    c.on('data', (d: Wire) => {
      if (!d || typeof d !== 'object') return;
      const entry = this.others.get(c.peer);
      if (d.t === 'p' && d.presence && typeof d.presence === 'object') {
        this.others.set(c.peer, { presence: d.presence, seen: Date.now() });
        this.broadcast({ t: 'up', id: c.peer, presence: d.presence }, c.peer);
        this.emit();
      } else if (d.t === 'hb' && entry) entry.seen = Date.now();
    });
    const drop = () => this.drop(c.peer);
    c.on('close', drop); c.on('error', drop);
  }
  private drop(id: string) {
    const c = this.conns.get(id);
    this.conns.delete(id);
    try { c?.close(); } catch { /* ignore */ }
    if (this.others.delete(id)) { this.broadcast({ t: 'gone', id }); this.emit(); }
  }
  private broadcast(m: Wire, except?: string) { for (const [id, c] of this.conns) if (id !== except) this.sendTo(c, m); }
  private sendTo(c: any, m: Wire) { try { if (c.open) c.send(m); } catch { /* ignore */ } }

  // ---- player side
  private dial() {
    if (this.dead) return;
    const c = this.peer.connect(this.hubId, { reliable: true, serialization: 'json' });
    c.on('open', () => { this.conn = c; this.linked = true; this.lastHub = Date.now(); this.sendNow(); this.emit(); });
    c.on('data', (d: Wire) => {
      if (!d || typeof d !== 'object') return;
      this.lastHub = Date.now();
      const mine = this.peer.id;
      if (d.t === 'all') { this.others.clear(); for (const [id, pr] of d.peers) if (id !== mine) this.others.set(id, { presence: pr || {}, seen: Date.now() }); this.emit(); }
      else if (d.t === 'up' && d.id !== mine) { this.others.set(d.id, { presence: d.presence || {}, seen: Date.now() }); this.emit(); }
      else if (d.t === 'gone') { this.others.delete(d.id); this.emit(); }
    });
    const lost = () => { if (this.conn === c || !this.linked) this.lostHub(); };
    c.on('close', lost); c.on('error', lost);
  }
  private lostHub() {
    if (this.dead) return;
    this.linked = false; this.conn = null;
    if (this.others.size) { this.others.clear(); this.emit(); }
    this.retry(2000);
  }
  private retry(ms: number) {
    if (this.dead || this.retryT) return;
    this.retryT = setTimeout(() => { this.retryT = null; if (!this.linked) this.dial(); }, ms);
  }
  private sendNow() { if (this.conn && this.linked) this.sendTo(this.conn, { t: 'p', presence: this.me }); }

  private beat() {
    const now = Date.now();
    if (this.hub) {
      this.broadcast({ t: 'hb' });
      for (const [id, v] of this.others) if (now - v.seen > 16000) this.drop(id);
    } else if (this.linked) {
      this.sendTo(this.conn, { t: 'hb' });
      if (now - this.lastHub > 16000) { try { this.conn?.close(); } catch { /* ignore */ } this.lostHub(); }
    }
  }

  // ---- Net
  private emit() {
    if (this.emitT) return;
    this.emitT = setTimeout(() => { this.emitT = null; const p = this.peers(); this.subs.forEach(f => f(p)); }, 16);
  }
  sizeWith(patch: Record<string, any>) {
    const merged: Record<string, any> = { ...this.me };
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete merged[k]; else merged[k] = v; }
    return bytes(merged);
  }
  set(patch: Record<string, any>) {
    const next = { ...this.me };
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete next[k]; else next[k] = v; }
    this.me = next; this.emit();
    if (!this.sendT) this.sendT = setTimeout(() => {
      this.sendT = null;
      if (this.hub) this.broadcast({ t: 'up', id: 'hub', presence: this.me }); else this.sendNow();
    }, 30);
  }
  peers(): PeerLite[] {
    const out: PeerLite[] = [{ peer: this.hub ? 'hub' : (this.peer.id || 'me'), isMe: true, presence: this.me }];
    for (const [k, v] of this.others) out.push({ peer: k, isMe: false, presence: v.presence });
    return out;
  }
  onPeers(fn: (p: PeerLite[]) => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  connected() { return this.hub ? !!(this.peer && !this.peer.disconnected) : this.linked; }
  leave() {
    if (this.dead) return;
    this.dead = true;
    clearInterval(this.hbT); clearTimeout(this.retryT); clearTimeout(this.sendT);
    try { this.peer.destroy(); } catch { /* ignore */ }
  }
}

export async function joinNet(code: string, hub = false): Promise<Net> {
  const name = 'onuw-' + code.toLowerCase();
  const room = await roomCapability();
  if (room) {
    try { const nr = await room.join(name); return new RoomNet(nr); }
    catch (e: any) { console.warn('room join failed', e?.code); }
  }
  if (peerAvailable()) {
    const hubId = 'onuw1-' + code.toLowerCase();
    try { const peer = await PeerNet.open(hubId, hub); return new PeerNet(peer, hub, hubId); }
    catch (e: any) {
      if (e?.type === 'unavailable-id') throw e;   // the code is in use by another host
      console.warn('peer connection failed, using this device only', e?.type);
    }
  }
  return new LocalNet(name);
}

// ---------------------------------------------------------------- crypto
// ECDH P-256 between host and each player → AES-GCM. Private info and secret
// actions travel encrypted, so nobody can read another player's card from
// presence data.
const subtle: SubtleCrypto | undefined = (globalThis.crypto && (globalThis.crypto as any).subtle) || undefined;
export const cryptoOk = !!subtle;

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
};
const unb64 = (s: string) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const utf8 = new TextEncoder(); const unutf8 = new TextDecoder();

export interface Keys { priv: CryptoKey | null; pub: string; jwk: any }

export async function makeKeys(saved?: any): Promise<Keys> {
  if (!subtle) return { priv: null, pub: 'plain', jwk: null };
  try {
    if (saved && saved.d) {
      const priv = await subtle.importKey('jwk', saved, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      const pubJwk = { kty: saved.kty, crv: saved.crv, x: saved.x, y: saved.y, ext: true };
      const pubKey = await subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
      return { priv, pub: b64(await subtle.exportKey('raw', pubKey)), jwk: saved };
    }
  } catch { /* fall through and make fresh keys */ }
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']) as CryptoKeyPair;
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { priv: kp.privateKey, pub: b64(await subtle.exportKey('raw', kp.publicKey)), jwk };
}

const sharedCache = new Map<string, Promise<CryptoKey | null>>();
export function sharedKey(mine: Keys, theirPub: string): Promise<CryptoKey | null> {
  if (!subtle || !mine.priv || !theirPub || theirPub === 'plain') return Promise.resolve(null);
  const k = mine.pub + '|' + theirPub;
  let p = sharedCache.get(k);
  if (!p) {
    p = (async () => {
      try {
        const pub = await subtle.importKey('raw', unb64(theirPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
        return await subtle.deriveKey({ name: 'ECDH', public: pub }, mine.priv!, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      } catch { return null; }
    })();
    sharedCache.set(k, p);
  }
  return p;
}

export async function seal(key: CryptoKey | null, obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  if (!subtle || !key) return 'p:' + b64(utf8.encode(json));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(json)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return 'e:' + b64(out);
}

export async function open<T = any>(key: CryptoKey | null, s: string): Promise<T | null> {
  try {
    if (!s) return null;
    if (s.startsWith('p:')) return JSON.parse(unutf8.decode(unb64(s.slice(2))));
    if (!subtle || !key || !s.startsWith('e:')) return null;
    const u = unb64(s.slice(2));
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12));
    return JSON.parse(unutf8.decode(pt));
  } catch { return null; }
}

export const bytes = (o: unknown) => utf8.encode(JSON.stringify(o)).length;

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(len = 5) {
  const u = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(u, b => ALPHA[b % ALPHA.length]).join('');
}
export function newId(len = 8) {
  const u = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(u, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
