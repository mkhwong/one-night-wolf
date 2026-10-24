import { Engine, newState, tallyDeaths, decideWinners, INTRO_MS } from '../src/engine';
import { R, ROLES, randomPool, autoBalance, poolProblem, countPool } from '../src/roles';

let fails = 0;
const eq = (name: string, a: any, b: any) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', name, JSON.stringify(a), '!=', JSON.stringify(b)); } };

// --- deaths
eq('circular tie: nobody', tallyDeaths([1, 2, 0], [R.VILLAGER, R.SEER, R.WEREWOLF]).how, 'none');
eq('majority', tallyDeaths([2, 2, 0], [R.VILLAGER, R.SEER, R.WEREWOLF]).dead, [2]);
eq('tie of two', tallyDeaths([2, 2, 0, 0], [R.VILLAGER, R.SEER, R.WEREWOLF, R.ROBBER]).dead, [0, 2]);
eq('peace wins', tallyDeaths([-1, -1, -1, 0], [R.VILLAGER, R.SEER, R.WEREWOLF, R.ROBBER]).how, 'peace');
eq('peace tie still kills', tallyDeaths([-1, -1, 0, 0], [R.VILLAGER, R.SEER, R.WEREWOLF, R.ROBBER]).dead, [0]);
const h = tallyDeaths([3, 0, 0, 1], [R.HUNTER, R.SEER, R.WEREWOLF, R.ROBBER]);
eq('hunter chain', h.dead, [0, 3]); eq('hunter shot', h.hs, [[0, 3]]);

// --- winners
const F = [R.WEREWOLF, R.SEER, R.VILLAGER, R.MINION];
eq('wolf dies -> village', decideWinners(F, [0]).w, { v: 1, w: 0, t: 0 });
eq('villager dies -> wolves', decideWinners(F, [2]).w, { v: 0, w: 1, t: 0 });
eq('nobody dies, wolf present -> wolves', decideWinners(F, []).w, { v: 0, w: 1, t: 0 });
const NW = [R.SEER, R.VILLAGER, R.MINION, R.TANNER];
eq('no wolves, nobody dies -> village', decideWinners(NW, []).w, { v: 1, w: 0, t: 0 });
eq('no wolves, minion executed -> minion', decideWinners(NW, [2]).win, [2]);
eq('no wolves, villager dies -> minion', decideWinners(NW, [1]).win, [2]);
eq('tanner dies -> tanner only', decideWinners(NW, [3]).win, [3]);
eq('tanner + wolf present, tanner dies', decideWinners([R.WEREWOLF, R.TANNER, R.SEER], [1]).w, { v: 0, w: 0, t: 1 });
eq('tanner & wolf die -> village + tanner', decideWinners([R.WEREWOLF, R.TANNER, R.SEER], [0, 1]).win, [1, 2]);

// --- pools
for (let n = 3; n <= 10; n++) {
  eq('autobalance ' + n, poolProblem(autoBalance(n), n), null);
  for (let k = 0; k < 200; k++) { const p = randomPool(n); const pr = poolProblem(p, n); if (pr) { fails++; console.log('random pool bad', n, pr, countPool(p)); break; } }
}

// --- full bot games
let games = 0, ends: Record<string, number> = {};
for (let g = 0; g < 3000; g++) {
  const n = 3 + (g % 8);
  const e = new Engine(newState('g', 'ABCDE', { pid: 'bot0', name: 'b0', bot: true }));
  for (let i = 1; i < n; i++) e.addBot();
  e.setCfg({ pool: g % 2 ? randomPool(n) : autoBalance(n), tn: 6, dd: 20, vd: 10, hr: true }, true);
  let now = 1000;
  if (!e.start(now)) { fails++; console.log('could not start', e.canStart()); break; }
  const deck0 = [...e.s.cards, ...e.s.center].sort().join();
  for (let step = 0; step < 4000 && e.s.ph !== 'end'; step++) { now += 250; e.tick(now); }
  const deck1 = [...e.s.cards, ...e.s.center].sort().join();
  if (deck0 !== deck1) { fails++; console.log('card multiset changed'); }
  if (e.s.ph !== 'end') { fails++; console.log('did not end', e.s.ph, e.s.ti); break; }
  games++; ends[e.s.res!.how] = (ends[e.s.res!.how] || 0) + 1;
  const sz = JSON.stringify(e.pub()).length;
  if (sz > 3000) console.log('pub large', sz);
}
console.log('games', games, ends);

// --- human night actions
{
  const e = new Engine(newState('g', 'ABCDE', { pid: 'h0', name: 'H', bot: false }));
  e.addSeat({ pid: 'h1', name: 'H1', bot: false }); e.addSeat({ pid: 'h2', name: 'H2', bot: false });
  e.setCfg({ pool: [R.ROBBER, R.WITCH, R.WEREWOLF, R.SEER, R.DRUNK, R.VILLAGER], tn: 5 }, true);
  e.start(0);
  // force known deal
  e.s.start = [R.ROBBER, R.WITCH, R.DRUNK]; e.s.cards = e.s.start.slice(); e.s.center0 = [R.WEREWOLF, R.SEER, R.VILLAGER]; e.s.center = e.s.center0.slice();
  e.s.turns = [R.ROBBER, R.WITCH, R.DRUNK];
  let now = 20000; e.tick(now); // reveal -> night
  eq('night', e.s.ph, 'night'); eq('turn robber', e.s.turns[e.s.ti], R.ROBBER);
  eq('too early', e.act(0, e.s.ti, { s: 1 }, now + 100), false);
  now += INTRO_MS; eq('robber acts', e.act(0, e.s.ti, { s: 1 }, now), true);
  eq('robber card', e.s.cards, [R.WITCH, R.ROBBER, R.DRUNK]);
  eq('robber twice', e.act(0, e.s.ti, { s: 2 }, now), false);
  now += 6000; e.tick(now); eq('turn witch', e.s.turns[e.s.ti], R.WITCH);
  now += INTRO_MS; eq('witch peek', e.act(1, e.s.ti, { c: 0 }, now), true);
  eq('witch cannot skip after peek', e.act(1, e.s.ti, { skip: 1 }, now), false);
  eq('witch gives', e.act(1, e.s.ti, { s: 2 }, now), true);
  eq('after witch', [e.s.cards, e.s.center], [[R.WITCH, R.ROBBER, R.WEREWOLF], [R.DRUNK, R.SEER, R.VILLAGER]]);
  now += 6000; e.tick(now); eq('turn drunk', e.s.turns[e.s.ti], R.DRUNK);
  now += 8000; e.tick(now); // drunk idle -> auto swap
  eq('drunk auto', e.s.priv[2].slice(-1)[0].k, 'dr');
  eq('day', e.s.ph, 'day');
  e.skipToVote(now); eq('vote', e.s.ph, 'vote');
  e.vote(0, 2, true); e.vote(1, 2, true); e.vote(2, -1, true); e.tick(now + 10);
  eq('end', e.s.ph, 'end'); eq('dead', e.s.res!.d, [2]);
  console.log('final cards', e.s.res!.fn.map(r => ROLES[r].en), 'win', e.s.res!.w);
}
console.log(fails ? fails + ' FAILURES' : 'ALL OK');
