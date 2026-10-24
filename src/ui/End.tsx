import { React, useEffect, useRef } from '../react';
import { game } from '../game';
import { ROLES, R } from '../roles';
import { describeLog } from '../i18n';
import { useT, useView, seatName } from './store';
import { RoleArt } from './common';
import { sfx } from '../sound';

function Confetti({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = (c.width = c.clientWidth * devicePixelRatio), H = (c.height = c.clientHeight * devicePixelRatio);
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, r: (3 + Math.random() * 5) * devicePixelRatio, a: Math.random() * 6, col: colors[Math.floor(Math.random() * colors.length)] }));
    let raf = 0; const t0 = performance.now();
    const draw = (tt: number) => {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx * devicePixelRatio; p.y += p.vy * devicePixelRatio; p.a += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      if (tt - t0 < 4500) raf = requestAnimationFrame(draw); else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas className="confetti" ref={ref} aria-hidden="true" />;
}

export function End() {
  const v = useView(); const t = useT();
  const pub = v.pub!; const res = pub.res!;
  const nm = (s: number) => seatName(v, s);
  const me = v.mySeat;
  const iWon = res.win.includes(me);
  useEffect(() => { if (me >= 0) (iWon ? sfx.win : sfx.lose)(); }, [pub.ep]);
  const headline = res.w.v ? t('winVillage') : res.w.w ? t('winWolf') : res.w.t ? t('winTanner') : t('winNobody');
  const tone = res.w.v ? 'village' : res.w.w ? 'wolf' : res.w.t ? 'tanner' : 'none';
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--moon', '--moss', '--ember', '--hide', '--fg'].map(k => cs.getPropertyValue(k).trim() || '#fff');
  return (
    <main className="end">
      {(res.w.v || res.w.w || res.w.t) ? <Confetti colors={colors} /> : null}
      <header className={`end-banner tone-${tone}`}>
        <p className="eyebrow">{t(iWon ? 'winner' : 'loser')} · {nm(me)}</p>
        <h1 className="end-title">{headline}{(res.w.v || res.w.w) && res.w.t ? <small> · {t('andTanner')}</small> : null}</h1>
        <p className="end-how">{t('how_' + res.how)}{res.noWolf && res.w.w ? ' ' + t('minionHouse') : ''}</p>
        {res.hs.length > 0 && <p className="end-how">{res.hs.map(([a, b]) => `🏹 ${nm(a)} → ${nm(b)}`).join(' · ')}</p>}
      </header>

      <section className="end-grid">
        {res.st.map((st, s) => {
          const fn = res.fn[s]; const dead = res.d.includes(s); const won = res.win.includes(s); const vote = res.v[s];
          return (
            <article key={s} className={`end-seat ${dead ? 'is-dead' : ''} ${won ? 'is-won' : ''} ${s === me ? 'is-me' : ''}`}>
              <header><span className="pcard-no mono">{s + 1}</span><b>{nm(s)}</b>{s === me && <span className="tag">{t('you')}</span>}</header>
              <div className="end-cards">
                <figure><RoleArt r={st} /><figcaption><small>{t('startCard')}</small>{t.role(st)}</figcaption></figure>
                <span className="end-arrow" aria-hidden="true">→</span>
                <figure className={`team-${ROLES[fn].team}`}><RoleArt r={fn} /><figcaption><small>{t('finalCard')}</small>{t.role(fn)}</figcaption></figure>
              </div>
              <footer>
                <span className={`tag ${won ? 'tag-moon' : 'tag-dim'}`}>{t(won ? 'winner' : 'loser')}</span>
                {dead && <span className="tag tag-warn">☠ {res.how === 'hunt' ? t('shot') : t('died')}</span>}
                <span className="small muted">{t('votedFor')}: {vote === -1 ? '🕊 ' + t('peaceShort') : vote >= 0 ? nm(vote) : t('noVote')}</span>
              </footer>
            </article>
          );
        })}
      </section>

      <section className="end-lower">
        <div className="panel">
          <h2>{t('center')}</h2>
          <div className="end-center">
            {res.c0.map((c, i) => (
              <div key={i} className="end-cards">
                <figure><RoleArt r={c} /><figcaption><small>{t('centerN', { n: i + 1 })}</small>{t.role(c)}</figcaption></figure>
                <span className="end-arrow" aria-hidden="true">→</span>
                <figure><RoleArt r={res.cf[i]} /><figcaption><small>{t('finalCard')}</small>{t.role(res.cf[i])}</figcaption></figure>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>{t('timeline')}</h2>
          <ol className="timeline">
            {res.log.filter(e => e.k !== 'lone').map((e, i) => (
              <li key={i}><RoleArt r={e.t} className="timeline-art" /><span>{describeLog(e, t.lang, nm)}</span></li>
            ))}
            {res.log.length === 0 && <li className="muted">{t('nightPasses')}</li>}
          </ol>
        </div>
      </section>

      <footer className="startbar">
        {v.isHost ? (
          <button type="button" className="btn btn-moon btn-lg" id="play-again" onClick={() => { sfx.click(); game.playAgain(); }}>{t('playAgain')}</button>
        ) : <span className="muted">{t('waitingAgain')}</span>}
        <button type="button" className="btn btn-ghost" onClick={() => game.leave()}>{t('leave')}</button>
      </footer>
      <span hidden>{R.HUNTER}</span>
    </main>
  );
}
