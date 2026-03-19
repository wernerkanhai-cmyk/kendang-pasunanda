import { useEffect } from 'react';

const SongMap = ({ song, activePatternId, open, onClose, onActivate, onMoveUp, onMoveDown }) => {
  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest('.songmap-panel')) onClose();
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.4)',
          }}
          onPointerDown={onClose}
        />
      )}

      {/* Sliding panel */}
      <div
        className="songmap-panel"
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: '200px',
          zIndex: 401,
          background: '#0f172a',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s ease',
          boxShadow: open ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 'bold', letterSpacing: '0.06em' }}>
            COMPOSITIE
          </span>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
            style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '2px 4px' }}
          >✕</button>
        </div>

        {/* Rule list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.4rem 0' }}>
          {song.map((pattern, idx) => {
            const isActive = pattern.id === activePatternId;
            return (
              <div
                key={pattern.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 0.4rem 0 0',
                  background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                  borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                  marginBottom: '1px',
                }}
              >
                {/* Name button */}
                <button
                  onPointerDown={(e) => { e.stopPropagation(); onActivate(pattern.id); onClose(); }}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: isActive ? '#93c5fd' : '#94a3b8',
                    textAlign: 'left',
                    padding: '0.4rem 0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 'bold' : 'normal',
                    cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={pattern.name}
                >
                  <span style={{ color: '#475569', fontSize: '0.65rem', marginRight: '6px' }}>{idx + 1}</span>
                  {pattern.name}
                </button>

                {/* Up/down */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); onMoveUp(pattern.id); }}
                    disabled={idx === 0}
                    style={{
                      background: 'transparent', border: 'none',
                      color: idx === 0 ? '#1e293b' : '#475569',
                      fontSize: '0.6rem', cursor: idx === 0 ? 'default' : 'pointer',
                      padding: '1px 4px', lineHeight: 1,
                    }}
                  >▲</button>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); onMoveDown(pattern.id); }}
                    disabled={idx === song.length - 1}
                    style={{
                      background: 'transparent', border: 'none',
                      color: idx === song.length - 1 ? '#1e293b' : '#475569',
                      fontSize: '0.6rem', cursor: idx === song.length - 1 ? 'default' : 'pointer',
                      padding: '1px 4px', lineHeight: 1,
                    }}
                  >▼</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SongMap;
