import { React, ReactDOM } from './react';
import { App } from './ui/App';
import { game } from './game';
import { setLang, useLang } from './ui/store';
import { initTrack, onCredential } from './track';

declare const __LOCK__: boolean;
// The published page only runs on the official address (and on this computer for testing).
const OFFICIAL = 'https://one-night-wolf-w1e3.onrender.com/';
function allowedHere(): boolean {
  if (!__LOCK__) return true;
  const h = location.hostname;
  return location.protocol === 'https:' && h === 'one-night-wolf-w1e3.onrender.com'
    || (location.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1'));
}
function blocked() {
  const root = document.getElementById('root')!;
  root.innerHTML = '';
  const box = document.createElement('div');
  box.setAttribute('style', 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font:16px/1.6 system-ui,sans-serif;color:#edf0f8;background:#0a1020');
  const h = document.createElement('h1'); h.textContent = '此遊戲只限官方網站 · Official site only'; h.setAttribute('style', 'font-size:1.4rem;margin:0');
  const p = document.createElement('p'); p.textContent = '這是未經授權的副本。請到官方網站遊玩。This is an unauthorised copy of 一夜狼人殺 One Night Wolf.';
  const a = document.createElement('a'); a.href = OFFICIAL; a.textContent = OFFICIAL; a.setAttribute('style', 'color:#f2d184');
  const c = document.createElement('small'); c.textContent = '© 2026 Matthew Wong. All rights reserved.'; c.setAttribute('style', 'color:#6f7b9e');
  box.append(h, p, a, c); root.appendChild(box);
}

function boot(data: any) {
  if (!allowedHere()) { blocked(); return; }
  try {
    if (data && data.sess) sessionStorage.setItem('onuw:sess', JSON.stringify(data.sess));
  } catch { /* ignore */ }
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(<App />);
  // language attribute
  let saved: any = null;
  try { saved = localStorage.getItem('onuw:lang'); } catch { /* storage blocked */ }
  setLang(saved === 'en' ? 'en' : 'zh');
  game.resume().catch(() => { /* fresh start */ });
  try { initTrack(); } catch { /* logging must never break the game */ }
}

const hot = (window as any).claude?.hot;
try { hot?.snapshot?.(() => ({ sess: game.snapshot() })); } catch { /* ignore */ }
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? {});
void useLang;
declare const __TEST__: boolean;
if (__TEST__) { (window as any).__onuw = game; (window as any).__signin = onCredential; }
