// Single source of truth for every role: names (EN / 繁中), team, night order,
// card limits, instructions and art. Role codes are the array index.
import { ART } from './art';

export type Team = 'wolf' | 'village' | 'tanner';

export interface RoleDef {
  id: string;
  zh: string;
  en: string;
  team: Team;
  night: boolean;      // wakes up at night (order = index)
  max: number;         // max copies in a pool
  pair?: boolean;      // Mason: 0 or 2 copies
  art: string;
  alt?: string;        // alternate pose
  act: { en: string; zh: string };   // what the narrator says at night
  desc: { en: string; zh: string };  // ability summary
}

export const R = {
  WEREWOLF: 0, MYSTIC: 1, MINION: 2, MASON: 3, SEER: 4, APPRENTICE: 5, ROBBER: 6,
  WITCH: 7, TROUBLEMAKER: 8, GREMLIN: 9, DRUNK: 10, INSOMNIAC: 11, HUNTER: 12,
  TANNER: 13, VILLAGER: 14, ALPHA: 15, RAVEN: 16,
} as const;

/** Night wake-up order. The Alpha Wolf also wakes with the werewolves (in the Werewolf turn). */
export const NIGHT_ORDER: number[] = [0, 15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16];
/** Order roles are listed in the lobby and rules: wolves first. */
export const POOL_ORDER: number[] = [0, 15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 12, 13, 14];

export const ROLES: RoleDef[] = [
  {
    id: 'werewolf', zh: '狼人', en: 'Werewolf', team: 'wolf', night: true, max: 3, art: ART.werewolf,
    act: {
      en: 'Werewolves, wake up and find each other. A lone werewolf may look at one center card.',
      zh: '狼人請睜眼，確認你的狼同伴。若你是唯一的狼人，可以查看一張中央牌。',
    },
    desc: {
      en: 'Werewolf team. Sees the other werewolves at night. A lone werewolf may look at one center card.',
      zh: '狼人陣營。夜晚與其他狼人互認；獨狼可查看一張中央牌。',
    },
  },
  {
    id: 'mysticwolf', zh: '神秘狼', en: 'Mystic Wolf', team: 'wolf', night: true, max: 1, art: ART.mysticwolf,
    act: {
      en: 'Mystic Wolf, wake up. You see the werewolves (they cannot see you). You may look at another player’s card.',
      zh: '神秘狼請睜眼。你會看到所有狼人（他們看不到你），並可查看另一位玩家的卡牌。',
    },
    desc: {
      en: 'Werewolf team. Knows who the werewolves are, but they don’t know you. May look at one other player’s card.',
      zh: '狼人陣營。知道誰是狼人，狼人卻不知道你；可查看另一位玩家的卡牌。',
    },
  },
  {
    id: 'minion', zh: '爪牙', en: 'Minion', team: 'wolf', night: true, max: 1, art: ART.minion,
    act: {
      en: 'Minion, wake up and see who the wolves are. They will not know you.',
      zh: '爪牙請睜眼，看看誰是狼人。狼人不會知道你是誰。',
    },
    desc: {
      en: 'Werewolf team. Sees the wolves. If no wolf is among the players, the Minion wins when anyone is executed, even the Minion.',
      zh: '狼人陣營。知道誰是狼人。若場上沒有狼人，只要有人被處決（包括你自己），你就獲勝。',
    },
  },
  {
    id: 'mason', zh: '共濟會', en: 'Mason', team: 'village', night: true, max: 2, pair: true, art: ART.mason,
    act: { en: 'Masons, wake up and find each other.', zh: '共濟會請睜眼，互相確認身分。' },
    desc: {
      en: 'Village team. Always two in the pool. Masons see each other at night.',
      zh: '村民陣營。一定成對加入。夜晚與另一位共濟會互認。',
    },
  },
  {
    id: 'seer', zh: '預言家', en: 'Seer', team: 'village', night: true, max: 1, art: ART.seer, alt: ART.seer2,
    act: {
      en: 'Seer, wake up. Look at one other player’s card, or two center cards.',
      zh: '預言家請睜眼。你可以查看一位玩家的卡牌，或查看兩張中央牌。',
    },
    desc: {
      en: 'Village team. Looks at one other player’s card, or two center cards.',
      zh: '村民陣營。查看一位玩家的卡牌，或兩張中央牌。',
    },
  },
  {
    id: 'apprenticeseer', zh: '見習預言家', en: 'Apprentice Seer', team: 'village', night: true, max: 1, art: ART.apprenticeseer,
    act: { en: 'Apprentice Seer, wake up. You may look at one center card.', zh: '見習預言家請睜眼，你可以查看一張中央牌。' },
    desc: { en: 'Village team. Looks at one center card.', zh: '村民陣營。查看一張中央牌。' },
  },
  {
    id: 'robber', zh: '強盜', en: 'Robber', team: 'village', night: true, max: 1, art: ART.robber,
    act: {
      en: 'Robber, wake up. You may swap your card with another player’s card, then look at your new card.',
      zh: '強盜請睜眼。你可以與另一位玩家交換卡牌，並查看你的新卡牌。',
    },
    desc: {
      en: 'Swaps cards with another player and looks at the new card. You end on the team of your new card.',
      zh: '與一位玩家交換卡牌並查看新卡牌。你最終屬於新卡牌的陣營。',
    },
  },
  {
    id: 'witch', zh: '女巫', en: 'Witch', team: 'village', night: true, max: 1, art: ART.witch,
    act: {
      en: 'Witch, wake up. You may look at one center card. If you do, you must swap it with any player’s card, even your own.',
      zh: '女巫請睜眼。你可以查看一張中央牌；若查看了，必須把它與任一玩家（可以是你自己）的卡牌交換。',
    },
    desc: {
      en: 'Village team. Looks at a center card, then must give it to any player (yourself included).',
      zh: '村民陣營。查看一張中央牌，並必須把它與任一玩家交換（可以是自己）。',
    },
  },
  {
    id: 'troublemaker', zh: '搗蛋鬼', en: 'Troublemaker', team: 'village', night: true, max: 1, art: ART.troublemaker,
    act: {
      en: 'Troublemaker, wake up. You may swap the cards of two other players without looking.',
      zh: '搗蛋鬼請睜眼。你可以交換另外兩位玩家的卡牌（不能查看）。',
    },
    desc: { en: 'Village team. Swaps the cards of two other players.', zh: '村民陣營。交換另外兩位玩家的卡牌。' },
  },
  {
    id: 'gremlin', zh: '小魔怪', en: 'Gremlin', team: 'village', night: true, max: 1, art: ART.gremlin,
    act: {
      en: 'Gremlin, wake up. You may swap the cards of any two players, yourself included, without looking.',
      zh: '小魔怪請睜眼。你可以交換任意兩位玩家的卡牌（可包括你自己，不能查看）。',
    },
    desc: { en: 'Village team. Swaps any two players’ cards, yourself included.', zh: '村民陣營。交換任意兩位玩家的卡牌，可包括自己。' },
  },
  {
    id: 'drunk', zh: '酒鬼', en: 'Drunk', team: 'village', night: true, max: 1, art: ART.drunk,
    act: {
      en: 'Drunk, wake up. Swap your card with a center card. You do not get to look at it.',
      zh: '酒鬼請睜眼。把你的卡牌與一張中央牌交換，不能查看新卡牌。',
    },
    desc: { en: 'Must swap with a center card without looking. You no longer know who you are.', zh: '必須與一張中央牌交換卡牌，且不知道自己的新身分。' },
  },
  {
    id: 'insomniac', zh: '失眠者', en: 'Insomniac', team: 'village', night: true, max: 1, art: ART.insomniac,
    act: { en: 'Insomniac, wake up and look at your own card.', zh: '失眠者請睜眼，查看你自己現在的卡牌。' },
    desc: { en: 'Village team. Looks at their own card at the end of the night.', zh: '村民陣營。夜晚最後查看自己現在的卡牌。' },
  },
  {
    id: 'hunter', zh: '獵人', en: 'Hunter', team: 'village', night: false, max: 1, art: ART.hunter,
    act: { en: '', zh: '' },
    desc: {
      en: 'Village team. If you are executed, the player you voted for dies too. House rule: may shoot during the day, which ends the game at once.',
      zh: '村民陣營。若你被處決，你投票的對象也會死亡。房規：白天可隨時開槍，遊戲立即結束。',
    },
  },
  {
    id: 'tanner', zh: '皮匠', en: 'Tanner', team: 'tanner', night: false, max: 1, art: ART.tanner,
    act: { en: '', zh: '' },
    desc: {
      en: 'Own team. Wins only if executed. If the Tanner dies, the werewolves cannot win.',
      zh: '自成一隊。被處決才算獲勝；皮匠死亡時狼人無法獲勝。',
    },
  },
  {
    id: 'villager', zh: '村民', en: 'Villager', team: 'village', night: false, max: 3, art: ART.villager,
    act: { en: '', zh: '' },
    desc: { en: 'Village team. No ability. Find the wolves by talking.', zh: '村民陣營。沒有特殊能力，靠推理找出狼人。' },
  },
  {
    id: 'alphawolf', zh: '頭狼', en: 'Alpha Wolf', team: 'wolf', night: true, max: 1, art: ART.alphawolf,
    act: {
      en: 'Alpha Wolf, wake up. Swap the center Werewolf card with the card of any player who is not a werewolf. You don\u2019t look at it.',
      zh: '頭狼請睜眼。把中央的狼人牌與任一位非狼人玩家的卡牌交換，不能查看。',
    },
    desc: {
      en: 'Werewolf team. Wakes with the werewolves, then turns a non-werewolf player into a Werewolf by swapping in the extra center Werewolf card.',
      zh: '狼人陣營。與狼人一起睜眼，之後用中央額外的狼人牌，把一位非狼人玩家變成狼人。',
    },
  },
  {
    id: 'ravenwatch', zh: '守夜鴉', en: 'Night Raven', team: 'village', night: true, max: 1, art: ART.ravenwatch,
    act: {
      en: 'Night Raven, wake up and count the wolves among the village.',
      zh: '守夜鴉請睜眼，數一數村裡還有幾隻狼。',
    },
    desc: {
      en: 'Village team. Wakes last and learns how many wolf cards are in front of players right now (center cards don\u2019t count), but not who holds them.',
      zh: '村民陣營。夜晚最後醒來，得知此刻玩家面前共有幾張狼牌（不包括中央牌），但不知道是誰。',
    },
  },
];

export const N_ROLES = ROLES.length;
export const isWolfCard = (r: number) => r === R.WEREWOLF || r === R.MYSTIC || r === R.ALPHA;
export const teamOfCard = (r: number): Team => ROLES[r].team;
export const roleName = (r: number, lang: 'en' | 'zh') => (r >= 0 && r < N_ROLES ? ROLES[r][lang] : '?');

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;

/** Night turns for a pool: each distinct night role, in canonical order. */
export function nightTurns(pool: number[]): number[] {
  const out: number[] = [];
  for (const r of NIGHT_ORDER) {
    const inPool = pool.includes(r) || (r === R.WEREWOLF && pool.includes(R.ALPHA));
    if (ROLES[r].night && inPool) out.push(r);
  }
  return out;
}

export function countPool(pool: number[]): number[] {
  const c = new Array(N_ROLES).fill(0);
  for (const r of pool) if (r >= 0 && r < N_ROLES) c[r]++;
  return c;
}

export function poolFromCounts(counts: number[]): number[] {
  const out: number[] = [];
  counts.forEach((n, r) => { for (let i = 0; i < n; i++) out.push(r); });
  return out;
}

/** Fixed priority list; deterministic and loop-bounded. */
const BALANCE_ORDER = [
  R.WEREWOLF, R.WEREWOLF, R.SEER, R.ROBBER, R.TROUBLEMAKER, R.VILLAGER, R.INSOMNIAC, R.TANNER,
  R.HUNTER, R.MINION, R.DRUNK, R.MASON, R.MASON, R.VILLAGER, R.WITCH, R.MYSTIC, R.APPRENTICE,
  R.GREMLIN, R.VILLAGER, R.WEREWOLF,
];

export function autoBalance(players: number): number[] {
  const need = players + 3;
  const counts = new Array(N_ROLES).fill(0);
  let total = 0;
  for (let i = 0; i < BALANCE_ORDER.length && total < need; i++) {
    const r = BALANCE_ORDER[i];
    if (ROLES[r].pair) {
      if (counts[r] > 0) continue;               // second Mason added with the first
      if (need - total < 2) continue;            // no room for a pair
      counts[r] = 2; total += 2; continue;
    }
    if (counts[r] >= ROLES[r].max) continue;
    counts[r]++; total++;
  }
  return poolFromCounts(counts);
}

/** Random but sensible pool: always one or two wolves, Masons in pairs. Bounded passes. */
export function randomPool(players: number, rnd: () => number = Math.random): number[] {
  const need = players + 3;
  const counts = new Array(N_ROLES).fill(0);
  counts[R.WEREWOLF] = players >= 5 ? 2 : 1 + (rnd() < 0.5 ? 1 : 0);
  const special = rnd();
  if (special < 0.3) { counts[R.WEREWOLF]--; counts[R.MYSTIC] = 1; if (counts[R.WEREWOLF] === 0) counts[R.WEREWOLF] = 1; }
  else if (special < 0.5) { counts[R.WEREWOLF]--; counts[R.ALPHA] = 1; if (counts[R.WEREWOLF] === 0) counts[R.WEREWOLF] = 1; }
  let total = counts.reduce((a, b) => a + b, 0);
  const candidates = [R.MINION, R.MASON, R.SEER, R.APPRENTICE, R.ROBBER, R.WITCH, R.TROUBLEMAKER, R.GREMLIN, R.DRUNK, R.INSOMNIAC, R.HUNTER, R.TANNER];
  // shuffle candidates (Fisher–Yates, bounded)
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  // make sure Seer is usually present
  if (rnd() < 0.8) { const k = candidates.indexOf(R.SEER); candidates.splice(k, 1); candidates.unshift(R.SEER); }
  for (const r of candidates) {
    if (total >= need) break;
    if (ROLES[r].pair) { if (need - total >= 2) { counts[r] = 2; total += 2; } continue; }
    counts[r] = 1; total++;
  }
  while (total < need && counts[R.VILLAGER] < ROLES[R.VILLAGER].max) { counts[R.VILLAGER]++; total++; }
  // still short (very large tables): add extra werewolf
  if (total < need && counts[R.WEREWOLF] < ROLES[R.WEREWOLF].max) { counts[R.WEREWOLF]++; total++; }
  return poolFromCounts(counts);
}

/** Validation message key or null when the pool can start. */
export function poolProblem(pool: number[], players: number): string | null {
  if (players < MIN_PLAYERS) return 'needPlayers';
  if (players > MAX_PLAYERS) return 'tooManyPlayers';
  const c = countPool(pool);
  if (pool.length !== players + 3) return 'poolSize';
  if (c[R.MASON] === 1) return 'masonPair';
  for (let r = 0; r < N_ROLES; r++) if (c[r] > ROLES[r].max) return 'poolSize';
  return null;
}
