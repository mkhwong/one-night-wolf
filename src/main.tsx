import { React, ReactDOM } from './react';
import { App } from './ui/App';
import { game } from './game';
import { setLang, useLang } from './ui/store';

function boot(data: any) {
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
}

const hot = (window as any).claude?.hot;
try { hot?.snapshot?.(() => ({ sess: game.snapshot() })); } catch { /* ignore */ }
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? {});
void useLang;
declare const __TEST__: boolean;
if (__TEST__) (window as any).__onuw = game;
