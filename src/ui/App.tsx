import { React, useState, useEffect } from '../react';
import { game } from '../game';
import { ROLES, N_ROLES } from '../roles';
import { useT, useView, setLang } from './store';
import { Modal, RoleArt, TeamBadge } from './common';
import { Home, NameEntry, StatusScreen, Lobby } from './Lobby';
import { Reveal } from './Reveal';
import { Night } from './Night';
import { Day } from './Day';
import { Vote, HuntOverlay } from './Vote';
import { End } from './End';
import { ClaimToasts, Throws } from './Effects';
import { isMuted, setMuted, unlockAudio, sfx } from '../sound';

function Nav({ onRules, onTest }: { onRules: () => void; onTest: () => void }) {
  const t = useT(); const v = useView();
  const [muted, setM] = useState(isMuted());
  const inRoom = v.status === 'in' && v.pub;
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="一夜狼人殺">
          <svg viewBox="0 0 32 32" className="brand-moon" aria-hidden="true"><path d="M20 4a12 12 0 1 0 8 20A10 10 0 1 1 20 4z" fill="currentColor" /></svg>
          <span className="brand-name">一夜狼人殺</span>
          <span className="brand-sub">{t('appSub')}</span>
        </a>
        <div className="nav-tools hscroll">
          {inRoom && <span className="nav-room mono" title={t('roomCode')}>{v.code}</span>}
          <button type="button" className="btn btn-sm btn-ghost lang-flip" aria-label="Language" onClick={() => setLang(t.lang === 'zh' ? 'en' : 'zh')}>{t.lang === 'zh' ? 'EN' : '中'}</button>
          <div className="seg seg-sm lang-seg" role="radiogroup" aria-label="Language">
            <button type="button" role="radio" aria-checked={t.lang === 'en'} className={t.lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>EN</button>
            <button type="button" role="radio" aria-checked={t.lang === 'zh'} className={t.lang === 'zh' ? 'is-on' : ''} onClick={() => setLang('zh')}>繁中</button>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" aria-pressed={!muted} aria-label={muted ? t('soundOff') : t('sound')} onClick={() => { const m = !muted; setMuted(m); setM(m); if (!m) { unlockAudio(); sfx.chime(); } }}>{muted ? '🔇' : '🔊'}<span className="btn-label">{muted ? t('soundOff') : t('sound')}</span></button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onRules} aria-label={t('rules')}><span className="btn-ico" aria-hidden="true">?</span><span className="btn-label">{t('rules')}</span></button>
          <button type="button" id="test-mode-btn" className={`btn btn-sm ${v.testMode ? 'btn-test-on' : 'btn-ghost'}`} onClick={onTest} aria-label={v.testMode ? t('testOn') : t('test')}>🤖<span className="btn-label">{v.testMode ? t('testOn') : t('test')}</span></button>
          {inRoom && <button type="button" className="btn btn-sm btn-ghost" onClick={() => game.leave()} aria-label={t('leave')}><span className="btn-ico" aria-hidden="true">⏏</span><span className="btn-label">{t('leave')}</span></button>}
        </div>
      </div>
    </header>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={t('rulesTitle')} onClose={onClose} wide>
      <div className="rules">
        <p>{t('rulesBody1')}</p>
        <p>{t('rulesBody2')}</p>
        <p><b>{t('rulesWin')}</b></p>
        <p className="muted">{t('rulesHouse')}</p>
        <ol className="rules-roles">
          {Array.from({ length: N_ROLES }, (_, r) => (
            <li key={r} className={`team-${ROLES[r].team}`}>
              <RoleArt r={r} className="rules-art" />
              <div>
                <h3>{ROLES[r].zh} <small>{ROLES[r].en}</small> {ROLES[r].night ? <span className="tag mono">#{r + 1}</span> : <span className="tag tag-dim">{t('passive')}</span>}</h3>
                <TeamBadge r={r} />
                <p>{ROLES[r].desc[t.lang]}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}

function TestModal({ onClose }: { onClose: () => void }) {
  const t = useT(); const v = useView();
  return (
    <Modal title={v.testMode ? t('tmExit') : t('tmTitle')} onClose={onClose}>
      <p>{v.testMode ? t('tmExitBody') : t('tmBody')}</p>
      <div className="row-gap end">
        <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        <button type="button" id="test-confirm" className="btn btn-moon" onClick={() => { game.setTestMode(!v.testMode); onClose(); }}>{v.testMode ? t('tmExit') : t('tmEnter')}</button>
      </div>
    </Modal>
  );
}

function Screen() {
  const v = useView();
  if (v.status === 'home') return <Home />;
  if (v.status === 'name') return <NameEntry />;
  if (v.status !== 'in' || !v.pub) return <StatusScreen />;
  switch (v.pub.ph) {
    case 'lobby': return <Lobby />;
    case 'reveal': return <Reveal />;
    case 'night': return <Night />;
    case 'day': return <Day />;
    case 'vote': return <Vote />;
    case 'hunt': return <Day />;
    case 'end': return <End />;
  }
  return null;
}

export function App() {
  const v = useView();
  const [rules, setRules] = useState(false);
  const [test, setTest] = useState(false);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: false });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  const ph = v.pub?.ph;
  return (
    <div className={`app ph-${v.status === 'in' ? ph : v.status}`}>
      <div className="sky" aria-hidden="true" />
      <Nav onRules={() => setRules(true)} onTest={() => setTest(true)} />
      <Screen />
      <ClaimToasts />
      <Throws />
      <HuntOverlay />
      {rules && <RulesModal onClose={() => setRules(false)} />}
      {test && <TestModal onClose={() => setTest(false)} />}
      {v.status === 'in' && v.netKind && !v.connected && <div className="net-warn" role="status">…</div>}
    </div>
  );
}
