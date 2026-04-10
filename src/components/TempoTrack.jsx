import { useRef, useState, useEffect } from 'react';
import { useT } from '../i18n';

const BPM_MIN = 20;
const BPM_MAX = 140;
const TRACK_HEIGHT = 60;
const ZOOM_HEIGHT = 160;
const ZOOM_WIDTH = 56;
const ZOOM_HALF = 12; // ±12 BPM visible in zoom panel

const bpmToY = (bpm) =>
  TRACK_HEIGHT * (1 - (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN));

const yToBpm = (y) =>
  Math.round(Math.max(BPM_MIN, Math.min(BPM_MAX,
    BPM_MAX - (y / TRACK_HEIGHT) * (BPM_MAX - BPM_MIN))));

const zoomBpmToY = (b, center) => {
  const lo = Math.max(BPM_MIN, center - ZOOM_HALF);
  const hi = Math.min(BPM_MAX, center + ZOOM_HALF);
  return ZOOM_HEIGHT * (1 - (b - lo) / (hi - lo));
};

const zoomYToBpm = (y, center) => {
  const lo = Math.max(BPM_MIN, center - ZOOM_HALF);
  const hi = Math.min(BPM_MAX, center + ZOOM_HALF);
  return Math.round(Math.max(lo, Math.min(hi, hi - (y / ZOOM_HEIGHT) * (hi - lo))));
};

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

const TempoTrack = ({ pattern, defaultBpm, onUpdate, onToggleEnabled, slotWidth }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tempoTrackRef = useRef([]);
  const zoomSvgRef = useRef(null);
  const zoomDragRef = useRef(null);

  // { slot, bpm, left, top } — zoom popup anchor
  const [zoomedNode, setZoomedNode] = useState(null);

  const totalSlots = pattern.anak.length;
  const totalWidth = Math.max(1, totalSlots * slotWidth);

  const rawTrack = pattern.tempoTrack || [];
  const tempoTrack = [...rawTrack].sort((a, b) => a.slot - b.slot);
  useEffect(() => { tempoTrackRef.current = tempoTrack; });

  // Close zoom panel when clicking outside
  useEffect(() => {
    if (!zoomedNode) return;
    const close = (e) => {
      if (zoomSvgRef.current && !zoomSvgRef.current.closest('.tempo-zoom-panel')?.contains(e.target)) {
        setZoomedNode(null);
      }
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [zoomedNode]);

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
    const scaleX = totalWidth / rect.width;
    return { x: (cx - rect.left) * scaleX, y: cy - rect.top };
  };

  // Double-click: add node + open zoom popup
  const handleDoubleClick = (e) => {
    if (e.target.tagName === 'circle') return;
    const { x, y } = getSvgPos(e);
    const slot = Math.max(0, Math.min(totalSlots - 1, Math.round(x / slotWidth)));
    const bpm = yToBpm(y);
    const newTrack = tempoTrack.filter(n => n.slot !== slot);
    newTrack.push({ slot, bpm });
    newTrack.sort((a, b) => a.slot - b.slot);
    onUpdate(pattern.id, newTrack);

    // Position zoom popup above/below click
    const rect = svgRef.current.getBoundingClientRect();
    const screenX = rect.left + (slot * slotWidth / totalWidth) * rect.width;
    const screenY = rect.top;
    setZoomedNode({ slot, bpm, left: screenX, top: screenY });
  };

  // Drag existing node in main track
  const startDrag = (e, origSlot) => {
    e.stopPropagation();
    e.preventDefault();
    // Capture the pointer so fast moves don't lose the target element
    if (e.pointerId != null && e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }
    dragRef.current = { origSlot, moved: false };

    // Cache the SVG rect at drag start so layout shifts during React
    // re-renders don't cause the node to jump.
    const startRect = svgRef.current?.getBoundingClientRect();
    const scaleX = startRect ? totalWidth / startRect.width : 1;

    const onMove = (ev) => {
      ev.preventDefault();
      const d = dragRef.current;
      if (!d || !startRect) return;
      d.moved = true;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const x = (cx - startRect.left) * scaleX;
      const y = cy - startRect.top;
      const newSlot = Math.max(0, Math.min(totalSlots - 1, Math.round(x / slotWidth)));
      const newBpm = yToBpm(y);
      const prevSlot = d.origSlot;
      const cur = tempoTrackRef.current;
      const newTrack = cur.map(n =>
        n.slot === prevSlot ? { slot: newSlot, bpm: newBpm } : n
      );
      newTrack.sort((a, b) => a.slot - b.slot);
      tempoTrackRef.current = newTrack;
      d.origSlot = newSlot;
      onUpdate(pattern.id, newTrack);
      if (zoomedNode?.slot === prevSlot) {
        setZoomedNode(prev => prev ? { ...prev, slot: newSlot, bpm: newBpm } : null);
      }
    };

    const onEnd = (ev) => {
      const wasMoved = dragRef.current?.moved;
      const slot = dragRef.current?.origSlot;
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      // Pure tap: toggle zoom panel open/dicht
      if (!wasMoved && slot != null && svgRef.current) {
        const node = tempoTrackRef.current.find(n => n.slot === slot);
        if (node) {
          const rect = svgRef.current.getBoundingClientRect();
          const screenX = rect.left + (node.slot * slotWidth / totalWidth) * rect.width;
          setZoomedNode(prev => prev?.slot === slot ? null : { slot: node.slot, bpm: node.bpm, left: screenX, top: rect.top });
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Drag in zoom panel
  const startZoomDrag = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!zoomedNode) return;
    const center = zoomedNode.bpm;

    const getZoomY = (ev) => {
      const rect = zoomSvgRef.current.getBoundingClientRect();
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      return Math.max(0, Math.min(ZOOM_HEIGHT, cy - rect.top));
    };

    const onMove = (ev) => {
      if (!zoomSvgRef.current) return;
      const y = getZoomY(ev);
      const newBpm = zoomYToBpm(y, center);
      const newTrack = tempoTrackRef.current.map(n =>
        n.slot === zoomedNode.slot ? { ...n, bpm: newBpm } : n
      );
      newTrack.sort((a, b) => a.slot - b.slot);
      onUpdate(pattern.id, newTrack);
      setZoomedNode(prev => prev ? { ...prev, bpm: newBpm } : null);
    };

    const onEnd = () => {
      zoomDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  const deleteNode = (e, slot) => {
    e.preventDefault();
    e.stopPropagation();
    const newTrack = tempoTrack.filter(n => n.slot !== slot);
    onUpdate(pattern.id, newTrack);
    if (zoomedNode?.slot === slot) setZoomedNode(null);
  };

  const applyStatic = () => {
    const b = tempoTrack[0]?.bpm ?? defaultBpm;
    onUpdate(pattern.id, [{ slot: 0, bpm: b }]);
  };

  const applyGradual = () => {
    const fromBpm = tempoTrack[0]?.bpm ?? defaultBpm;
    const toBpm = Math.min(BPM_MAX, fromBpm + 20);
    onUpdate(pattern.id, [{ slot: 0, bpm: fromBpm }, { slot: totalSlots - 1, bpm: toBpm }]);
  };

  const clearTrack = () => { onUpdate(pattern.id, []); setZoomedNode(null); };

  const summaryLabel = tempoTrack.length === 0
    ? `${defaultBpm} BPM (globaal)`
    : tempoTrack.length === 1
      ? `${Math.round(tempoTrack[0].bpm)} BPM (statisch)`
      : `${Math.round(Math.min(...tempoTrack.map(n => n.bpm)))}–${Math.round(Math.max(...tempoTrack.map(n => n.bpm)))} BPM`;

  const isActive = tempoTrack.length > 0;
  const enabled = pattern.tempoTrackEnabled !== false;

  // Grid lines for 20-140
  const gridBpms = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
  const labelBpms = [20, 40, 60, 80, 100, 120, 140];

  return (
    <div style={{ marginBottom: '6px', border: `2px solid ${isActive && enabled ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.35)'}`, borderRadius: '4px', overflow: 'visible', position: 'relative' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', cursor: 'pointer', background: open && enabled ? 'rgba(212,175,55,0.22)' : 'rgba(255,255,255,0.08)', userSelect: 'none', minWidth: 0 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: '0.7rem', color: open ? '#d4af37' : '#94a3b8', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 'bold', color: isActive && enabled ? '#d4af37' : '#94a3b8', letterSpacing: '0.05em', flexShrink: 0 }}>{t('tempoLabel')}</span>
        <span style={{ fontSize: '0.65rem', color: isActive && enabled ? '#d4af37' : '#64748b', marginLeft: '2px', flexShrink: 0 }}>{enabled ? summaryLabel : `${defaultBpm} BPM (globaal)`}</span>

        {/* Enable/disable toggle */}
        {onToggleEnabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleEnabled(pattern.id); }}
            style={{
              marginLeft: '4px', padding: '1px 7px', fontSize: '0.62rem', borderRadius: '3px', cursor: 'pointer', flexShrink: 0,
              background: enabled ? '#d4af37' : '#1e293b',
              color: enabled ? '#0f172a' : '#64748b',
              border: `1px solid ${enabled ? '#d4af37' : '#334155'}`,
              fontWeight: 'bold',
            }}
            title={enabled ? 'Disable tempo automation' : 'Enable tempo automation'}
          >{enabled ? 'ON' : 'OFF'}</button>
        )}

        {open && enabled && isActive && (
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }} onClick={e => e.stopPropagation()}>
            <button onClick={clearTrack}
              style={{ padding: '1px 6px', fontSize: '0.62rem', background: '#1e293b', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '3px', cursor: 'pointer' }}>{t('clearTempo')}</button>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      {open && (
        <div style={{ background: 'rgba(0,0,0,0.3)', height: TRACK_HEIGHT + 'px', position: 'relative', opacity: enabled ? 1 : 0.35, pointerEvents: enabled ? 'auto' : 'none' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${totalWidth} ${TRACK_HEIGHT}`}
            preserveAspectRatio="none"
            width="100%"
            height={TRACK_HEIGHT}
            style={{ touchAction: 'none' }}
            style={{ display: 'block', cursor: enabled ? 'crosshair' : 'default', touchAction: 'none' }}
            onDoubleClick={handleDoubleClick}
          >
            {gridBpms.map(b => (
              <line key={b} x1={0} x2={totalWidth} y1={bpmToY(b)} y2={bpmToY(b)}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            ))}
            {Array.from({ length: Math.floor(totalSlots / 48) + 1 }, (_, i) => (
              <line key={i} x1={i * 48 * slotWidth} x2={i * 48 * slotWidth} y1={0} y2={TRACK_HEIGHT}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            ))}
            <polygon points={fillPoints} fill="rgba(212,175,55,0.08)" />
            <polyline points={polyPoints} fill="none" stroke={isActive ? '#d4af37' : '#334155'} strokeWidth={1.5} strokeLinejoin="round" />
            {labelBpms.map(b => (
              <text key={b} x={3} y={bpmToY(b) + 3} fill="rgba(255,255,255,0.2)" fontSize={8} style={{ userSelect: 'none' }}>{b}</text>
            ))}
            {tempoTrack.map((node) => (
              <g
                key={node.slot}
                transform={`translate(${node.slot * slotWidth},${bpmToY(node.bpm)})`}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') startDrag(e, node.slot); }}
                onDoubleClick={(e) => deleteNode(e, node.slot)}
                onContextMenu={(e) => deleteNode(e, node.slot)}
              >
                <circle r={5} fill={zoomedNode?.slot === node.slot ? '#fff' : '#d4af37'} stroke="#1e293b" strokeWidth={1.5} />
                <text x={0} y={-8} textAnchor="middle" fill="#d4af37" fontSize={9} fontWeight="bold" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {Math.round(node.bpm)}
                </text>
              </g>
            ))}
          </svg>

          {/* Zoom popup */}
          {zoomedNode && (() => {
            const center = zoomedNode.bpm;
            const lo = Math.max(BPM_MIN, center - ZOOM_HALF);
            const hi = Math.min(BPM_MAX, center + ZOOM_HALF);
            const tickBpms = Array.from({ length: Math.floor(hi - lo) + 1 }, (_, i) => lo + i).filter(b => b % 2 === 0);
            const curY = zoomBpmToY(zoomedNode.bpm, center);
            return (
              <div
                className="tempo-zoom-panel"
                onPointerDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: TRACK_HEIGHT + 4 + 'px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 300,
                  background: '#0f172a',
                  border: '1px solid #d4af37',
                  borderRadius: '6px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
                  minWidth: ZOOM_WIDTH + 32 + 'px',
                }}
              >
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', userSelect: 'none' }}>Fijn instellen</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#d4af37', userSelect: 'none' }}>
                  {Math.round(zoomedNode.bpm)} BPM
                </div>
                <svg
                  ref={zoomSvgRef}
                  width={ZOOM_WIDTH}
                  height={ZOOM_HEIGHT}
                  style={{ display: 'block', cursor: 'ns-resize', touchAction: 'none' }}
                  onPointerDown={startZoomDrag}
                >
                  {/* background */}
                  <rect x={0} y={0} width={ZOOM_WIDTH} height={ZOOM_HEIGHT} fill="rgba(212,175,55,0.05)" rx={3} />
                  {/* tick lines */}
                  {tickBpms.map(b => {
                    const y = zoomBpmToY(b, center);
                    const isMajor = b % 10 === 0;
                    return (
                      <g key={b}>
                        <line x1={0} x2={ZOOM_WIDTH} y1={y} y2={y}
                          stroke={isMajor ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}
                          strokeWidth={isMajor ? 1 : 0.5} />
                        {isMajor && (
                          <text x={4} y={y - 2} fill="rgba(255,255,255,0.3)" fontSize={7} style={{ userSelect: 'none' }}>{b}</text>
                        )}
                      </g>
                    );
                  })}
                  {/* current bpm line */}
                  <line x1={0} x2={ZOOM_WIDTH} y1={curY} y2={curY} stroke="#d4af37" strokeWidth={2} />
                  {/* handle */}
                  <circle cx={ZOOM_WIDTH / 2} cy={curY} r={7} fill="#d4af37" stroke="#0f172a" strokeWidth={2} />
                </svg>
                {/* ±1 fine buttons */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[-1, +1].map(d => (
                    <button key={d}
                      onPointerDown={e => { e.stopPropagation(); e.preventDefault();
                        const newBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, zoomedNode.bpm + d));
                        const newTrack = tempoTrackRef.current.map(n =>
                          n.slot === zoomedNode.slot ? { ...n, bpm: newBpm } : n
                        );
                        newTrack.sort((a, b) => a.slot - b.slot);
                        onUpdate(pattern.id, newTrack);
                        setZoomedNode(prev => prev ? { ...prev, bpm: newBpm } : null);
                      }}
                      style={{ background: '#1e293b', border: '1px solid #475569', color: '#94a3b8', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >{d > 0 ? '+1' : '−1'}</button>
                  ))}
                </div>
                <button
                  onPointerDown={e => { e.stopPropagation(); setZoomedNode(null); }}
                  style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 6px' }}
                >sluiten</button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default TempoTrack;
