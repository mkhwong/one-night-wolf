import { useSyncExternalStore, useEffect, useState } from '../react';
import { game, View } from '../game';
import { tr, Lang } from '../i18n';
import { roleName } from '../roles';

// ---- language
let lang: Lang = (() => { try { const l = localStorage.getItem('onuw:lang'); if (l === 'en' || l === 'zh') return l; } catch { /* ignore */ } return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'zh'; })();
const langSubs = new Set<() => void>();
export function setLang(l: Lang) { lang = l; try { localStorage.setItem('onuw:lang', l); } catch { /* ignore */ } document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en'; langSubs.forEach(f => f()); }
export function useLang(): Lang { return useSyncExternalStore(fn => { langSubs.add(fn); return () => { langSubs.delete(fn); }; }, () => lang); }
export function useT() {
  const l = useLang();
  return Object.assign((k: string, v?: Record<string, string | number>) => tr(l, k, v), { lang: l, role: (r: number) => roleName(r, l) });
}

// ---- game view
export function useView(): View { return useSyncExternalStore(game.subscribe, game.get); }

// ---- clock (host time)
export function useNow(ms = 250): number {
  const [n, setN] = useState(() => game.now());
  useEffect(() => { const t = setInterval(() => setN(game.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}

export function seatName(v: View, s: number): string {
  if (!v.pub || s < 0 || s >= v.pub.seats.length) return '?';
  return v.pub.seats[s][1];
}

// ---- private markers (this device only)
export type Pin = 'peek' | 'swap' | 'wolf' | 'safe' | 'doubt' | 'sure' | 'tanner';
export const PINS: { k: Pin; icon: string }[] = [
  { k: 'peek', icon: '👁' }, { k: 'swap', icon: '⇄' }, { k: 'wolf', icon: '🐺' }, { k: 'safe', icon: '🛡' },
  { k: 'doubt', icon: '?' }, { k: 'sure', icon: '✓' }, { k: 'tanner', icon: '💀' },
];
export interface Mark { r: number[]; p: Pin[]; n: string }
export interface Marks { s: Record<number, Mark>; c: Record<number, Mark>; auto: number }
const emptyMarks = (): Marks => ({ s: {}, c: {}, auto: 0 });
let marksKey = ''; let marks: Marks = emptyMarks();
const markSubs = new Set<() => void>();
function loadMarks(key: string) {
  if (key === marksKey) return;
  marksKey = key;
  try { marks = JSON.parse(localStorage.getItem('onuw:mk:' + key) || 'null') || emptyMarks(); } catch { marks = emptyMarks(); }
}
function saveMarks() { try { localStorage.setItem('onuw:mk:' + marksKey, JSON.stringify(marks)); } catch { /* ignore */ } markSubs.forEach(f => f()); }
export function useMarks(key: string): Marks {
  loadMarks(key);
  return useSyncExternalStore(fn => { markSubs.add(fn); return () => { markSubs.delete(fn); }; }, () => marks);
}
export function editMark(key: string, kind: 's' | 'c', idx: number, fn: (m: Mark) => Mark) {
  loadMarks(key);
  const cur = marks[kind][idx] || { r: [], p: [], n: '' };
  marks = { ...marks, [kind]: { ...marks[kind], [idx]: fn({ r: cur.r.slice(), p: cur.p.slice(), n: cur.n }) } };
  saveMarks();
}
export function setAutoApplied(key: string, n: number) { loadMarks(key); marks = { ...marks, auto: n }; saveMarks(); }
export function marksAuto(key: string) { loadMarks(key); return marks.auto; }
