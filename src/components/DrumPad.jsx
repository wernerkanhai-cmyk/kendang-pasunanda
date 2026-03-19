import React, { useState } from 'react';
import ensembleImg from '../assets/drums_ensemble.png';
import gongImg from '../assets/Gong.png';
import './DrumPad.css';

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

const DRUMS = [
  {
    id: 'ketipung', label: 'Ketipung',
    top: '31%', left: '18%', size: '18%',
    zones: [
      { symbol: 'N', track: 'anak', name: 'Tung', a1: 0, a2: 360, fill: 'rgba(55,50,65,0.55)' }
    ]
  },
  {
    id: 'gedug', label: 'Gedug',
    top: '62%', left: '33%', size: '29%',
    zones: [
      { symbol: 'C', track: 'indung', name: 'Dong', a1: 300, a2: 60,  fill: 'rgba(55,40,25,0.65)' },
      { symbol: '?', track: 'indung', name: 'Ting', a1: 60,  a2: 180, fill: 'rgba(80,65,40,0.55)' },
      { symbol: 'V', track: 'indung', name: 'Det',  a1: 180, a2: 300, fill: 'rgba(65,50,30,0.55)' }
    ]
  },
  {
    id: 'kumpyang', label: 'Kumpyang',
    top: '62%', left: '59%', size: '26%',
    zones: [
      { symbol: 'A', track: 'indung', name: 'Pling', a1: 270, a2: 342, fill: 'rgba(65,65,70,0.55)' },
      { symbol: 'J', track: 'indung', name: 'Pang',  a1: 342, a2: 54,  fill: 'rgba(72,72,78,0.55)' },
      { symbol: ';', track: 'indung', name: 'Ping',  a1: 54,  a2: 126, fill: 'rgba(60,60,65,0.55)' },
      { symbol: ':', track: 'indung', name: 'Pong',  a1: 126, a2: 198, fill: 'rgba(55,55,60,0.55)' },
      { symbol: 'L', track: 'indung', name: 'Plak',  a1: 198, a2: 270, fill: 'rgba(18,18,22,0.85)' }
    ]
  },
  {
    id: 'kutiplak', label: 'Kutiplak',
    top: '41%', left: '77%', size: '19%',
    zones: [
      { symbol: 'G', track: 'anak', name: 'Pak',   a1: 270, a2: 450, fill: 'rgba(70,70,80,0.55)' },
      { symbol: 'F', track: 'anak', name: 'Peung', a1: 90,  a2: 270, fill: 'rgba(85,85,95,0.50)' }
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
            onClick={() => onTrigger(drum.zones[0].symbol, drum.zones[0].track)}
            style={{ cursor: 'pointer' }}
            title={`${drum.zones[0].name} (${drum.zones[0].symbol})`}
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
                onClick={() => onTrigger(z.symbol, z.track)}
                style={{ cursor: 'pointer' }}
                title={`${z.name} (${z.symbol})`}
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

const DrumPad = ({ onTrigger, inputMode, onGongTrigger, gongActive = false }) => {
  const [showLegend, setShowLegend] = useState(false);

  const LEGEND = [
    { key: 'N', name: 'Tung' }, { key: 'C', name: 'Dong' }, { key: '?', name: 'Ting' },
    { key: 'V', name: 'Det' },  { key: 'A', name: 'Pling' },{ key: 'J', name: 'Pang' },
    { key: ';', name: 'Ping' }, { key: ':', name: 'Pong' }, { key: 'L', name: 'Plak' },
    { key: 'G', name: 'Pak' },  { key: 'F', name: 'Peung' },{ key: 'S', name: 'Dededet' },
  ];

  return (
    <section className="drum-module glass-panel">
      <div className="drum-module-header">
        {showLegend && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px 6px', marginBottom: '0.4rem' }}>
            {LEGEND.map(({ key, name }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem' }}>
                <kbd style={{ fontSize: '0.6rem', background: '#334155', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '3px', padding: '0 3px', lineHeight: '1.4', fontFamily: 'monospace' }}>{key}</kbd>
                <span className="kendang-font" style={{ fontSize: '0.95rem', color: '#d4af37', lineHeight: 1 }}>{key}</span>
                <span style={{ color: '#94a3b8' }}>{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>

        {/* ── Ensemble foto + gong overlay + pie-chart zones ── */}
        <div style={{ position: 'relative', overflow: 'visible', marginTop: '8%' }}>

          {/* Legenda toggle knop */}
          <button
            onClick={() => setShowLegend(v => !v)}
            title={showLegend ? 'Verberg legenda' : 'Toon legenda'}
            style={{
              position: 'absolute', top: '-28px', right: '0',
              background: showLegend ? 'rgba(212,175,55,0.25)' : 'rgba(30,41,59,0.7)',
              color: showLegend ? '#d4af37' : '#94a3b8',
              border: `1px solid ${showLegend ? '#d4af37' : '#475569'}`,
              borderRadius: '4px', padding: '2px 7px', fontSize: '0.7rem',
              cursor: 'pointer', zIndex: 20, backdropFilter: 'blur(4px)',
            }}
          >ℹ Legenda</button>
          <img
            src={ensembleImg}
            alt="Kendang Ensemble"
            style={{ width: '100%', height: 'auto', display: 'block' }}
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
              filter: gongActive
                ? 'drop-shadow(0 3px 10px rgba(0,0,0,0.55)) drop-shadow(0 0 12px rgba(212,175,55,1)) drop-shadow(0 0 20px rgba(212,175,55,0.6))'
                : 'drop-shadow(0 3px 10px rgba(0,0,0,0.55))',
              transition: 'filter 0.15s, transform 0.1s',
              outline: gongActive ? '2px solid rgba(212,175,55,0.8)' : 'none',
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
            title="Rust (.)"
          >
            <span className="kendang-symbol" style={{ fontSize: '0.9rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>.</span>
          </button>
        </div>

      </div>
    </section>
  );
};

export default DrumPad;
