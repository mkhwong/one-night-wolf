import { React, useState, useEffect } from '../react';
import { game } from '../game';
import { ROLES } from '../roles';
import { REVEAL_MS } from '../engine';
import { useT, useView, useNow } from './store';
import { RoleArt, TeamBadge, CardBack } from './common';
import { sfx } from '../sound';

export function Reveal() {
  const t = useT(); const v = useView(); const now = useNow(250);
  const pub = v.pub!; const priv = v.priv;
  const [flipped, setFlipped] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { setFlipped(false); setSent(false); }, [pub.ep]);
  const r = priv?.r ?? -1;
  const left = Math.max(0, Math.ceil((pub.te - now) / 1000));
  const readyN = pub.rdy.length;
  const iAmReady = sent || pub.rdy.includes(v.mySeat);
  return (
    <main className="reveal">
      <p className="eyebrow">{t('revealTitle')}</p>
      <button type="button" className={`flip ${flipped ? 'is-flipped' : ''}`} id="flip-card" onClick={() => { if (!flipped) sfx.reveal(); setFlipped(f => !f); }} aria-label={t('tapFlip')} disabled={r < 0}>
        <span className="flip-inner">
          <span className="flip-face flip-back"><CardBack /><span className="flip-hint">{t('tapFlip')}</span></span>
          <span className={`flip-face flip-front team-${r >= 0 ? ROLES[r].team : 'village'}`}>
            {r >= 0 && <>
              <span className="flip-art"><RoleArt r={r} /></span>
              <span className="flip-name"><b>{ROLES[r].zh}</b><small>{ROLES[r].en}</small></span>
            </>}
          </span>
        </span>
      </button>
      {flipped && r >= 0 && (
        <div className="reveal-info">
          <TeamBadge r={r} />
          <p>{ROLES[r].desc[t.lang]}</p>
        </div>
      )}
      <div className="reveal-foot">
        <button type="button" className="btn btn-moon btn-lg" id="ready-btn" disabled={!flipped || iAmReady} onClick={() => { setSent(true); sfx.click(); game.ready(); }}>{iAmReady ? '✓ ' + t('ready') : t('ready')}</button>
        <span className="muted mono small">{t('readyCount', { a: readyN, b: pub.seats.length })} · {t('nightIn', { s: left })}</span>
        <span className="reveal-bar" style={{ ['--f' as any]: Math.max(0, (pub.te - now) / REVEAL_MS) }} />
      </div>
    </main>
  );
}
