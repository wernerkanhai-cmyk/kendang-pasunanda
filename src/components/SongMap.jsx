import { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useT } from '../i18n';

const SongMap = ({ song, activePatternId, open, topOffset = 0, onClose, onActivate, onMoveUp, onMoveDown, isLocked }) => {
  const t = useT();
  // Close on outside tap — ignore the tap that opened the panel
  useEffect(() => {
    if (!open) return;
    const openedAt = Date.now();
    const close = (e) => {
      if (Date.now() - openedAt < 300) return;
      if (!e.target.closest('.songmap-panel')) onClose();
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open, onClose]);

  return ReactDOM.createPortal(
    <>
      {/* Backdrop — tap to close */}
      {open && (
        <div
          onPointerDown={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Sliding panel */}
      <div
        className="songmap-panel"
        style={{
          position: 'fixed',
          top: topOffset, left: 0, bottom: 0,
          width: '200px',
          zIndex: 401,
          background: 'linear-gradient(180deg, #2c2f37 0%, #191b21 100%)',
          borderRight: '1px solid #2b3650',
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
          padding: '0.6rem 0.85rem',
          background: 'linear-gradient(90deg, #1a1c22 0%, #20232b 16%, #3b3e46 33%, #1c1e24 50%, #3b3e46 67%, #20232b 84%, #1a1c22 100%)',
          borderBottom: '1px solid #2b3650',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.95rem', color: '#f1f5f9', fontWeight: 400, letterSpacing: '0.01em' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.9 }}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            {t('compositionLabel')}
          </span>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '4px 6px' }}
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
                  background: isActive ? 'rgba(59,130,246,0.14)' : (idx % 2 ? 'rgba(255,255,255,0.03)' : 'transparent'),
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

                {/* Up/down — hidden in practice mode */}
                {!isLocked && (
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
};

export default SongMap;
