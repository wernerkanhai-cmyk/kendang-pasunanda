import { useState, useMemo } from 'react';
import ensembleImg from '../assets/drums_ensemble.png';
import gongImg from '../assets/Gong.png';
import './DrumPad.css';
import SoundSettingsContent from './SettingsPanel';
import { useT } from '../i18n';
import { glyphFor, SYMBOL_REST } from '../engine/patternLogic';

// ── SVG pie helpers ──────────────────────────────────────────────────────────
// Convention: 0° = top (12 o'clock), clockwise

const polar = (cx, cy, r, deg) => {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const wedgePath = (cx, cy, r, a1, a2) => {
  const span = ((a2 - a1) + 360) % 360;
  const s = polar(cx, cy, r, a1);
  const e = polar(cx, cy, r, a2);
  const large = span > 180 ? 1 : 0;
  return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`;
};

const labelAt = (cx, cy, r, a1, a2) => {
  const span = ((a2 - a1) + 360) % 360;
  const mid = a1 + span / 2;
  return polar(cx, cy, r * 0.62, mid);
};

// ── Drum zone data ────────────────────────────────────────────────────────────
// Positions are % of the ensemble image. Zones follow the PDF layout.

// Drum-zones gebruiken soundIds als canonieke identifier. De NotationPack
// bepaalt welke glyph getoond wordt; de naam blijft de Sundanese
// onomatopee — dat is een eigenschap van het instrument, niet de notatie.
const DRUMS = [
  {
    id: 'ketipung', label: 'Ketipung',
    top: '31%', left: '18%', size: '18%',
    zones: [
      { soundId: 'tung', track: 'anak', name: 'Tung', a1: 0, a2: 360, fill: 'rgba(55,50,65,0.55)' }
    ]
  },
  {
    id: 'gedug', label: 'Gedug',
    top: '62%', left: '33%', size: '29%',
    zones: [
      { soundId: 'dong', track: 'indung', name: 'Dong', a1: 300, a2: 60,  fill: 'rgba(55,40,25,0.65)' },
      { soundId: 'ting', track: 'indung', name: 'Ting', a1: 60,  a2: 180, fill: 'rgba(80,65,40,0.55)' },
      { soundId: 'det',  track: 'indung', name: 'Det',  a1: 180, a2: 300, fill: 'rgba(65,50,30,0.55)' }
    ]
  },
  {
    id: 'kumpyang', label: 'Kumpyang',
    top: '62%', left: '59%', size: '26%',
    zones: [
      { soundId: 'pling', track: 'indung', name: 'Pling', a1: 270, a2: 342, fill: 'rgba(65,65,70,0.55)' },
      { soundId: 'pang',  track: 'indung', name: 'Pang',  a1: 342, a2: 54,  fill: 'rgba(72,72,78,0.55)' },
      { soundId: 'ping',  track: 'indung', name: 'Ping',  a1: 54,  a2: 126, fill: 'rgba(60,60,65,0.55)' },
      { soundId: 'pong',  track: 'indung', name: 'Pong',  a1: 126, a2: 198, fill: 'rgba(55,55,60,0.55)' },
      { soundId: 'plak',  track: 'indung', name: 'Plak',  a1: 198, a2: 270, fill: 'rgba(18,18,22,0.85)' }
    ]
  },
  {
    id: 'kutiplak', label: 'Kutiplak',
    top: '41%', left: '77%', size: '19%',
    zones: [
      { soundId: 'pak',   track: 'anak', name: 'Pak',   a1: 270, a2: 450, fill: 'rgba(70,70,80,0.55)' },
      { soundId: 'peung', track: 'anak', name: 'Peung', a1: 90,  a2: 270, fill: 'rgba(85,85,95,0.50)' }
    ]
  }
];

// ── DrumZone component ────────────────────────────────────────────────────────

const DrumZone = ({ drum, onTrigger }) => {
  const isFull = drum.zones.length === 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: drum.top,
        left: drum.left,
        width: drum.size,
        aspectRatio: '1',
        transform: 'translate(-50%, -50%)',
        zIndex: 10
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {/* Outer ring */}
        <circle cx="50" cy="50" r="49" fill="rgba(0,0,0,0.12)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />

        {isFull ? (
          // Single full-circle zone (Ketipung)
          <g
            onClick={() => onTrigger(drum.zones[0].soundId, drum.zones[0].track)}
            style={{ cursor: 'pointer' }}
            title={drum.zones[0].name}
          >
            <circle cx="50" cy="50" r="47" className="pie-wedge" fill={drum.zones[0].fill} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <text x="50" y="55" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none' }}>
              {drum.zones[0].name}
            </text>
          </g>
        ) : (
          drum.zones.map((z, i) => {
            const lp = labelAt(50, 50, 47, z.a1, z.a2);
            return (
              <g
                key={i}
                onClick={() => onTrigger(z.soundId, z.track)}
                style={{ cursor: 'pointer' }}
                title={z.name}
              >
                <path
                  d={wedgePath(50, 50, 47, z.a1, z.a2)}
                  className="pie-wedge"
                  fill={z.fill}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.5"
                />
                <text
                  x={lp.x} y={lp.y + 3.5}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {z.name}
                </text>
              </g>
            );
          })
        )}

        {/* Center dot for multi-zone drums */}
        {!isFull && (
          <circle cx="50" cy="50" r="4" fill="rgba(255,255,255,0.55)" style={{ pointerEvents: 'none' }} />
        )}
      </svg>
    </div>
  );
};

// ── Main DrumPad ──────────────────────────────────────────────────────────────

const DrumPad = ({ notationPack, instrumentPack, onTrigger, inputMode, onGongTrigger, gongActive = false, soundSettings, onSoundSettingsChange, onPreviewSound, cursorOffsetMs, onCursorOffsetChange, availablePacks, notationPackId, onNotationPackChange, voicePackId, onVoicePackChange }) => {
  const t = useT();
  const [showLegend, setShowLegend] = useState(false);
  const [activeTab, setActiveTab] = useState('pad');

  // Legenda — afgeleid van de actieve NotationPack zodat de toetshint en glyph
  // automatisch meegaan bij een notatiewissel.
  const LEGEND = useMemo(() => {
    const sounds = [
      { soundId: 'tung', name: 'Tung' },     { soundId: 'dong', name: 'Dong' },
      { soundId: 'ting', name: 'Ting' },     { soundId: 'det',  name: 'Det' },
      { soundId: 'pling', name: 'Pling' },   { soundId: 'pang', name: 'Pang' },
      { soundId: 'ping', name: 'Ping' },     { soundId: 'pong', name: 'Pong' },
      { soundId: 'plak', name: 'Plak' },     { soundId: 'pak',  name: 'Pak' },
      { soundId: 'peung', name: 'Peung' },   { soundId: 'dededet', name: 'Dededet' },
    ];
    return sounds.map(s => ({ ...s, glyph: glyphFor(s.soundId, notationPack) }));
  }, [notationPack]);

  const COMBO_LEGEND = useMemo(() => {
    const combos = [
      { sounds: ['pak', 'dong'],  name: 'Bang'   },
      { sounds: ['pang', 'dong'], name: 'Blang'  },
      { sounds: ['plak', 'det'],  name: 'Blap'   },
      { sounds: ['pang', 'tung'], name: 'Plang'  },
      { sounds: ['peung', 'tung'],name: 'Tleung' },
    ];
    return combos.map(c => ({ ...c, glyphs: c.sounds.map(s => glyphFor(s, notationPack)) }));
  }, [notationPack]);

  const tabBtn = (id, label, icon) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1, background: 'transparent',
        color: activeTab === id ? '#f1f5f9' : '#64748b',
        border: 'none', borderBottom: `2px solid ${activeTab === id ? '#3b82f6' : 'transparent'}`,
        padding: '0.5rem 0', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 400,
        letterSpacing: '0.01em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        textShadow: activeTab === id ? '0 0 8px rgba(59,130,246,0.5)' : 'none',
        transition: 'color 0.15s',
      }}
    >{icon}{label}</button>
  );

  return (
    <section className="drum-module glass-panel">
      {/* Tabs */}
      <div style={{ display: 'flex', background: 'linear-gradient(90deg, #1a1c22 0%, #20232b 16%, #3b3e46 33%, #1c1e24 50%, #3b3e46 67%, #20232b 84%, #1a1c22 100%)', borderBottom: '1px solid #2b3650', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)', marginBottom: '0.25rem' }}>
        {tabBtn('pad', t('padTab'), <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.9 }}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>)}
        {tabBtn('geluid', t('soundTab'), <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.9 }}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>)}
      </div>

      {activeTab === 'geluid' && soundSettings && onSoundSettingsChange && (
        <SoundSettingsContent settings={soundSettings} onChange={onSoundSettingsChange}
          onPlay={onPreviewSound || onTrigger}
          tracks={instrumentPack?.tracks}
          cursorOffsetMs={cursorOffsetMs} onCursorOffsetChange={onCursorOffsetChange}
          availablePacks={availablePacks}
          notationPackId={notationPackId}
          onNotationPackChange={onNotationPackChange}
          voicePackId={voicePackId}
          onVoicePackChange={onVoicePackChange}
        />
      )}

      {activeTab === 'pad' && <>
      <div className="drum-module-header">
        {showLegend && (
          <div style={{ marginBottom: '0.4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px 6px', marginBottom: '0.4rem' }}>
              {LEGEND.map(({ soundId, name, glyph }) => (
                <div key={soundId} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem' }}>
                  <kbd style={{ fontSize: '0.6rem', background: '#334155', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '3px', padding: '0 3px', lineHeight: '1.4', fontFamily: 'monospace' }}>{glyph}</kbd>
                  <span className="kendang-font" style={{ fontSize: '0.95rem', color: '#d4af37', lineHeight: 1 }}>{glyph}</span>
                  <span style={{ color: '#94a3b8' }}>{name}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #334155', paddingTop: '0.3rem' }}>
              <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 'bold', marginBottom: '3px' }}>Combinatieslagen</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px 6px' }}>
                {COMBO_LEGEND.map(({ glyphs, name }) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem' }}>
                    <span className="kendang-font" style={{ fontSize: '0.95rem', color: '#d4af37', lineHeight: 1 }}>{glyphs[0]}</span>
                    <span style={{ color: '#475569', fontSize: '0.6rem' }}>+</span>
                    <span className="kendang-font" style={{ fontSize: '0.95rem', color: '#d4af37', lineHeight: 1 }}>{glyphs[1]}</span>
                    <span style={{ color: '#94a3b8' }}>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>

        {/* ── Ensemble foto + gong overlay + pie-chart zones ── */}
        <div style={{ position: 'relative', overflow: 'visible', marginTop: '8%' }}>

          {/* Legenda toggle knop */}
          <button
            onClick={() => setShowLegend(v => !v)}
            title={showLegend ? t('hideLegend') : t('showLegend')}
            style={{
              position: 'absolute', top: '-28px', right: '0',
              background: showLegend ? 'rgba(212,175,55,0.25)' : 'rgba(30,41,59,0.7)',
              color: showLegend ? '#d4af37' : '#94a3b8',
              border: `1px solid ${showLegend ? '#d4af37' : '#475569'}`,
              borderRadius: '4px', padding: '2px 7px', fontSize: '0.7rem',
              cursor: 'pointer', zIndex: 20, backdropFilter: 'blur(4px)',
            }}
          >{t('legendBtn')}</button>
          <img
            src={ensembleImg}
            alt="Kendang Ensemble"
            style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.4)) drop-shadow(0 0 18px rgba(255,255,255,0.18))' }}
          />

          {/* Gong — zweeft boven de trommelset */}
          <img
            src={gongImg}
            alt="Gong"
            onClick={() => onGongTrigger && onGongTrigger()}
            title="Gong"
            style={{
              position: 'absolute',
              top: '-12%',
              left: '46%',
              transform: 'translateX(-50%)',
              width: '22%',
              cursor: 'pointer',
              filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.55)) drop-shadow(0 0 7px rgba(255,255,255,0.32))',
              boxShadow: gongActive
                ? '0 0 12px 4px rgba(212,175,55,1), 0 0 28px 10px rgba(212,175,55,0.55)'
                : 'none',
              transition: 'box-shadow 0.15s, transform 0.1s',
              borderRadius: '50%',
              zIndex: 10
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(0.92)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; }}
          />

          {DRUMS.map(drum => (
            <DrumZone key={drum.id} drum={drum} onTrigger={onTrigger} />
          ))}

          {/* ── Rest-knop (absoluut gepositioneerd) ── */}
          <button
            className="img-hit-zone rest-zone"
            style={{
              position: 'absolute',
              top: '88%',
              left: '46%',
              transform: 'translate(-50%, -50%)',
              background: inputMode === 'anak' ? '#222' : '#511',
              borderColor: inputMode === 'anak' ? '#555' : '#f77',
              color: '#fff',
              width: '30px',
              height: '30px',
              minWidth: 'unset',
              borderRadius: '50%',
              padding: '0',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 20,
            }}
            onClick={() => onTrigger('.')}
            title={t('restBtn')}
          >
            <span className="kendang-symbol" style={{ fontSize: '0.9rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>.</span>
          </button>
        </div>

      </div>
      </>}
    </section>
  );
};

export default DrumPad;
