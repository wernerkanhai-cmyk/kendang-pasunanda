import React, { useRef, useState, useEffect } from 'react';

const BPM_MIN = 40;
const BPM_MAX = 240;
const TRACK_HEIGHT = 60;

const bpmToY = (bpm) =>
  TRACK_HEIGHT * (1 - (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN));

const yToBpm = (y) =>
  Math.round(Math.max(BPM_MIN, Math.min(BPM_MAX,
    BPM_MAX - (y / TRACK_HEIGHT) * (BPM_MAX - BPM_MIN))));

/**
 * Interpolate BPM at a given slot from the tempo track.
 * Returns null when tempoTrack is empty (= use global BPM).
 */
export const interpolateBpm = (tempoTrack, localSlot) => {
  if (!tempoTrack || tempoTrack.length === 0) return null;
  const sorted = [...tempoTrack].sort((a, b) => a.slot - b.slot);
  if (localSlot <= sorted[0].slot) return sorted[0].bpm;
  if (localSlot >= sorted[sorted.length - 1].slot) return sorted[sorted.length - 1].bpm;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (localSlot >= sorted[i].slot && localSlot <= sorted[i + 1].slot) {
      const t = (localSlot - sorted[i].slot) / (sorted[i + 1].slot - sorted[i].slot);
      return sorted[i].bpm + t * (sorted[i + 1].bpm - sorted[i].bpm);
    }
  }
  return sorted[sorted.length - 1].bpm;
};

const TempoTrack = ({ pattern, defaultBpm, onUpdate, slotWidth }) => {
  const [open, setOpen] = useState(true);
  const svgRef = useRef(null);
  const dragRef = useRef(null); // { origSlot }
  const tempoTrackRef = useRef([]);

  const totalSlots = pattern.anak.length;
  const totalWidth = Math.max(1, totalSlots * slotWidth);

  const rawTrack = pattern.tempoTrack || [];
  const tempoTrack = [...rawTrack].sort((a, b) => a.slot - b.slot);
  useEffect(() => { tempoTrackRef.current = tempoTrack; });

  // Build polyline points with horizontal extensions to edges
  const buildPoints = (nodes) => {
    if (nodes.length === 0) return `0,${bpmToY(defaultBpm)} ${totalWidth},${bpmToY(defaultBpm)}`;
    let pts = nodes.map(n => `${n.slot * slotWidth},${bpmToY(n.bpm)}`).join(' ');
    if (nodes[0].slot > 0) pts = `0,${bpmToY(nodes[0].bpm)} ${pts}`;
    if (nodes[nodes.length - 1].slot < totalSlots - 1)
      pts = `${pts} ${totalWidth},${bpmToY(nodes[nodes.length - 1].bpm)}`;
    return pts;
  };

  const polyPoints = buildPoints(tempoTrack);
  const fillPoints = `0,${TRACK_HEIGHT} ${polyPoints} ${totalWidth},${TRACK_HEIGHT}`;

  const getSvgPos = (ev) => {
    const rect = svgRef.current.getBoundingClientRect();
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    // Scale screen coords back to SVG viewBox coords
    const scaleX = totalWidth / rect.width;
    return { x: (cx - rect.left) * scaleX, y: cy - rect.top };
  };

  // Double-click on empty area: add node
  const handleDoubleClick = (e) => {
    if (e.target.tagName === 'circle') return;
    const { x, y } = getSvgPos(e);
    const slot = Math.max(0, Math.min(totalSlots - 1, Math.round(x / slotWidth)));
    const bpm = yToBpm(y);
    const newTrack = tempoTrack.filter(n => n.slot !== slot);
    newTrack.push({ slot, bpm });
    newTrack.sort((a, b) => a.slot - b.slot);
    onUpdate(pattern.id, newTrack);
  };

  // Drag node
  const startDrag = (e, origSlot) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { origSlot };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d || !svgRef.current) return;
      const { x, y } = getSvgPos(ev);
      const newSlot = Math.max(0, Math.min(totalSlots - 1, Math.round(x / slotWidth)));
      const newBpm = yToBpm(y);
      const cur = tempoTrackRef.current;
      const newTrack = cur.map(n =>
        n.slot === d.origSlot ? { slot: newSlot, bpm: newBpm } : n
      );
      d.origSlot = newSlot;
      newTrack.sort((a, b) => a.slot - b.slot);
      onUpdate(pattern.id, newTrack);
    };

    const onEnd = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Right-click on node: delete
  const deleteNode = (e, slot) => {
    e.preventDefault();
    e.stopPropagation();
    const newTrack = tempoTrack.filter(n => n.slot !== slot);
    onUpdate(pattern.id, newTrack);
  };

  // Presets
  const applyStatic = () => {
    const bpm = tempoTrack[0]?.bpm ?? defaultBpm;
    onUpdate(pattern.id, [{ slot: 0, bpm }]);
  };

  const applyGradual = () => {
    const fromBpm = tempoTrack[0]?.bpm ?? defaultBpm;
    const toBpm = Math.min(BPM_MAX, fromBpm + 40);
    onUpdate(pattern.id, [{ slot: 0, bpm: fromBpm }, { slot: totalSlots - 1, bpm: toBpm }]);
  };

  const clearTrack = () => onUpdate(pattern.id, []);

  const summaryLabel = tempoTrack.length === 0
    ? `${defaultBpm} BPM (globaal)`
    : tempoTrack.length === 1
      ? `${Math.round(tempoTrack[0].bpm)} BPM (statisch)`
      : `${Math.round(Math.min(...tempoTrack.map(n => n.bpm)))}–${Math.round(Math.max(...tempoTrack.map(n => n.bpm)))} BPM`;

  const isActive = tempoTrack.length > 0;

  return (
    <div style={{ marginBottom: '6px', border: `2px solid ${isActive ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.35)'}`, borderRadius: '4px', overflow: 'visible' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 8px', cursor: 'pointer',
          background: open ? 'rgba(212,175,55,0.22)' : 'rgba(255,255,255,0.08)',
          userSelect: 'none',
          minWidth: 0,
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: '0.7rem', color: open ? '#d4af37' : '#94a3b8', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 'bold', color: isActive ? '#d4af37' : '#94a3b8', letterSpacing: '0.05em', flexShrink: 0 }}>
          ♩ Tempo
        </span>
        <span style={{ fontSize: '0.65rem', color: isActive ? '#d4af37' : '#64748b', marginLeft: '2px', flexShrink: 0 }}>{summaryLabel}</span>

        {open && (
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }} onClick={e => e.stopPropagation()}>
            <button onClick={applyStatic}
              style={{ padding: '1px 6px', fontSize: '0.62rem', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '3px', cursor: 'pointer' }}
              title="Één enkel tempo voor de hele regel">Statisch</button>
            <button onClick={applyGradual}
              style={{ padding: '1px 6px', fontSize: '0.62rem', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '3px', cursor: 'pointer' }}
              title="Geleidelijke versnelling (begin → begin+40 BPM)">Geleidelijk</button>
            {isActive && (
              <button onClick={clearTrack}
                style={{ padding: '1px 6px', fontSize: '0.62rem', background: '#1e293b', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '3px', cursor: 'pointer' }}
                title="Verwijder alle nodes, gebruik globaal tempo">Wis</button>
            )}
            <span style={{ fontSize: '0.58rem', color: '#334155', marginLeft: '2px', lineHeight: '16px', whiteSpace: 'nowrap' }}>
              2× klik = +node · slepen = verplaatsen · rechtsklik = verwijderen
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      {open && (
        <div style={{ background: 'rgba(0,0,0,0.3)', height: TRACK_HEIGHT + 'px', position: 'relative' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${totalWidth} ${TRACK_HEIGHT}`}
            preserveAspectRatio="none"
            width="100%"
            height={TRACK_HEIGHT}
            style={{ display: 'block', cursor: 'crosshair' }}
            onDoubleClick={handleDoubleClick}
          >
            {/* Grid lines at common BPMs */}
            {[60, 80, 100, 120, 160, 200].map(b => (
              <line key={b} x1={0} x2={totalWidth} y1={bpmToY(b)} y2={bpmToY(b)}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            ))}
            {/* Bar separators */}
            {Array.from({ length: Math.floor(totalSlots / 48) + 1 }, (_, i) => (
              <line key={i} x1={i * 48 * slotWidth} x2={i * 48 * slotWidth} y1={0} y2={TRACK_HEIGHT}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            ))}

            {/* Filled area */}
            <polygon points={fillPoints} fill="rgba(212,175,55,0.08)" />

            {/* Tempo line */}
            <polyline points={polyPoints} fill="none" stroke={isActive ? '#d4af37' : '#334155'} strokeWidth={1.5} strokeLinejoin="round" />

            {/* BPM labels */}
            {[60, 120, 180].map(b => (
              <text key={b} x={3} y={bpmToY(b) + 3} fill="rgba(255,255,255,0.2)" fontSize={8} style={{ userSelect: 'none' }}>{b}</text>
            ))}

            {/* Nodes */}
            {tempoTrack.map((node) => (
              <g
                key={node.slot}
                transform={`translate(${node.slot * slotWidth},${bpmToY(node.bpm)})`}
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => { if (e.button === 0) startDrag(e, node.slot); }}
                onTouchStart={(e) => startDrag(e, node.slot)}
                onContextMenu={(e) => deleteNode(e, node.slot)}
              >
                <circle r={5} fill="#d4af37" stroke="#1e293b" strokeWidth={1.5} />
                <text x={0} y={-8} textAnchor="middle" fill="#d4af37" fontSize={9} fontWeight="bold" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {Math.round(node.bpm)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

export default TempoTrack;
