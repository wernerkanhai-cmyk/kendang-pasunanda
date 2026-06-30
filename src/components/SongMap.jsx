import ReactDOM from 'react-dom';
import { useT } from '../i18n';

const SongMap = ({ song, activePatternId, open, onClose, onActivate, onMoveUp, onMoveDown, isLocked }) => {
  const t = useT();

  // Persistente side-drawer: blijft open tot de gebruiker 'm sluit (✕).
  // Bewust GEEN backdrop / auto-close-op-buiten-tik, en alle interacties op
  // onClick (niet onPointerDown). Zo sluit of activeert scrollen/slepen op touch
  // (iPad) de lijst niet per ongeluk — een tik telt pas bij neer-én-los zonder
  // beweging, een scroll-gebaar dus niet.
  return ReactDOM.createPortal(
    <div
      className="songmap-panel"
      style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: '230px',
        zIndex: 401,
        background: 'var(--panel-bg)',
        borderRight: '1px solid #2b3650',
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease',
        boxShadow: open ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
        // Dicht = buiten beeld geschoven en niet interactief.
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 0.85rem',
        background: 'var(--header-bg)',
        borderBottom: '1px solid #2b3650',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.95rem', color: '#f1f5f9', fontWeight: 400, letterSpacing: '0.01em' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.9 }}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          {t('compositionLabel')}
        </span>
        <button
          onClick={onClose}
          aria-label="Sluiten"
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, padding: '6px 10px' }}
        >✕</button>
      </div>

      {/* Rule list */}
      <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, padding: '0.4rem 0' }}>
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
              {/* Naam — activeren laat de drawer OPEN (sluiten doe je met ✕). */}
              <button
                onClick={() => onActivate(pattern.id)}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: isActive ? '#93c5fd' : '#cbd5e1',
                  textAlign: 'left',
                  padding: '0.55rem 0.5rem',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 'bold' : 'normal',
                  cursor: 'pointer',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                title={pattern.name}
              >
                <span style={{ color: '#64748b', fontSize: '0.65rem', marginRight: '6px' }}>{idx + 1}</span>
                {pattern.name}
              </button>

              {/* Omhoog/omlaag — alleen in edit-modus */}
              {!isLocked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <button
                  onClick={() => onMoveUp(pattern.id)}
                  disabled={idx === 0}
                  aria-label="Regel omhoog"
                  style={{
                    background: 'transparent', border: 'none',
                    color: idx === 0 ? '#334155' : '#94a3b8',
                    fontSize: '0.85rem', cursor: idx === 0 ? 'default' : 'pointer',
                    padding: '4px 8px', lineHeight: 1,
                  }}
                >▲</button>
                <button
                  onClick={() => onMoveDown(pattern.id)}
                  disabled={idx === song.length - 1}
                  aria-label="Regel omlaag"
                  style={{
                    background: 'transparent', border: 'none',
                    color: idx === song.length - 1 ? '#334155' : '#94a3b8',
                    fontSize: '0.85rem', cursor: idx === song.length - 1 ? 'default' : 'pointer',
                    padding: '4px 8px', lineHeight: 1,
                  }}
                >▼</button>
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};

export default SongMap;
