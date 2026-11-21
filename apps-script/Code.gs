/**
 * 一夜狼人殺 One Night Wolf — account records, login history and owner dashboard.
 *
 * Lives inside the Google Sheet 「一夜狼人殺 帳戶紀錄」 in the owner's Google Drive
 * (Extensions → Apps Script). Deployed as a web app: Execute as = Me, Who has access = Anyone.
 * The game page sends small JSON messages here; everything is written into this spreadsheet.
 *
 * Tabs (created automatically):
 *   帳戶      one row per Google account: nickname, wins/losses, last login …
 *   登入紀錄  every Google sign-in, returning visit and guest visit
 *   對局      one row per finished game (reported by the room's host)
 *   戰績      one row per signed-in player per game (their own result)
 *   房間      rooms that are open now / recently (heartbeat from the host)
 *
 * Only the owner (the Google account that owns this script, plus OWNER_EMAILS) can read
 * the dashboard; everyone else can only add their own records.
 */

// ⬇️ Paste your OAuth "Web application" client ID here (the same one Moonlit Werewolf uses is fine,
//    after adding https://one-night-wolf-w1e3.onrender.com to its Authorized JavaScript origins).
const CLIENT_ID = 'PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com';
// Extra Google login emails allowed to open the owner dashboard (the script owner is always allowed).
const OWNER_EMAILS = [];
const TZ = 'Europe/London';
const SESSION_DAYS = 60;
const VISIT_GAP_S = 30 * 60;      // a returning visit is logged at most once per 30 minutes per player
const LIVE_MS = 3 * 60 * 1000;    // a room is "live" if its host reported within 3 minutes

const TABS = {
  acct: { name: '帳戶', head: ['Google ID', 'Email', '暱稱', '勝', '負', '總局數', '勝率', '最後遊戲', '最後登入', '建立日期', '登入次數', 'Google 名稱'], text: [1] },
  log: { name: '登入紀錄', head: ['時間', '方式', '暱稱', 'Email', '帳戶／訪客 ID', '裝置', '語言'], text: [5] },
  game: { name: '對局', head: ['時間', '對局 ID', '房間', '玩家數', '電腦玩家', '勝方', '結局', '時長 (秒)', '房主', '玩家明細'], text: [2, 3] },
  res: { name: '戰績', head: ['時間', '對局 ID', 'Google ID', '暱稱', '結果', '計入勝負', '索引'], text: [2, 3, 7] },
  room: { name: '房間', head: ['房間', '房主', '玩家', '電腦玩家', '階段', '局數', '開房時間', '最後更新', '狀態'], text: [1] },
};

// ------------------------------------------------------------------ entry points
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.a) return ContentService.createTextOutput('一夜狼人殺 records service is running.');
  return out_(handle_(p));
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  return out_(handle_(p));
}

/** Run once from the editor (▶ Run → setup) to create the tabs and grant permissions. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(TABS).forEach(k => tab_(k));
  secret_();
  Logger.log('Ready. Owner: ' + ownerEmail_());
}

function handle_(p) {
  try {
    switch (p.a) {
      case 'config': return config_(p);
      case 'unlock': return unlock_(p);
      case 'setgate': return setGate_(p);
      case 'login': return login_(p);
      case 'visit': return visit_(p);
      case 'me': return me_(p);
      case 'rename': return rename_(p);
      case 'room': return room_(p);
      case 'game': return game_(p);
      case 'result': return result_(p);
      case 'dashboard': return dashboard_(p);
      default: return { ok: false, error: 'unknown action' };
    }
  } catch (err) {
    console.error(err);
    return { ok: false, error: String(err && err.message || err) };
  }
}

// ------------------------------------------------------------------ entry password (訪問密碼)
// The owner saves a password and switches the requirement on or off from the dashboard.
// Turning it off keeps the password, so it can be switched back on later.
// Changing the password signs everyone out of the gate.
function storedPassword_() { return PropertiesService.getScriptProperties().getProperty('GATE_PASSWORD') || ''; }
function gateOn_() { return PropertiesService.getScriptProperties().getProperty('GATE_ON') === '1' && !!storedPassword_(); }
function gatePassword_() { return gateOn_() ? storedPassword_() : ''; }   // the password in force ('' = none)
function gateVer_(pw) { return b64_(Utilities.computeHmacSha256Signature('gate:' + pw, secret_())).slice(0, 16); }
function gateOk_(p) {
  const pw = gatePassword_();
  if (!pw) return true;
  const s = verify_(p.token);
  if (s && isOwner_(s.email)) return true;           // the owner never needs the password
  const g = verify_(p.gate);
  return !!(g && g.gv === gateVer_(pw));
}

function config_(p) {
  return { ok: true, clientId: CLIENT_ID.indexOf('PASTE_') === 0 ? '' : CLIENT_ID, gate: !!gatePassword_(), gateOk: gateOk_(p) };
}

function unlock_(p) {
  const pw = gatePassword_();
  if (!pw) return { ok: true, gate: '' };
  if (String(p.password || '') !== pw) { Utilities.sleep(1200); return { ok: false, error: 'wrong' }; }
  return { ok: true, gate: sign_({ gv: gateVer_(pw), exp: Date.now() + 365 * 864e5 }) };
}

function setGate_(p) {
  const s = verify_(p.token);
  if (!s || !isOwner_(s.email)) return { ok: false, error: 'owner only' };
  const props = PropertiesService.getScriptProperties();
  if (typeof p.password === 'string') {
    const pw = p.password.trim().slice(0, 40);
    if (pw) props.setProperty('GATE_PASSWORD', pw); else { props.deleteProperty('GATE_PASSWORD'); props.deleteProperty('GATE_ON'); }
  }
  if (p.on === true || p.on === false) {
    if (p.on && !storedPassword_()) return { ok: false, error: 'no password' };
    props.setProperty('GATE_ON', p.on ? '1' : '0');
  }
  return { ok: true, on: gateOn_(), password: storedPassword_() };
}

// ------------------------------------------------------------------ accounts
function login_(p) {
  const info = verifyGoogle_(p.credential);
  if (!info) return { ok: false, error: 'sign-in could not be verified' };
  const now = new Date();
  const nick = clean_(p.name, 12) || clean_(info.given_name || info.name, 12) || 'Player';
  let acc;
  withLock_(() => {
    const sh = tab_('acct');
    const row = findRow_(sh, 1, info.sub);
    if (row) {
      const v = sh.getRange(row, 1, 1, 12).getValues()[0];
      sh.getRange(row, 2).setValue(info.email);
      sh.getRange(row, 9).setValue(now);
      sh.getRange(row, 11).setValue((Number(v[10]) || 0) + 1);
      sh.getRange(row, 12).setValue(info.name || '');
      acc = rowToAcc_(sh.getRange(row, 1, 1, 12).getValues()[0]);
    } else {
      sh.appendRow([info.sub, info.email, nick, 0, 0, 0, '', '', now, now, 1, info.name || '']);
      acc = { id: info.sub, email: info.email, name: nick, wins: 0, losses: 0 };
    }
    logRow_(now, 'Google 登入', acc.name, info.email, info.sub, p.dev, p.lang);
  });
  CacheService.getScriptCache().put('v:' + info.sub, '1', VISIT_GAP_S);
  acc.picture = info.picture || '';
  acc.owner = isOwner_(info.email);
  return { ok: true, token: sign_({ sub: info.sub, email: info.email, exp: Date.now() + SESSION_DAYS * 864e5 }), account: acc };
}

function me_(p) {
  const s = verify_(p.token);
  if (!s) return { ok: false, error: 'signed out' };
  const sh = tab_('acct');
  const row = findRow_(sh, 1, s.sub);
  if (!row) return { ok: false, error: 'signed out' };
  const acc = rowToAcc_(sh.getRange(row, 1, 1, 12).getValues()[0]);
  acc.owner = isOwner_(s.email);
  return { ok: true, account: acc };
}

function rename_(p) {
  const s = verify_(p.token);
  const nick = clean_(p.name, 12);
  if (!s || !nick) return { ok: false };
  withLock_(() => {
    const sh = tab_('acct');
    const row = findRow_(sh, 1, s.sub);
    if (row) sh.getRange(row, 3).setValue(nick);
  });
  return { ok: true };
}

/** Page opened: a guest, or a returning signed-in player. Logged at most once per 30 min each. */
function visit_(p) {
  const s = verify_(p.token);
  const id = s ? s.sub : clean_(p.gid, 24);
  if (!id) return { ok: false };
  const cache = CacheService.getScriptCache();
  if (cache.get('v:' + id)) return { ok: true, skipped: true };
  cache.put('v:' + id, '1', VISIT_GAP_S);
  const now = new Date();
  withLock_(() => {
    if (s) {
      const sh = tab_('acct');
      const row = findRow_(sh, 1, s.sub);
      let name = clean_(p.name, 12);
      if (row) { sh.getRange(row, 9).setValue(now); name = name || sh.getRange(row, 3).getValue(); }
      logRow_(now, 'Google（返回）', name, s.email, s.sub, p.dev, p.lang);
    } else {
      logRow_(now, '訪客', clean_(p.name, 12) || '（未命名）', '', id, p.dev, p.lang);
    }
  });
  return { ok: true };
}

// ------------------------------------------------------------------ rooms and games
function room_(p) {
  const code = clean_(p.code, 8).toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return { ok: false };
  const now = new Date();
  withLock_(() => {
    const sh = tab_('room');
    const row = findRow_(sh, 1, code);
    const vals = [code, clean_(p.host, 12), Number(p.players) || 0, Number(p.bots) || 0, clean_(p.phase, 12), Number(p.round) || 0];
    if (row) {
      sh.getRange(row, 1, 1, 6).setValues([vals]);
      sh.getRange(row, 8, 1, 2).setValues([[now, p.closed ? '已關閉' : '進行中']]);
    } else if (!p.closed) {
      sh.appendRow(vals.concat([now, now, '進行中']));
    }
  });
  return { ok: true };
}

function game_(p) {
  const gid = clean_(p.id, 40);
  if (!gid) return { ok: false };
  const cache = CacheService.getScriptCache();
  if (cache.get('g:' + gid)) return { ok: true, dup: true };
  const players = Array.isArray(p.players) ? p.players.slice(0, 12) : [];
  const detail = players.map(x => (x.won ? '🏆' : '') + clean_(x.n, 12) + '（' + clean_(x.r0, 8) + (x.r1 && x.r1 !== x.r0 ? '→' + clean_(x.r1, 8) : '') + '）').join('、');
  withLock_(() => {
    const sh = tab_('game');
    if (findRow_(sh, 2, gid)) return;
    sh.appendRow([new Date(), gid, clean_(p.code, 8), players.length, players.filter(x => x.bot).length,
      clean_(p.winner, 20), clean_(p.how, 20), Number(p.secs) || '', clean_(p.host, 12), detail]);
  });
  cache.put('g:' + gid, '1', 21600);
  return { ok: true };
}

function result_(p) {
  const s = verify_(p.token);
  const gid = clean_(p.id, 40);
  if (!s || !gid) return { ok: false };
  const key = gid + '|' + s.sub;
  let acc = null;
  withLock_(() => {
    const rs = tab_('res');
    if (findRow_(rs, 7, key)) return;
    const sh = tab_('acct');
    const row = findRow_(sh, 1, s.sub);
    if (!row) return;
    const v = sh.getRange(row, 1, 1, 12).getValues()[0];
    const counts = !p.bots;      // games with computer players are logged but don't change wins/losses
    const won = !!p.won;
    rs.appendRow([new Date(), gid, s.sub, v[2], won ? '勝' : '負', counts ? '是' : '否（有電腦玩家）', key]);
    let w = Number(v[3]) || 0, l = Number(v[4]) || 0;
    if (counts) { if (won) w++; else l++; }
    const total = w + l;
    sh.getRange(row, 4, 1, 5).setValues([[w, l, total, total ? Math.round((w / total) * 100) + '%' : '', new Date()]]);
    acc = rowToAcc_(sh.getRange(row, 1, 1, 12).getValues()[0]);
  });
  return { ok: true, account: acc };
}

// ------------------------------------------------------------------ owner dashboard
function dashboard_(p) {
  const s = verify_(p.token);
  if (!s || !isOwner_(s.email)) return { ok: false, error: 'owner only' };
  const now = Date.now();
  const days = Math.min(Math.max(Number(p.days) || 30, 7), 90);
  const since = now - days * 864e5;
  const dayKey = d => Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  const fmt = d => Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm');

  const daily = {};
  for (let i = days - 1; i >= 0; i--) daily[dayKey(new Date(now - i * 864e5))] = { visitors: {}, google: {}, guests: {}, games: 0, logins: 0 };

  const logs = rows_('log', 20000);
  const logins = [];
  logs.forEach(r => {
    const t = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (!(t.getTime() >= since)) return;
    const d = daily[dayKey(t)];
    if (d) {
      d.visitors[r[4]] = 1;
      if (String(r[1]).indexOf('Google') === 0) d.google[r[4]] = 1; else d.guests[r[4]] = 1;
      if (r[1] === 'Google 登入') d.logins++;
    }
  });
  for (let i = logs.length - 1; i >= 0 && logins.length < 150; i--) {
    const r = logs[i];
    logins.push({ at: fmt(new Date(r[0])), kind: r[1], name: r[2], email: r[3], id: String(r[4]).slice(-8), dev: r[5] });
  }

  const games = rows_('game', 20000);
  const recentGames = [];
  let totalGames = 0, totalWithBots = 0;
  games.forEach(r => {
    totalGames++;
    if (Number(r[4]) > 0) totalWithBots++;
    const t = new Date(r[0]);
    const d = daily[dayKey(t)];
    if (d && t.getTime() >= since) d.games++;
  });
  for (let i = games.length - 1; i >= 0 && recentGames.length < 40; i--) {
    const r = games[i];
    recentGames.push({ at: fmt(new Date(r[0])), code: r[2], players: r[3], bots: r[4], winner: r[5], how: r[6], secs: r[7], host: r[8], detail: r[9] });
  }

  const live = [];
  rows_('room', 2000).forEach(r => {
    const last = new Date(r[7]).getTime();
    if (r[8] === '進行中' && now - last < LIVE_MS) {
      live.push({ code: r[0], host: r[1], players: r[2], bots: r[3], phase: r[4], round: r[5], opened: fmt(new Date(r[6])), ago: Math.round((now - last) / 1000) });
    }
  });

  const accts = rows_('acct', 20000);
  const series = Object.keys(daily).map(k => {
    const d = daily[k];
    return { day: k, visitors: Object.keys(d.visitors).length, google: Object.keys(d.google).length, guests: Object.keys(d.guests).length, logins: d.logins, games: d.games };
  });
  const today = series[series.length - 1];
  return {
    ok: true,
    at: fmt(new Date()),
    totals: { games: totalGames, gamesWithBots: totalWithBots, accounts: accts.length, visitorsToday: today.visitors, gamesToday: today.games, live: live.length },
    live, daily: series, logins, games: recentGames,
    sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    gatePassword: storedPassword_(),
    gateOn: gateOn_(),
  };
}

// ------------------------------------------------------------------ helpers
function tab_(k) {
  const def = TABS[k];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#1b2440').setFontColor('#f4e9c8');
    sh.setFrozenRows(1);
    def.text.forEach(c => sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('@'));
    const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('工作表1');
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  }
  return sh;
}

function rows_(k, max) {
  const sh = tab_(k);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - max + 1);
  return sh.getRange(start, 1, last - start + 1, TABS[k].head.length).getValues();
}

function findRow_(sh, col, value) {
  if (sh.getLastRow() < 2) return 0;
  const hit = sh.getRange(2, col, sh.getLastRow() - 1, 1).createTextFinder(String(value)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function logRow_(when, kind, name, email, id, dev, lang) {
  tab_('log').appendRow([when, kind, name, email, String(id), clean_(dev, 10), clean_(lang, 8)]);
}

function rowToAcc_(v) {
  return { id: String(v[0]), email: v[1], name: v[2], wins: Number(v[3]) || 0, losses: Number(v[4]) || 0 };
}

function verifyGoogle_(credential) {
  if (!credential || CLIENT_ID.indexOf('PASTE_') === 0) return null;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const t = JSON.parse(r.getContentText());
  const okIss = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  if (t.aud !== CLIENT_ID || !okIss || Number(t.exp) * 1000 < Date.now() || !t.sub) return null;
  return t;
}

function ownerEmail_() { try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; } }
function isOwner_(email) {
  const e = String(email || '').toLowerCase();
  if (!e) return false;
  return e === ownerEmail_().toLowerCase() || OWNER_EMAILS.map(x => String(x).toLowerCase()).indexOf(e) >= 0;
}

function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('SESSION_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SESSION_SECRET', s); }
  return s;
}
function b64_(x) { return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); }
function sign_(obj) {
  const body = b64_(JSON.stringify(obj));
  return body + '.' + b64_(Utilities.computeHmacSha256Signature(body, secret_()));
}
function verify_(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  if (b64_(Utilities.computeHmacSha256Signature(parts[0], secret_())) !== parts[1]) return null;
  let body = parts[0];
  while (body.length % 4) body += '=';
  const o = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
  return o && o.exp > Date.now() ? o : null;
}

function clean_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').replace(/^[=+\-@]+/, '').trim().slice(0, n); }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
