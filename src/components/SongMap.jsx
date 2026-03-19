import { useRef } from 'react';

const SongMap = ({ song, activePatternId, onActivate, onMoveUp, onMoveDown }) => {
  const dragRef = useRef(null);
  const [dragIdx, setDragIdx] = [null, () => {}]; // placeholder — use state below

  return (
    <div style={{
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      padding: '0.4rem 1rem',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.3rem',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 'bold', letterSpacing: '0.05em', flexShrink: 0, marginRight: '0.2rem' }}>
        COMPOSITIE
      </span>
      {song.map((pattern, idx) => {
        const isActive = pattern.id === activePatternId;
        return (
          <div key={pattern.id} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
            <button
              onClick={() => onActivate(pattern.id)}
              style={{
                background: isActive ? '#1e40af' : '#1e293b',
                color: isActive ? '#93c5fd' : '#94a3b8',
                border: `1px solid ${isActive ? '#3b82f6' : '#334155'}`,
                borderRadius: '4px 0 0 4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: isActive ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={pattern.name}
            >
              <span style={{ color: isActive ? '#60a5fa' : '#475569', marginRight: '4px', fontSize: '0.6rem' }}>{idx + 1}</span>
              {pattern.name}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <button
                onClick={() => onMoveUp(pattern.id)}
                disabled={idx === 0}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderLeft: 'none',
                  color: idx === 0 ? '#1e293b' : '#64748b',
                  borderRadius: '0 4px 0 0',
                  padding: '0 0.3rem', fontSize: '0.55rem', cursor: idx === 0 ? 'default' : 'pointer',
                  lineHeight: 1.4, display: 'block',
                }}
              >▲</button>
              <button
                onClick={() => onMoveDown(pattern.id)}
                disabled={idx === song.length - 1}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderLeft: 'none', borderTop: 'none',
                  color: idx === song.length - 1 ? '#1e293b' : '#64748b',
                  borderRadius: '0 0 4px 0',
                  padding: '0 0.3rem', fontSize: '0.55rem', cursor: idx === song.length - 1 ? 'default' : 'pointer',
                  lineHeight: 1.4, display: 'block',
                }}
              >▼</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SongMap;
