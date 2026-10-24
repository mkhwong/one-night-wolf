// Host-authoritative game engine. Runs only on the host's device; everyone
// else receives the public state plus their own encrypted private info.
import { R, ROLES, nightTurns, isWolfCard, poolProblem, autoBalance, MAX_PLAYERS } from './roles';

export type Phase = 'lobby' | 'reveal' | 'night' | 'day' | 'vote' | 'hunt' | 'end';

export const INTRO_MS = 2800;          // role transition before a night turn opens
export const REVEAL_MS = 15000;        // look at your card
export const REVEAL_MIN_MS = 4000;
export const EMPTY_NIGHT_MS = 5000;

export interface Seat { pid: string; name: string; bot: boolean }
export interface Cfg { pool: number[]; tn: number; dd: number; vd: number; hr: boolean; tm: boolean }

export type Info =
  | { k: 'team'; t: number; s: number[] }            // fellow wolves / masons, or wolves seen by Minion & Mystic Wolf
  | { k: 'lone'; t: number }                         // you are the only werewolf
  | { k: 'pc'; t: number; c: number[]; r: number[] } // looked at center card(s)
  | { k: 'pp'; t: number; s: number; r: number }     // looked at a player's card
  | { k: 'rob'; t: number; s: number; r: number }    // robbed seat s, new card r
  | { k: 'sw'; t: number; a: number; b: number }     // swapped two players' cards
  | { k: 'ws'; t: number; c: number; s: number; auto?: 1 } // witch gave center c to seat s
  | { k: 'dr'; t: number; c: number; auto?: 1 }      // drunk took center c
  | { k: 'me'; t: number; r: number }                // insomniac: own card now
  | { k: 'skip'; t: number };

export type LogEntry = Info & { by: number };

export interface Result {
  st: number[]; fn: number[]; c0: number[]; cf: number[];
  v: number[];                  // vote per seat: target seat, -1 = no werewolves, -2 = no vote
  d: number[];                  // dead seats
  hs: [number, number][];       // hunter shots [hunter seat, target]
  how: 'vote' | 'peace' | 'none' | 'hunt';
  w: { v: 0 | 1; w: 0 | 1; t: 0 | 1 };
  win: number[];
  noWolf: 0 | 1;
  log: LogEntry[];
}

export type BotMsg =
  | { k: 'claim'; r: number; i?: Info }
  | { k: 'hmm' }
  | { k: 'sus'; s: number }
  | { k: 'trust'; s: number }
  | { k: 'peace' };

export interface Social {
  c: [number, number, number][];          // [seat, claimId, role]
  m: [number, number, string][];          // [seat, msgId, JSON of BotMsg] (a string keeps presence nesting shallow)
  t: [number, number, number, number][];  // [seat, throwId, item, targetSeat]
}

interface Sched { at: number; seat: number; kind: 'night' | 'claim' | 'chat' | 'throw' | 'vote'; data?: number }

export interface EngineState {
  gid: string; code: string; ep: number; ph: Phase; sq: number;
  seats: Seat[]; cfg: Cfg;
  start: number[]; cards: number[]; center0: number[]; center: number[];
  turns: number[]; ti: number; ts: number; te: number;
  priv: Info[][];
  done: boolean[]; witchPeek: number;
  log: LogEntry[];
  votes: number[]; locked: boolean[];
  ready: boolean[];
  hunt: null | { seat: number; rem: number; back: 'day' | 'vote' };
  res: Result | null;
  sched: Sched[];
  soc: Social; nid: number;
  lastStart: number[];
  claims: Record<number, number>;   // latest human + bot claims, fed by the host for bot logic
  custom: boolean;                  // host edited the pool by hand
  off: number[];                    // seats whose device is not connected
  nonces: Record<string, number>;   // last processed action nonce per pid
  hunts: Record<string, number>;    // last processed hunter intent id per pid
}

export interface PubState {
  ep: number; ph: Phase; sq: number;
  seats: [string, string, 0 | 1][];
  cfg: Cfg;
  tr: number[]; ti: number; ts: number; te: number;
  lk: number; rdy: number[]; off: number[];
  hunt: [number, number] | 0;
  res: Result | null;
  soc: Social;
}

export interface PrivState { ep: number; seat: number; r: number; i: Info[]; v?: number; lk?: 0 | 1 }

const rint = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const BOT_NAMES = ['Rowan', 'Silas', 'Mira', 'Ivy', 'Bram', 'Tess', 'Oren', 'Lark', 'Wren', 'Juno', 'Pip', 'Hale'];

export function defaultCfg(players = 5): Cfg {
  return { pool: autoBalance(players), tn: 12, dd: 300, vd: 30, hr: true, tm: false };
}

export function newState(gid: string, code: string, host: Seat): EngineState {
  return {
    gid, code, ep: 0, ph: 'lobby', sq: 1,
    seats: [host], cfg: defaultCfg(3),
    start: [], cards: [], center0: [], center: [],
    turns: [], ti: -1, ts: 0, te: 0,
    priv: [], done: [], witchPeek: -1, log: [],
    votes: [], locked: [], ready: [], hunt: null, res: null,
    sched: [], soc: { c: [], m: [], t: [] }, nid: 1, lastStart: [],
    claims: {}, nonces: {}, hunts: {}, custom: false, off: [],
  };
}

// ---------------------------------------------------------------- resolution

/** Pure: who dies from a set of votes, then Hunter chains. */
export function tallyDeaths(votes: number[], finals: number[]): { dead: number[]; hs: [number, number][]; how: Result['how'] } {
  const n = finals.length;
  const tally = new Array(n).fill(0);
  let peace = 0;
  votes.forEach(v => { if (v === -1) peace++; else if (v >= 0 && v < n) tally[v]++; });
  const maxP = Math.max(0, ...tally);
  let dead: number[] = [];
  let how: Result['how'] = 'vote';
  if (peace > maxP) how = 'peace';
  else if (maxP <= 1) how = 'none';
  else dead = tally.map((c, i) => (c === maxP ? i : -1)).filter(i => i >= 0);
  const hs: [number, number][] = [];
  for (let qi = 0; qi < dead.length && qi < 64; qi++) {
    const d = dead[qi];
    const tgt = votes[d];
    if (finals[d] === R.HUNTER && tgt >= 0 && !dead.includes(tgt)) { hs.push([d, tgt]); dead.push(tgt); }
  }
  return { dead, hs, how };
}

/** Pure: winners from final cards and the dead. */
export function decideWinners(finals: number[], dead: number[]): { w: Result['w']; win: number[]; noWolf: 0 | 1 } {
  const wolves = finals.map((r, i) => (isWolfCard(r) ? i : -1)).filter(i => i >= 0);
  const minion = finals.some(r => r === R.MINION);
  const tannerDead = dead.some(d => finals[d] === R.TANNER);
  const wolfDead = dead.some(d => isWolfCard(finals[d]));
  let village: boolean, wolfTeam: boolean;
  if (wolves.length > 0) {
    village = wolfDead;
    wolfTeam = !wolfDead && !tannerDead;
  } else {
    village = dead.length === 0;
    // house rule: with no wolf among players, the Minion wins when anyone is executed, the Minion included
    wolfTeam = minion && dead.length > 0 && !tannerDead;
  }
  const win: number[] = [];
  finals.forEach((r, i) => {
    const team = ROLES[r].team;
    if (team === 'village' && village) win.push(i);
    else if (team === 'wolf' && wolfTeam) win.push(i);
    else if (team === 'tanner' && dead.includes(i)) win.push(i);
  });
  return { w: { v: village ? 1 : 0, w: wolfTeam ? 1 : 0, t: tannerDead ? 1 : 0 }, win, noWolf: wolves.length ? 0 : 1 };
}

// ---------------------------------------------------------------- engine

export class Engine {
  s: EngineState;
  constructor(s: EngineState) { this.s = s; }

  private bump() { this.s.sq++; }
  get n() { return this.s.seats.length; }
  seatOf(pid: string) { return this.s.seats.findIndex(x => x.pid === pid); }

  // ---- lobby
  addSeat(seat: Seat): boolean {
    const s = this.s;
    if (s.ph !== 'lobby' || s.seats.length >= MAX_PLAYERS) return false;
    const i = this.seatOf(seat.pid);
    if (i >= 0) { if (s.seats[i].name !== seat.name) { s.seats[i].name = seat.name; this.bump(); } return true; }
    s.seats.push(seat); this.fitPool(); this.bump(); return true;
  }
  rename(pid: string, name: string) {
    const i = this.seatOf(pid);
    if (i >= 0 && this.s.seats[i].name !== name) { this.s.seats[i].name = name; this.bump(); }
  }
  removeSeat(pid: string) {
    const s = this.s;
    if (s.ph !== 'lobby') return;
    const i = this.seatOf(pid);
    if (i > 0) { s.seats.splice(i, 1); this.fitPool(); this.bump(); }
  }
  addBot(): boolean {
    const used = new Set(this.s.seats.map(x => x.name));
    const name = '🤖 ' + (BOT_NAMES.find(b => !used.has('🤖 ' + b)) || 'Bot' + this.s.nid++);
    return this.addSeat({ pid: 'bot' + Math.random().toString(36).slice(2, 7), name, bot: true });
  }
  removeBots() {
    if (this.s.ph !== 'lobby') return;
    this.s.seats = this.s.seats.filter((x, i) => i === 0 || !x.bot); this.fitPool(); this.bump();
  }
  /** Keep the pool the right size as people come and go (only if the host hasn't customised it to fit). */
  private fitPool() {
    const need = this.n + 3;
    if (!this.s.custom && this.s.cfg.pool.length !== need) this.s.cfg.pool = autoBalance(Math.max(3, this.n));
  }
  setCfg(p: Partial<Cfg>, custom?: boolean) {
    this.s.cfg = { ...this.s.cfg, ...p };
    if (custom !== undefined) this.s.custom = custom;
    this.bump();
  }
  setOffline(seats: number[]) {
    const a = seats.slice().sort((x, y) => x - y);
    if (a.join() !== this.s.off.join()) { this.s.off = a; this.bump(); }
  }

  canStart(): string | null { return poolProblem(this.s.cfg.pool, this.n); }

  start(now: number): boolean {
    const s = this.s;
    if (s.ph !== 'lobby' || this.canStart()) return false;
    let deck = shuffle(s.cfg.pool);
    for (let t = 0; t < 5 && s.lastStart.length && deck.slice(0, this.n).join() === s.lastStart.join(); t++) deck = shuffle(s.cfg.pool);
    s.ep++;
    s.start = deck.slice(0, this.n); s.cards = s.start.slice();
    s.center0 = deck.slice(this.n, this.n + 3); s.center = s.center0.slice();
    s.lastStart = s.start.slice();
    s.turns = nightTurns(s.cfg.pool); s.ti = -1;
    s.priv = s.seats.map(() => []); s.done = s.seats.map(() => false); s.witchPeek = -1;
    s.log = []; s.votes = s.seats.map(() => -2); s.locked = s.seats.map(() => false);
    s.ready = s.seats.map(x => x.bot); s.hunt = null; s.res = null; s.sched = [];
    s.soc = { c: [], m: [], t: [] }; s.claims = {};
    s.ph = 'reveal'; s.ts = now; s.te = now + REVEAL_MS;
    this.bump(); return true;
  }

  backToLobby() {
    const s = this.s;
    s.ph = 'lobby'; s.res = null; s.hunt = null; s.sched = []; s.soc = { c: [], m: [], t: [] }; s.ti = -1;
    s.start = []; s.cards = []; s.center = []; s.center0 = []; s.priv = [];
    this.bump();
  }

  setReady(seat: number) {
    if (this.s.ph === 'reveal' && seat >= 0 && !this.s.ready[seat]) { this.s.ready[seat] = true; this.bump(); }
  }

  // ---- clock
  tick(now: number) {
    const s = this.s;
    this.runSched(now);
    if (s.ph === 'reveal') {
      const allReady = s.ready.every(Boolean);
      if (now >= s.te || (allReady && now >= s.ts + REVEAL_MIN_MS)) this.beginNight(now);
    } else if (s.ph === 'night') {
      if (now >= s.te) {
        if (s.ti >= 0) this.endTurn(now);
        if (s.ti + 1 < s.turns.length) this.beginTurn(s.ti + 1, now);
        else this.beginDay(now);
      }
    } else if (s.ph === 'day') {
      if (now >= s.te) this.beginVote(now);
    } else if (s.ph === 'vote') {
      if (now >= s.te || s.locked.every(Boolean)) this.resolveVote();
    }
  }

  private beginNight(now: number) {
    const s = this.s;
    s.ph = 'night';
    if (s.turns.length === 0) { s.ti = -1; s.ts = now; s.te = now + EMPTY_NIGHT_MS; s.turns = []; this.bump(); return; }
    this.beginTurn(0, now);
  }

  private holders(role: number) { return this.s.start.map((r, i) => (r === role ? i : -1)).filter(i => i >= 0); }

  private beginTurn(ti: number, now: number) {
    const s = this.s;
    s.ti = ti; s.ts = now; s.te = now + INTRO_MS + s.cfg.tn * 1000;
    s.done = s.seats.map(() => false); s.witchPeek = -1;
    const role = s.turns[ti];
    const who = this.holders(role);
    const wolvesStart = this.holders(R.WEREWOLF);
    const allWolves = s.start.map((r, i) => (isWolfCard(r) ? i : -1)).filter(i => i >= 0);
    if (role === R.WEREWOLF) {
      for (const w of who) {
        if (wolvesStart.length >= 2) this.give(w, { k: 'team', t: role, s: wolvesStart.filter(x => x !== w) });
        else this.give(w, { k: 'lone', t: role });
      }
    } else if (role === R.MYSTIC) {
      for (const w of who) this.give(w, { k: 'team', t: role, s: wolvesStart.filter(x => x !== w) });
    } else if (role === R.MINION) {
      for (const w of who) this.give(w, { k: 'team', t: role, s: allWolves });
    } else if (role === R.MASON) {
      for (const w of who) this.give(w, { k: 'team', t: role, s: who.filter(x => x !== w) });
    } else if (role === R.INSOMNIAC) {
      for (const w of who) this.give(w, { k: 'me', t: role, r: s.cards[w] });
    }
    // bots act a little after the turn opens
    const actionRoles = [R.WEREWOLF, R.MYSTIC, R.SEER, R.APPRENTICE, R.ROBBER, R.WITCH, R.TROUBLEMAKER, R.GREMLIN, R.DRUNK];
    if (actionRoles.includes(role as any)) {
      const win = Math.max(1500, s.cfg.tn * 1000 - 1500);
      for (const w of who) if (s.seats[w].bot) s.sched.push({ at: now + INTRO_MS + rint(1200, Math.min(win, 5000)), seat: w, kind: 'night' });
    }
    this.bump();
  }

  private give(seat: number, info: Info) { this.s.priv[seat].push(info); this.s.log.push({ ...info, by: seat } as LogEntry); }

  private endTurn(_now: number) {
    const s = this.s;
    const role = s.turns[s.ti];
    for (const w of this.holders(role)) {
      if (role === R.WITCH && s.witchPeek >= 0 && !s.done[w]) this.witchGive(w, w, true);
      if (role === R.DRUNK && !s.done[w]) this.drunkSwap(w, rint(0, 2), true);
    }
  }

  private beginDay(now: number) {
    const s = this.s;
    s.ph = 'day'; s.ti = s.turns.length; s.ts = now; s.te = now + s.cfg.dd * 1000;
    const span = Math.min(s.cfg.dd * 1000 * 0.5, 30000);
    s.seats.forEach((seat, i) => {
      if (!seat.bot) return;
      s.sched.push({ at: now + rint(2500, Math.max(3000, span)), seat: i, kind: 'claim' });
      if (Math.random() < 0.7) s.sched.push({ at: now + rint(6000, Math.max(7000, span + 8000)), seat: i, kind: 'chat' });
      if (Math.random() < 0.3) s.sched.push({ at: now + rint(5000, Math.max(6000, span + 10000)), seat: i, kind: 'throw' });
    });
    this.bump();
  }

  beginVote(now: number) {
    const s = this.s;
    if (s.ph !== 'day') return;
    s.ph = 'vote'; s.ts = now; s.te = now + s.cfg.vd * 1000;
    s.votes = s.seats.map(() => -2); s.locked = s.seats.map(() => false);
    s.sched = [];
    s.seats.forEach((seat, i) => { if (seat.bot) s.sched.push({ at: now + rint(1500, Math.min(9000, s.cfg.vd * 500)), seat: i, kind: 'vote' }); });
    this.bump();
  }

  // ---- night actions (validated)
  act(seat: number, ti: number, x: any, now: number): boolean {
    const s = this.s;
    if (s.ph !== 'night' || ti !== s.ti || seat < 0 || seat >= this.n) return false;
    if (now < s.ts + INTRO_MS - 500) return false;
    const role = s.turns[s.ti];
    if (s.start[seat] !== role || s.done[seat]) return false;
    const n = this.n;
    const okSeat = (v: any) => Number.isInteger(v) && v >= 0 && v < n;
    const okC = (v: any) => Number.isInteger(v) && v >= 0 && v < 3;
    if (x && x.skip) {
      if (role === R.WITCH && s.witchPeek >= 0) return false;  // must give the card away
      if (role === R.DRUNK) return false;
      s.done[seat] = true; this.give(seat, { k: 'skip', t: role }); this.bump(); return true;
    }
    switch (role) {
      case R.WEREWOLF: {
        if (this.holders(R.WEREWOLF).length !== 1 || !okC(x?.c)) return false;
        this.give(seat, { k: 'pc', t: role, c: [x.c], r: [s.center[x.c]] }); break;
      }
      case R.MYSTIC: case R.SEER: {
        if (role === R.SEER && Array.isArray(x?.c)) {
          const [a, b] = x.c;
          if (!okC(a) || !okC(b) || a === b) return false;
          this.give(seat, { k: 'pc', t: role, c: [a, b], r: [s.center[a], s.center[b]] }); break;
        }
        if (!okSeat(x?.s) || x.s === seat) return false;
        this.give(seat, { k: 'pp', t: role, s: x.s, r: s.cards[x.s] }); break;
      }
      case R.APPRENTICE: {
        if (!okC(x?.c)) return false;
        this.give(seat, { k: 'pc', t: role, c: [x.c], r: [s.center[x.c]] }); break;
      }
      case R.ROBBER: {
        if (!okSeat(x?.s) || x.s === seat) return false;
        [s.cards[seat], s.cards[x.s]] = [s.cards[x.s], s.cards[seat]];
        this.give(seat, { k: 'rob', t: role, s: x.s, r: s.cards[seat] }); break;
      }
      case R.WITCH: {
        if (s.witchPeek < 0) {
          if (!okC(x?.c)) return false;
          s.witchPeek = x.c;
          this.give(seat, { k: 'pc', t: role, c: [x.c], r: [s.center[x.c]] });
          this.bump(); return true;               // second step still to come
        }
        if (!okSeat(x?.s)) return false;
        this.witchGive(seat, x.s, false); this.bump(); return true;
      }
      case R.TROUBLEMAKER: case R.GREMLIN: {
        const a = x?.a, b = x?.b;
        if (!okSeat(a) || !okSeat(b) || a === b) return false;
        if (role === R.TROUBLEMAKER && (a === seat || b === seat)) return false;
        [s.cards[a], s.cards[b]] = [s.cards[b], s.cards[a]];
        this.give(seat, { k: 'sw', t: role, a, b }); break;
      }
      case R.DRUNK: {
        if (!okC(x?.c)) return false;
        this.drunkSwap(seat, x.c, false); this.bump(); return true;
      }
      default: return false;
    }
    s.done[seat] = true; this.bump(); return true;
  }

  private witchGive(seat: number, target: number, auto: boolean) {
    const s = this.s; const c = s.witchPeek;
    [s.center[c], s.cards[target]] = [s.cards[target], s.center[c]];
    this.give(seat, auto ? { k: 'ws', t: R.WITCH, c, s: target, auto: 1 } : { k: 'ws', t: R.WITCH, c, s: target });
    s.done[seat] = true; s.witchPeek = -1;
  }
  private drunkSwap(seat: number, c: number, auto: boolean) {
    const s = this.s;
    [s.center[c], s.cards[seat]] = [s.cards[seat], s.center[c]];
    this.give(seat, auto ? { k: 'dr', t: R.DRUNK, c, auto: 1 } : { k: 'dr', t: R.DRUNK, c });
    s.done[seat] = true;
  }

  // ---- day / vote
  skipToVote(now: number) { if (this.s.ph === 'day') this.beginVote(now); }

  vote(seat: number, target: number, lock: boolean): boolean {
    const s = this.s;
    if (s.ph !== 'vote' || seat < 0 || seat >= this.n || s.locked[seat]) return false;
    if (!(target === -1 || (Number.isInteger(target) && target >= 0 && target < this.n && target !== seat))) return false;
    s.votes[seat] = target;
    if (lock) s.locked[seat] = true;
    this.bump(); return true;
  }

  private resolveVote() {
    const s = this.s;
    const votes = s.votes.map((v, i) => {
      if (v === -1 || (v >= 0 && v !== i)) return v;
      const others = s.seats.map((_, j) => j).filter(j => j !== i);
      return pick(others);
    });
    const { dead, hs, how } = tallyDeaths(votes, s.cards);
    this.finish(votes, dead, hs, how);
  }

  huntAim(seat: number, now: number): boolean {
    const s = this.s;
    if (!s.cfg.hr || s.hunt || !(s.ph === 'day' || s.ph === 'vote')) return false;
    if (s.start[seat] !== R.HUNTER) return false;
    s.hunt = { seat, rem: Math.max(5000, s.te - now), back: s.ph };
    s.ph = 'hunt'; this.bump(); return true;
  }
  huntCancel(seat: number | null, now: number) {
    const s = this.s;
    if (s.ph !== 'hunt' || !s.hunt || (seat !== null && seat !== s.hunt.seat)) return;
    s.ph = s.hunt.back; s.te = now + s.hunt.rem; s.hunt = null; this.bump();
  }
  huntShoot(seat: number, target: number): boolean {
    const s = this.s;
    if (s.ph !== 'hunt' || !s.hunt || s.hunt.seat !== seat || target === seat || target < 0 || target >= this.n) return false;
    s.hunt = null;
    this.finish(s.seats.map(() => -2), [target], [[seat, target]], 'hunt');
    return true;
  }

  private finish(votes: number[], dead: number[], hs: [number, number][], how: Result['how']) {
    const s = this.s;
    const { w, win, noWolf } = decideWinners(s.cards, dead);
    s.res = { st: s.start.slice(), fn: s.cards.slice(), c0: s.center0.slice(), cf: s.center.slice(), v: votes, d: dead, hs, how, w, win, noWolf, log: s.log.slice() };
    s.ph = 'end'; s.sched = []; this.bump();
  }

  // ---- bots
  private runSched(now: number) {
    const s = this.s;
    if (!s.sched.length || s.ph === 'hunt') return;
    const due = s.sched.filter(x => x.at <= now);
    if (!due.length) return;
    s.sched = s.sched.filter(x => x.at > now);
    for (const job of due) {
      try { this.botDo(job, now); } catch { /* a bot misstep must never stall the game */ }
    }
  }

  private botKnowsWolves(seat: number): number[] {
    const t = this.s.priv[seat].find(i => i.k === 'team' && (i.t === R.WEREWOLF || i.t === R.MYSTIC || i.t === R.MINION));
    return t && t.k === 'team' ? t.s : [];
  }

  private botDo(job: Sched, now: number) {
    const s = this.s; const me = job.seat;
    const others = s.seats.map((_, i) => i).filter(i => i !== me);
    const role = s.start[me];
    if (job.kind === 'night') {
      if (s.ph !== 'night' || s.turns[s.ti] !== role) return;
      switch (role) {
        case R.WEREWOLF: if (this.holders(R.WEREWOLF).length === 1) this.act(me, s.ti, { c: rint(0, 2) }, now); break;
        case R.MYSTIC: { const known = this.botKnowsWolves(me); const t = others.filter(o => !known.includes(o)); this.act(me, s.ti, { s: pick(t.length ? t : others) }, now); break; }
        case R.SEER: if (Math.random() < 0.6) this.act(me, s.ti, { s: pick(others) }, now); else { const a = rint(0, 2); this.act(me, s.ti, { c: [a, (a + rint(1, 2)) % 3] }, now); } break;
        case R.APPRENTICE: this.act(me, s.ti, { c: rint(0, 2) }, now); break;
        case R.ROBBER: this.act(me, s.ti, { s: pick(others) }, now); break;
        case R.WITCH: this.act(me, s.ti, { c: rint(0, 2) }, now); this.act(me, s.ti, { s: Math.random() < 0.3 ? me : pick(others) }, now); break;
        case R.TROUBLEMAKER: { if (others.length < 2) break; const a = pick(others); const b = pick(others.filter(o => o !== a)); this.act(me, s.ti, { a, b }, now); break; }
        case R.GREMLIN: { const all = s.seats.map((_, i) => i); const a = pick(all); const b = pick(all.filter(o => o !== a)); this.act(me, s.ti, { a, b }, now); break; }
        case R.DRUNK: this.act(me, s.ti, { c: rint(0, 2) }, now); break;
      }
      return;
    }
    if (job.kind === 'claim') {
      if (s.ph !== 'day') return;
      let r = role; let info: Info | undefined;
      const team = ROLES[role].team;
      if (team === 'village') info = s.priv[me].filter(i => i.k !== 'skip').slice(-1)[0];
      else {
        const lies = Array.from(new Set(s.cfg.pool.filter(x => ROLES[x].team === 'village' && x !== R.MASON)));
        r = lies.length ? pick(lies) : R.VILLAGER;
      }
      const id = s.nid++;
      s.soc.c = s.soc.c.filter(c => c[0] !== me); s.soc.c.push([me, id, r]); s.claims[me] = r;
      this.say(me, { k: 'claim', r, i: info && info.k !== 'team' && info.k !== 'lone' ? info : undefined });
      this.bump(); return;
    }
    if (job.kind === 'chat') {
      if (s.ph !== 'day') return;
      const roll = Math.random();
      const msg: BotMsg = roll < 0.35 ? { k: 'sus', s: pick(others) } : roll < 0.6 ? { k: 'trust', s: pick(others) } : roll < 0.72 ? { k: 'peace' } : { k: 'hmm' };
      this.say(me, msg); this.bump(); return;
    }
    if (job.kind === 'throw') {
      if (s.ph !== 'day') return;
      s.soc.t.push([me, s.nid++, rint(0, 2), pick(others)]);
      s.soc.t = s.soc.t.slice(-4); this.bump(); return;
    }
    if (job.kind === 'vote') {
      if (s.ph !== 'vote' || s.locked[me]) return;
      let target = -2;
      const team = ROLES[role].team;
      if (team === 'wolf') {
        const known = this.botKnowsWolves(me);
        const t = others.filter(o => !known.includes(o));
        target = pick(t.length ? t : others);
      } else if (team === 'village') {
        const saw = s.priv[me].find(i => i.k === 'pp' && isWolfCard(i.r));
        if (saw && saw.k === 'pp') target = saw.s;
        if (target < 0) {
          const liars = Object.entries(s.claims).filter(([sStr, r]) => Number(sStr) !== me && r === role && ROLES[role].max === 1).map(([sStr]) => Number(sStr));
          if (liars.length) target = pick(liars);
        }
        if (target < 0) {
          const byRole: Record<number, number[]> = {};
          Object.entries(s.claims).forEach(([sStr, r]) => { (byRole[r] ||= []).push(Number(sStr)); });
          const contested = Object.entries(byRole).filter(([r, ss]) => ss.length > ROLES[Number(r)].max).flatMap(([, ss]) => ss).filter(x => x !== me);
          if (contested.length) target = pick(contested);
        }
        if (target < 0) target = Math.random() < 0.12 ? -1 : pick(others);
      } else target = pick(others);
      if (target === -2 || target === me) target = pick(others);
      this.vote(me, target, true);
    }
  }

  private say(seat: number, msg: BotMsg) {
    this.s.soc.m.push([seat, this.s.nid++, JSON.stringify(msg)]);
    this.s.soc.m = this.s.soc.m.slice(-6);
  }

  // ---- outputs
  pub(): PubState {
    const s = this.s;
    return {
      ep: s.ep, ph: s.ph, sq: s.sq,
      seats: s.seats.map(x => [x.pid, x.name, x.bot ? 1 : 0]),
      cfg: s.cfg, tr: s.turns, ti: s.ti, ts: s.ts, te: s.te,
      lk: s.locked.filter(Boolean).length, off: s.off,
      rdy: s.ready.map((r, i) => (r ? i : -1)).filter(i => i >= 0),
      hunt: s.hunt ? [s.hunt.seat, s.hunt.rem] : 0,
      res: s.res, soc: s.soc,
    };
  }
  priv(seat: number): PrivState | null {
    const s = this.s;
    if (s.ph === 'lobby' || seat < 0 || seat >= s.start.length) return null;
    const p: PrivState = { ep: s.ep, seat, r: s.start[seat], i: s.priv[seat] || [] };
    if (s.ph === 'vote') { p.v = s.votes[seat]; p.lk = s.locked[seat] ? 1 : 0; }
    return p;
  }
}
