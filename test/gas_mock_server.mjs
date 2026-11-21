// Runs apps-script/Code.gs in Node against an in-memory spreadsheet and serves it over HTTP (test only).
import fs from 'fs'; import http from 'http'; import crypto from 'crypto'; import vm from 'vm';
const PORT = Number(process.argv[2] || 8765);
class Range {
  constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.cell(this.r + i, this.c + j)); o.push(row); } return o; }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh.put(this.r, this.c, x); return this; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setNumberFormat() { return this; }
  getRow() { return this.r; }
  createTextFinder(text) { const self = this; let ent = false; return { matchEntireCell(b) { ent = b; return this; }, findNext() {
    for (let i = 0; i < self.nr; i++) for (let j = 0; j < self.nc; j++) { const v = String(self.sh.cell(self.r + i, self.c + j)); if (ent ? v === text : v.includes(text)) return new Range(self.sh, self.r + i, self.c + j); } return null; } }; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  cell(r, c) { const v = (this.rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; }
  put(r, c, v) { while (this.rows.length < r) this.rows.push([]); this.rows[r - 1][c - 1] = v; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  appendRow(v) { this.rows.push(v.slice()); }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1000; }
  setFrozenRows() {}
  getName() { return this.name; }
}
const sheets = [new Sheet('Sheet1')];
const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; },
  getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), setSpreadsheetTimeZone() {}, getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST/edit' };
const props = {}; const cache = new Map();
const b64ws = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: k => { const e = cache.get(k); return e && e.exp > Date.now() ? e.v : null; }, put: (k, v, s) => cache.set(k, { v, exp: Date.now() + s * 1000 }) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
  Logger: { log: console.log }, console,
  Utilities: {
    formatDate: (d, tz, f) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
      return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute); },
    base64EncodeWebSafe: x => b64ws(typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map(b => b & 255))),
    base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
    computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', k).update(v).digest()].map(b => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID(), sleep: () => {},
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes.map(b => b & 255)).toString('utf8') }),
  },
  UrlFetchApp: { fetch: url => { const tok = decodeURIComponent(url.split('id_token=')[1]);
    const m = /^fake:(\w+):([^:]+):(.+)$/.exec(tok);
    if (!m) return { getResponseCode: () => 400, getContentText: () => '{}' };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ iss: 'https://accounts.google.com', aud: 'test-client.apps.googleusercontent.com', exp: String(Math.floor(Date.now() / 1000) + 3600), sub: m[1], email: m[2], name: m[3], given_name: m[3], email_verified: 'true' }) }; } },
  ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
};
let src = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').replace("'PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com'", "'test-client.apps.googleusercontent.com'");
vm.createContext(ctx); vm.runInContext(src, ctx);
http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (req.url.startsWith('/__dump')) { res.writeHead(200, cors); res.end(JSON.stringify(Object.fromEntries(sheets.map(s => [s.name, s.rows])))); return; }
    if (req.method === 'OPTIONS') { res.writeHead(400); res.end(); return; }   // Apps Script can't answer preflights: fail if one is sent
    const out = req.method === 'POST' ? ctx.doPost({ postData: { contents: body } }) : ctx.doGet({ parameter: Object.fromEntries(new URL(req.url, 'http://x').searchParams) });
    res.writeHead(200, cors); res.end(out.text);
  });
}).listen(PORT, () => console.log('gas mock on', PORT));
