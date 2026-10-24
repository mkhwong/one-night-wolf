import { React, useEffect, useState } from '../react';
import { game } from '../game';
import { R } from '../roles';
import { useT, useView, useNow, seatName } from './store';
import { RoleChip, Countdown, Reminder, OrderBar, RoleArt } from './common';
import { HuntButton } from './Day';
import { sfx } from '../sound';

export function Vote() {
  const v = useView(); const t = useT(); const now = useNow(250);
  const pub = v.pub!;
  const n = pub.seats.length; const me = v.mySeat;
  const [pick, setPick] = useState<number>(v.myVote >= -1 ? v.myVote : -2);
  useEffect(() => { if (v.myVote >= -1) setPick(v.myVote); }, [v.myVote]);
  const locked = v.myLocked;
  // auto-lock the current selection just before time runs out
  useEffect(() => {
    if (!locked && pick >= -1 && pub.te - now < 1200) game.vote(pick, true);
  }, [now, locked, pick, pub.te]);
  const choose = (x: number) => { if (locked) return; sfx.click(); setPick(x); game.vote(x, false); };
  return (
    <main className="vote">
      <header className="day-bar">
        <Reminder variant="chip" />
        <div className="day-title"><p className="eyebrow">{t('vote')}</p><h1 className="display">{t('voteTitle')}</h1><p className="muted">{t('votePick')}</p></div>
        <div className="day-actions hscroll">
          <Countdown end={pub.te} total={pub.cfg.vd * 1000} big warnAt={10000} />
          <HuntButton />
        </div>
      </header>
      <div className="ballot">
        {Array.from({ length: n }, (_, s) => s).filter(s => s !== me).map(s => {
          const claim = v.claims[s];
          return (
            <button key={s} type="button" className={`ballot-card ${pick === s ? 'is-on' : ''}`} disabled={locked} onClick={() => choose(s)} data-pseat={s}>
              <span className="pcard-no mono">{s + 1}</span>
              <span className="ballot-name">{seatName(v, s)}</span>
              {claim ? <RoleChip r={claim.role} /> : <span className="muted small">—</span>}
              <span className="ballot-finger" aria-hidden="true">☝</span>
            </button>
          );
        })}
        <button type="button" className={`ballot-card ballot-peace ${pick === -1 ? 'is-on' : ''}`} disabled={locked} onClick={() => choose(-1)}>
          <span className="peace-icon" aria-hidden="true">🕊</span>
          <span className="ballot-name">{t('peace')}</span>
          <span className="muted small">{t('peaceDesc')}</span>
        </button>
      </div>
      <footer className="vote-foot">
        <button type="button" id="lock-vote" className="btn btn-moon btn-lg" disabled={locked || pick < -1} onClick={() => { sfx.gavel(); game.vote(pick, true); }}>{locked ? '✓ ' + t('locked') : t('lock')}</button>
        <span className="muted small">{t('lockedCount', { a: pub.lk, b: n })} · {t('autoLockNote')}</span>
      </footer>
      <OrderBar pub={pub} />
    </main>
  );
}

export function HuntOverlay() {
  const v = useView(); const t = useT();
  const pub = v.pub;
  const [target, setTarget] = useState(-1);
  if (!pub || pub.ph !== 'hunt' || !pub.hunt) return null;
  const [hs] = pub.hunt;
  const mine = hs === v.mySeat;
  return (
    <div className="hunt-overlay" role="alertdialog" aria-label={t('huntTitle', { name: seatName(v, hs) })}>
      <div className="hunt-card">
        <RoleArt r={R.HUNTER} className="hunt-art" />
        <h1 className="display">{t('huntTitle', { name: seatName(v, hs) })}</h1>
        <p className="muted">{t('paused')}</p>
        {mine && (
          <>
            <p className="hint">{t('huntPick')}</p>
            <div className="hunt-targets">
              {pub.seats.map((s, i) => i === hs ? null : (
                <button key={i} type="button" className={`btn ${target === i ? 'is-on' : ''}`} onClick={() => setTarget(i)}><b className="mono">{i + 1}</b> {s[1]}</button>
              ))}
            </div>
            <div className="row-gap">
              <button type="button" id="hunt-shoot" className="btn btn-ember btn-lg" disabled={target < 0} onClick={() => { sfx.bow(); game.huntShoot(target); }}>🏹 {t('shoot')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => game.huntCancel()}>{t('cancelHunt')}</button>
            </div>
          </>
        )}
        {!mine && v.isHost && <button type="button" className="btn btn-sm btn-ghost" onClick={() => game.forceResume()}>{t('resumeHost')}</button>}
      </div>
    </div>
  );
}
