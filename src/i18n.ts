import { roleName, ROLES } from './roles';
import type { Info, BotMsg, LogEntry } from './engine';

export type Lang = 'en' | 'zh';

type Dict = Record<string, string>;

const en: Dict = {
  appSub: 'One Night Wolf',
  rules: 'Rules', test: 'Test Mode', testOn: 'Test Mode on', sound: 'Sound', soundOff: 'Muted',
  tagline: 'One night. Hidden roles. One vote at dawn.',
  lead: 'Gather 3–10 friends, share a room code, and find the werewolves before the village votes.',
  create: 'Create a room', joinTitle: 'Join with a code', codePh: 'ROOM CODE', join: 'Join',
  badCode: 'Room codes have 5 letters or numbers.',
  modeRoom: 'Online room: anyone you share this page with can join from their own device.',
  modePeer: 'Online room: players connect directly to the host’s device. Share this page’s link and the room code; the host keeps the page open.',
  connectErr: 'Couldn’t open the room. Check your connection and try again.',
  modeLocal: 'This view can’t reach the online room, so rooms only work between tabs in this browser. Test Mode bots still let you play a full game.',
  connecting: 'Opening the room…', nohost: 'No open room with code {c}.', nohostBody: 'Check the code with your host. The host’s page has to stay open for the room to exist.',
  retry: 'Try again', back: 'Back',
  nameTitle: 'What should the village call you?', nameHint: 'Up to 12 characters. Everyone sees this name.', namePh: 'Your name', cont: 'Enter the village',
  lockedTitle: 'This game has started', lockedBody: 'The room locks once the host starts the night. You can join the next round from the lobby.',
  fullTitle: 'The table is full', fullBody: 'A room holds up to 10 players.',
  hostGone: 'The host has left', hostGoneBody: 'The game runs on the host’s device. If they come back with the same tab, play resumes.',
  leave: 'Leave room',
  roomCode: 'Room code', copy: 'Copy', copied: 'Copied', shareHint: 'Friends open this page, choose Join and type the code.',
  players: 'Players', host: 'Host', bot: 'Bot', you: 'You', offline: 'offline',
  waitingHost: 'Waiting for the host to start the night…', joining: 'Taking a seat…',
  addBot: 'Add bot', fillTo: 'Fill to {n}', removeBots: 'Remove bots',
  pool: 'Character pool', poolCount: '{n} cards chosen · {m} needed ({p} players + 3 center)',
  autoBalance: 'Auto-balance', randomize: 'Randomize', pairNote: 'Masons come in pairs',
  timers: 'Timers', nightTurn: 'Night turn', discussion: 'Discussion', voting: 'Voting', sec: 's', min: 'min',
  houseHunter: 'Hunter may shoot during the day (ends the game)',
  start: 'Start the night',
  r_needPlayers: 'Need at least 3 players', r_tooManyPlayers: 'At most 10 players', r_poolSize: 'Choose exactly {m} cards', r_masonPair: 'Masons must be a pair',
  hostOnly: 'Only the host can change these',
  revealTitle: 'Your card', tapFlip: 'Tap the card to look', ready: 'I’ve seen it', readyCount: '{a} of {b} ready', nightIn: 'Night falls in {s}s',
  team_village: 'Village team', team_wolf: 'Werewolf team', team_tanner: 'On their own',
  night: 'Night', turnOf: 'Turn {i} of {n}', closeEyes: 'Close your eyes…', awake: '{role} is awake', yourTurn: 'Your turn',
  nightPasses: 'A quiet night. Nobody wakes.',
  pickPlayer: 'Choose a player on the table', pickCenter: 'Choose a center card', pickTwoPlayers: 'Choose two players', pickTwoCenter: 'Choose two center cards',
  pickGive: 'Now choose who gets this card (you can choose yourself)',
  seerPlayer: 'One player', seerCenter: 'Two center cards',
  confirm: 'Confirm', skip: 'Do nothing', clear: 'Clear', waitingResult: 'Working…',
  learned: 'What you learned tonight', nothing: 'You learned nothing tonight.',
  seat: 'Seat', centerN: 'Center {n}', center: 'Center',
  dawn: 'Dawn', timeLeft: 'Time left', startVote: 'Start the vote now',
  claimDesk: 'Claim a role', claimHint: 'Tap to tell the village who you are. Anyone can claim the same role.', unclaim: 'Withdraw claim',
  announce: 'Player {n} is {name}, {name} claimed to be the {role}!',
  claimedChat: 'claimed to be the {role}',
  centerCards: 'Hidden center cards', onlyYou: 'Only visible to you',
  suspect: 'Suspect role…', addMarker: '+ Marker', notePh: 'Private note…',
  pin_peek: 'Peeked', pin_swap: 'Swapped', pin_wolf: 'Wolf', pin_safe: 'Safe', pin_doubt: 'Doubt', pin_sure: 'Confirmed', pin_tanner: 'Tanner?',
  peaceToggle: 'I think every wolf is in the center', peaceBadge: 'thinks no wolves',
  chat: 'Town chat', chatPh: 'Say something…', send: 'Send', minimize: 'Minimize',
  armory: 'Throw something', egg: 'Egg', tomato: 'Moldy tomato', poo: 'Poo', aimHint: 'Tap a player to throw the {item}', cancel: 'Cancel', wipe: 'Wipe screen',
  vote: 'Vote', voteTitle: 'Point at the werewolf', votePick: 'Choose one player, or vote that no wolf is among you.',
  peace: 'No werewolves among us', peaceDesc: 'Every wolf card is in the center',
  lock: 'Lock my vote', locked: 'Vote locked', lockedCount: '{a} of {b} locked', autoLockNote: 'Your selection locks automatically when time runs out.',
  hunt: 'Hunt', huntAs: 'You started as the Hunter. Shooting ends the game at once.',
  huntTitle: '{name} the Hunter is taking aim!', paused: 'The game is paused until the Hunter decides.',
  huntPick: 'Choose your target', shoot: 'Shoot', cancelHunt: 'Lower the bow', resumeHost: 'Resume the game (host)',
  winVillage: 'The village wins', winWolf: 'The werewolves win', winTanner: 'The Tanner wins', winNobody: 'Nobody wins',
  andTanner: 'and the Tanner',
  how_vote: 'The village voted.', how_peace: 'The village voted that no wolf was among them. Nobody was executed.', how_none: 'Nobody got more than one vote. Nobody was executed.', how_hunt: 'The Hunter fired during the day.',
  minionHouse: 'No wolf was among the players, so the Minion wins with any execution.',
  died: 'executed', shot: 'shot', winner: 'Won', loser: 'Lost',
  startCard: 'Started as', finalCard: 'Ended as', votedFor: 'Voted', peaceShort: 'No wolves', noVote: '—',
  timeline: 'What happened at night', playAgain: 'Play again', backLobby: 'Back to the lobby', waitingAgain: 'Waiting for the host to start another round…',
  order: 'Night order', passive: 'No night action',
  startingRole: 'You started as', reminder: 'Your card',
  tmTitle: 'Enter Test Mode?', tmBody: 'Test Mode lets the host add computer players. Bots take their night turns, claim roles, chat, throw things and vote, so you can try a full game alone.', tmEnter: 'Enter Test Mode', tmExit: 'Leave Test Mode', tmExitBody: 'Bots will be removed from the lobby.',
  close: 'Close',
  rulesTitle: 'How a night works',
  rulesBody1: 'Every player gets one card and three go face-down in the center. At night, roles wake in order and may look at or swap cards. You keep the role you were dealt for your night action, but you win with whatever card is in front of you at dawn.',
  rulesBody2: 'At dawn the village talks, then everyone votes. The player with the most votes (at least two) is executed. Ties kill everyone tied. If nobody gets two votes, nobody dies. Players may also vote “No werewolves among us”; if that option has the most votes, nobody dies.',
  rulesWin: 'Village wins if a werewolf dies, or if no werewolf is among the players and nobody dies. Werewolves win if no werewolf dies. The Tanner wins by dying, and blocks the wolves.',
  rulesHouse: 'House rules here: Mystic Wolf sees the werewolves but they don’t see it. With no wolf among the players, the Minion wins if anyone is executed, even the Minion. The Hunter may shoot during the day, which ends the game at once.',
  bot_hmm: 'Hmm… someone is not telling the truth.', bot_sus: 'I don’t trust {name}.', bot_trust: '{name} seems honest to me.', bot_peace: 'What if every wolf is in the center?', bot_claim: 'I’m the {role}.',
  seatsLabel: 'Player {n}',
  you_short: 'you',
};

const zh: Dict = {
  appSub: 'One Night Wolf',
  rules: '規則', test: '測試模式', testOn: '測試模式中', sound: '音效', soundOff: '靜音',
  tagline: '一個夜晚，隱藏身分，黎明一票定生死。',
  lead: '找 3 到 10 位朋友，分享房間代碼，在村民投票前找出狼人。',
  create: '建立房間', joinTitle: '輸入代碼加入', codePh: '房間代碼', join: '加入',
  badCode: '房間代碼是 5 個英數字。',
  modeRoom: '線上房間：任何你分享此頁面的人，都可以用自己的裝置加入。',
  modePeer: '線上房間：玩家直接連線到房主的裝置。分享此頁面的連結和房間代碼，房主需保持頁面開啟。',
  connectErr: '無法開啟房間，請檢查網路後再試一次。',
  modeLocal: '此畫面無法連線到線上房間，房間只能在同一瀏覽器的分頁之間運作。測試模式的電腦玩家仍可讓你完整試玩。',
  connecting: '正在開啟房間…', nohost: '找不到代碼 {c} 的房間。', nohostBody: '請向房主確認代碼。房主的頁面必須保持開啟，房間才會存在。',
  retry: '再試一次', back: '返回',
  nameTitle: '村民要怎麼稱呼你？', nameHint: '最多 12 個字，所有人都會看到。', namePh: '你的名字', cont: '進入村莊',
  lockedTitle: '遊戲已經開始', lockedBody: '房主開始夜晚後，房間就會鎖定。你可以等下一局在大廳加入。',
  fullTitle: '座位已滿', fullBody: '每個房間最多 10 位玩家。',
  hostGone: '房主已離開', hostGoneBody: '遊戲在房主的裝置上運行。房主用同一個分頁回來後，遊戲會繼續。',
  leave: '離開房間',
  roomCode: '房間代碼', copy: '複製', copied: '已複製', shareHint: '朋友打開此頁面，選「加入」並輸入代碼。',
  players: '玩家', host: '房主', bot: '電腦', you: '你', offline: '離線',
  waitingHost: '等待房主開始夜晚…', joining: '正在入座…',
  addBot: '加入電腦玩家', fillTo: '補滿至 {n} 人', removeBots: '移除電腦玩家',
  pool: '角色牌組', poolCount: '已選 {n} 張 · 需要 {m} 張（{p} 位玩家 + 3 張中央牌）',
  autoBalance: '自動平衡', randomize: '隨機配置', pairNote: '共濟會必須成對',
  timers: '計時', nightTurn: '夜晚每回合', discussion: '討論', voting: '投票', sec: '秒', min: '分鐘',
  houseHunter: '獵人白天可以開槍（遊戲立即結束）',
  start: '開始夜晚',
  r_needPlayers: '至少需要 3 位玩家', r_tooManyPlayers: '最多 10 位玩家', r_poolSize: '請剛好選 {m} 張牌', r_masonPair: '共濟會必須成對',
  hostOnly: '只有房主可以更改',
  revealTitle: '你的卡牌', tapFlip: '點擊卡牌查看', ready: '我看好了', readyCount: '{a} / {b} 人準備好', nightIn: '{s} 秒後入夜',
  team_village: '村民陣營', team_wolf: '狼人陣營', team_tanner: '自成一隊',
  night: '夜晚', turnOf: '第 {i} / {n} 回合', closeEyes: '請閉上眼睛…', awake: '{role}正在行動', yourTurn: '輪到你了',
  nightPasses: '平靜的一夜，沒有人醒來。',
  pickPlayer: '選擇桌上的一位玩家', pickCenter: '選擇一張中央牌', pickTwoPlayers: '選擇兩位玩家', pickTwoCenter: '選擇兩張中央牌',
  pickGive: '選擇要把這張牌交給誰（可以是你自己）',
  seerPlayer: '一位玩家', seerCenter: '兩張中央牌',
  confirm: '確認', skip: '不行動', clear: '清除', waitingResult: '處理中…',
  learned: '你今晚得知的資訊', nothing: '你今晚沒有得到任何資訊。',
  seat: '座位', centerN: '中央 {n}', center: '中央',
  dawn: '天亮了', timeLeft: '剩餘時間', startVote: '立即開始投票',
  claimDesk: '宣稱身分', claimHint: '點擊告訴大家你是誰。多人可以宣稱同一個角色。', unclaim: '撤回宣稱',
  announce: '玩家 {n} 是 {name}，{name} 宣稱自己是{role}！',
  claimedChat: '宣稱自己是{role}',
  centerCards: '中央暗牌', onlyYou: '僅自己可見',
  suspect: '推測角色…', addMarker: '＋標記', notePh: '私人筆記…',
  pin_peek: '已查看', pin_swap: '已調換', pin_wolf: '狼牌', pin_safe: '好人牌', pin_doubt: '存疑', pin_sure: '確認', pin_tanner: '皮匠？',
  peaceToggle: '我認為所有狼都在中央', peaceBadge: '認為沒有狼',
  chat: '村莊聊天', chatPh: '說點什麼…', send: '送出', minimize: '收起',
  armory: '丟東西', egg: '雞蛋', tomato: '爛番茄', poo: '便便', aimHint: '點擊一位玩家丟出{item}', cancel: '取消', wipe: '擦乾淨',
  vote: '投票', voteTitle: '指出狼人', votePick: '選擇一位玩家，或投票認為沒有狼人在玩家之中。',
  peace: '沒有狼人在我們之中', peaceDesc: '所有狼牌都在中央',
  lock: '鎖定我的票', locked: '已鎖定', lockedCount: '{a} / {b} 人已鎖定', autoLockNote: '時間到時，你目前的選擇會自動鎖定。',
  hunt: '狩獵', huntAs: '你的起始身分是獵人。開槍後遊戲立即結束。',
  huntTitle: '獵人 {name} 正在瞄準！', paused: '遊戲暫停，等待獵人做出決定。',
  huntPick: '選擇你的目標', shoot: '開槍', cancelHunt: '放下弓箭', resumeHost: '繼續遊戲（房主）',
  winVillage: '村民陣營獲勝', winWolf: '狼人陣營獲勝', winTanner: '皮匠獲勝', winNobody: '沒有人獲勝',
  andTanner: '皮匠也獲勝',
  how_vote: '村民完成投票。', how_peace: '村民投票認為沒有狼人在玩家之中，沒有人被處決。', how_none: '沒有人得到兩票以上，沒有人被處決。', how_hunt: '獵人在白天開槍了。',
  minionHouse: '玩家之中沒有狼，因此只要有人被處決，爪牙就獲勝。',
  died: '被處決', shot: '被射殺', winner: '勝', loser: '敗',
  startCard: '起始', finalCard: '最終', votedFor: '投給', peaceShort: '沒有狼', noVote: '—',
  timeline: '夜裡發生的事', playAgain: '再玩一局', backLobby: '回到大廳', waitingAgain: '等待房主開始下一局…',
  order: '夜晚順序', passive: '夜晚不行動',
  startingRole: '你的起始身分', reminder: '你的卡牌',
  tmTitle: '進入測試模式？', tmBody: '測試模式讓房主加入電腦玩家。電腦會在夜晚行動、宣稱身分、聊天、丟東西和投票，讓你一個人也能完整試玩。', tmEnter: '進入測試模式', tmExit: '離開測試模式', tmExitBody: '電腦玩家會從大廳移除。',
  close: '關閉',
  rulesTitle: '一夜怎麼玩',
  rulesBody1: '每位玩家拿一張牌，另外三張背面朝上放在中央。夜晚各角色依序醒來，查看或交換卡牌。夜晚行動依照你被發到的身分，但勝負看黎明時你面前那張牌。',
  rulesBody2: '天亮後大家討論，然後投票。得票最多（至少兩票）的玩家被處決；平手則平手的人都被處決；沒有人得到兩票就沒有人死亡。也可以投「沒有狼人在我們之中」，若此選項票數最多，沒有人死亡。',
  rulesWin: '有狼人死亡，或玩家中沒有狼人且無人死亡時，村民陣營獲勝。沒有狼人死亡時，狼人陣營獲勝。皮匠死亡即獲勝，並讓狼人無法獲勝。',
  rulesHouse: '本房規則：神秘狼看得到狼人，狼人看不到神秘狼。玩家中沒有狼時，只要有人被處決（包括爪牙自己），爪牙就獲勝。獵人白天可以開槍，遊戲立即結束。',
  bot_hmm: '嗯……有人沒說實話。', bot_sus: '我不相信 {name}。', bot_trust: '{name} 看起來很誠實。', bot_peace: '會不會所有狼都在中央？', bot_claim: '我是{role}。',
  seatsLabel: '玩家 {n}',
  you_short: '你',
};

export const DICTS: Record<Lang, Dict> = { en, zh };

export function tr(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

type NameOf = (seat: number) => string;

const centerLabel = (lang: Lang, c: number) => tr(lang, 'centerN', { n: c + 1 });
const list = (lang: Lang, xs: string[]) => xs.join(lang === 'zh' ? '、' : ', ');

/** Private info, second person ("you"). */
export function describeInfo(i: Info, lang: Lang, nm: NameOf): string {
  const R = (r: number) => roleName(r, lang);
  const zh = lang === 'zh';
  switch (i.k) {
    case 'team': {
      const names = i.s.map(nm);
      if (i.t === 0) return zh ? `你的狼同伴：${list(lang, names)}` : `Your fellow werewolves: ${list(lang, names)}`;
      if (i.t === 1) return names.length ? (zh ? `狼人是：${list(lang, names)}` : `The werewolves are ${list(lang, names)}`) : (zh ? '玩家中沒有狼人。' : 'No werewolf among the players.');
      if (i.t === 2) return names.length ? (zh ? `狼是：${list(lang, names)}` : `The wolves are ${list(lang, names)}`) : (zh ? '玩家中沒有狼！' : 'No wolf among the players!');
      if (i.t === 3) return names.length ? (zh ? `另一位共濟會：${list(lang, names)}` : `Your fellow Mason: ${list(lang, names)}`) : (zh ? '另一張共濟會在中央。' : 'The other Mason is in the center.');
      return list(lang, names);
    }
    case 'lone': return zh ? '你是唯一的狼人，可以查看一張中央牌。' : 'You are the only werewolf. You may look at a center card.';
    case 'pc': return i.c.map((c, k) => (zh ? `${centerLabel(lang, c)} 是${R(i.r[k])}` : `${centerLabel(lang, c)} is the ${R(i.r[k])}`)).join(zh ? '；' : '; ');
    case 'pp': return zh ? `${nm(i.s)} 的卡牌是${R(i.r)}` : `${nm(i.s)}’s card is the ${R(i.r)}`;
    case 'rob': return zh ? `你搶了 ${nm(i.s)} 的牌，現在你是${R(i.r)}` : `You robbed ${nm(i.s)}. You are now the ${R(i.r)}.`;
    case 'sw': return zh ? `你交換了 ${nm(i.a)} 和 ${nm(i.b)} 的卡牌` : `You swapped ${nm(i.a)} and ${nm(i.b)}.`;
    case 'ws': return zh ? `你把${centerLabel(lang, i.c)} 交給了 ${nm(i.s)}${i.auto ? '（時間到自動執行）' : ''}` : `You gave ${centerLabel(lang, i.c)} to ${nm(i.s)}${i.auto ? ' (time ran out)' : ''}.`;
    case 'dr': return zh ? `你與${centerLabel(lang, i.c)} 交換了卡牌${i.auto ? '（時間到自動執行）' : ''}` : `You swapped with ${centerLabel(lang, i.c)}${i.auto ? ' (time ran out)' : ''}.`;
    case 'me': return zh ? `你現在的卡牌是${R(i.r)}` : `Your card is now the ${R(i.r)}.`;
    case 'skip': return zh ? '你選擇不行動。' : 'You chose to do nothing.';
  }
}

/** A bot's claim, first person ("I"). */
function describeClaim(i: Info, lang: Lang, nm: NameOf): string {
  const R = (r: number) => roleName(r, lang); const zh = lang === 'zh';
  switch (i.k) {
    case 'pc': return i.c.map((c, k) => (zh ? `我看到${centerLabel(lang, c)} 是${R(i.r[k])}` : `I saw ${centerLabel(lang, c)} is the ${R(i.r[k])}`)).join(zh ? '，' : ' and ') + (zh ? '。' : '.');
    case 'pp': return zh ? `我看了 ${nm(i.s)}，是${R(i.r)}。` : `I looked at ${nm(i.s)}: ${R(i.r)}.`;
    case 'rob': return zh ? `我搶了 ${nm(i.s)}，現在是${R(i.r)}。` : `I robbed ${nm(i.s)} and became the ${R(i.r)}.`;
    case 'sw': return zh ? `我交換了 ${nm(i.a)} 和 ${nm(i.b)}。` : `I swapped ${nm(i.a)} and ${nm(i.b)}.`;
    case 'ws': return zh ? `我把${centerLabel(lang, i.c)} 給了 ${nm(i.s)}。` : `I gave ${centerLabel(lang, i.c)} to ${nm(i.s)}.`;
    case 'dr': return zh ? `我和${centerLabel(lang, i.c)} 換了牌。` : `I swapped with ${centerLabel(lang, i.c)}.`;
    case 'me': return zh ? `我最後看到自己是${R(i.r)}。` : `At the end I was the ${R(i.r)}.`;
    default: return '';
  }
}

export function describeBot(m: BotMsg, lang: Lang, nm: NameOf): string {
  switch (m.k) {
    case 'claim': return tr(lang, 'bot_claim', { role: roleName(m.r, lang) }) + (m.i ? ' ' + describeClaim(m.i, lang, nm) : '');
    case 'sus': return tr(lang, 'bot_sus', { name: nm(m.s) });
    case 'trust': return tr(lang, 'bot_trust', { name: nm(m.s) });
    case 'peace': return tr(lang, 'bot_peace');
    default: return tr(lang, 'bot_hmm');
  }
}

/** Game-over timeline, third person. */
export function describeLog(e: LogEntry, lang: Lang, nm: NameOf): string {
  const R = (r: number) => roleName(r, lang); const zh = lang === 'zh';
  const who = `${nm(e.by)}（${R(e.t)}）`;
  const whoEn = `${nm(e.by)} (${R(e.t)})`;
  switch (e.k) {
    case 'team': {
      const names = list(lang, e.s.map(nm));
      if (e.t === 3) return zh ? `${who} 看到共濟會同伴：${names || '在中央'}` : `${whoEn} saw fellow Mason: ${names || 'in the center'}`;
      return zh ? `${who} 看到狼人：${names || '無'}` : `${whoEn} saw the werewolves: ${names || 'none'}`;
    }
    case 'lone': return zh ? `${who} 是獨狼` : `${whoEn} was a lone wolf`;
    case 'pc': return zh ? `${who} 查看了 ${e.c.map((c, k) => `${centerLabel(lang, c)}（${R(e.r[k])}）`).join('、')}` : `${whoEn} looked at ${e.c.map((c, k) => `${centerLabel(lang, c)} (${R(e.r[k])})`).join(' and ')}`;
    case 'pp': return zh ? `${who} 查看了 ${nm(e.s)}（${R(e.r)}）` : `${whoEn} looked at ${nm(e.s)} (${R(e.r)})`;
    case 'rob': return zh ? `${who} 搶了 ${nm(e.s)}，成為${R(e.r)}` : `${whoEn} robbed ${nm(e.s)} and became the ${R(e.r)}`;
    case 'sw': return zh ? `${who} 交換了 ${nm(e.a)} 和 ${nm(e.b)}` : `${whoEn} swapped ${nm(e.a)} and ${nm(e.b)}`;
    case 'ws': return zh ? `${who} 把${centerLabel(lang, e.c)} 交給 ${nm(e.s)}` : `${whoEn} gave ${centerLabel(lang, e.c)} to ${nm(e.s)}`;
    case 'dr': return zh ? `${who} 與${centerLabel(lang, e.c)} 交換` : `${whoEn} swapped with ${centerLabel(lang, e.c)}`;
    case 'me': return zh ? `${who} 看到自己是${R(e.r)}` : `${whoEn} saw they were the ${R(e.r)}`;
    case 'skip': return zh ? `${who} 沒有行動` : `${whoEn} did nothing`;
  }
}

export const teamKey = (r: number) => 'team_' + ROLES[r].team;
