# 一夜狼人殺 · One Night Wolf

A one-night werewolf party game for 3–10 players that runs in the browser on phones and PCs. The host creates a room, everyone joins with a 5-character code, the night plays out turn by turn, then the village talks and votes once at dawn.

一款在瀏覽器上玩的一夜狼人殺，支援 3–10 位玩家，手機和電腦都能玩。房主建立房間，大家輸入 5 碼房間代碼加入，夜晚依序行動，天亮後討論並投票一次。

**Play:** https://mkhwong.github.io/one-night-wolf/

## How to play · 玩法

1. **Create a room** and share the code. Friends open the same link, choose **Join** and type the code. Everyone enters a name.
2. The host picks the **character pool** (players + 3 center cards). Auto-balance and Randomize help. The room locks once the night starts.
3. Everyone looks at their card. At night each role wakes in order and acts on the round table (look at or swap cards). Wolves, Masons and the Minion see arrows to their teammates.
4. At dawn, talk it out: claim a role, keep private notes and markers on players and the 3 hidden center cards, chat, and throw eggs, moldy tomatoes or poo at each other.
5. Vote for a player, or vote **No werewolves among us**. Results show every card, the votes and a timeline of the night.

**Test Mode** (top right) lets the host add bots that take night turns, claim, chat, throw and vote, so you can try a full game alone.

1. **建立房間**並分享代碼。朋友打開同一個連結，選**加入**並輸入代碼，然後輸入名字。
2. 房主選擇**角色牌組**（玩家人數 + 3 張中央牌），可用「自動平衡」或「隨機配置」。夜晚開始後房間鎖定。
3. 每人查看自己的卡牌。夜晚各角色依序醒來，在圓桌上查看或交換卡牌。狼人、共濟會和爪牙會看到指向隊友的箭頭。
4. 天亮後討論：宣稱身分、在玩家和三張中央暗牌上做私人筆記與標記、聊天，還可以互丟雞蛋、爛番茄和便便。
5. 投票給一位玩家，或投「沒有狼人在我們之中」。結果會顯示所有卡牌、投票和夜晚時間線。

右上角的**測試模式**可以加入電腦玩家，一個人也能完整試玩。

## Roles · 角色

狼人 Werewolf · 神秘狼 Mystic Wolf · 爪牙 Minion · 共濟會 Mason · 預言家 Seer · 見習預言家 Apprentice Seer · 強盜 Robber · 女巫 Witch · 搗蛋鬼 Troublemaker · 小魔怪 Gremlin · 酒鬼 Drunk · 失眠者 Insomniac · 獵人 Hunter · 皮匠 Tanner · 村民 Villager

House rules in this version:

- The Mystic Wolf sees the werewolves, but they don't see it.
- With no wolf among the players, the Minion wins if anyone is executed, the Minion included.
- The Hunter may shoot during the day (optional, on by default). The game pauses for everyone, and the shot ends the game.
- If the "No werewolves among us" option gets the most votes, nobody dies.

## How online play works

The game runs on the **host's device**. Other players connect to it directly over WebRTC using the free [PeerJS](https://peerjs.com) signalling service, so there is no game server to run. Each player's card and night results are encrypted between the host and that player (ECDH + AES-GCM), so they don't travel in readable form.

- The host must keep the page open. If the host reloads, the room comes back under the same code and players reconnect.
- Most home and mobile networks work. Some strict company or school networks block peer-to-peer connections.
- Opened inside Claude, the same page uses Claude's built-in room instead of PeerJS.

## Development

```bash
npm install
npm run build       # writes index.html (GitHub Pages) and dist/ (Claude artifact + local test pages)
npm test            # rules: deaths, Hunter chains, win conditions, 3000 bot games
npm run typecheck
```

Browser tests use Python Playwright. Start `npm run serve` (and `npm run peer-server` for the peer-to-peer test), then run e.g. `python3 test/peer.py` or `python3 test/mreview.py 390 844`.

| Path | What it is |
| --- | --- |
| `src/engine.ts` | Host-authoritative rules: dealing, night order and actions, voting, Hunter, win conditions, bots |
| `src/game.ts` | Session: room codes, host loop, encrypted private channel, claims, chat, throws |
| `src/net.ts` | Transports (Claude room, PeerJS, same-browser tabs) and crypto |
| `src/roles.ts` | Every role's names (EN / 繁中), team, night order, limits and text |
| `src/ui/` | React screens: lobby, reveal, night table, discussion, vote, results |
| `art/` | Role clipart sheets and transparent cutouts; `tools/cutout.py` and `tools/encode_art.py` rebuild `src/art.ts` |

React 18 and PeerJS load from pinned CDN builds; everything else, including the art, is inside `index.html`.
