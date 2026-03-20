import React from 'react';
import { DEFAULT_SOUND_SETTINGS } from '../engine/SamplePlayer';

const SOUND_LABELS = {
  tung: 'Tung', dong: 'Dong', ting: 'Ting', det: 'Det',
  dededet: 'Dededet', pling: 'Pling', pang: 'Pang',
  ping: 'Ping', pong: 'Pong', plak: 'Plak', pak: 'Pak',
  peung: 'Peung', gong: 'Gong',
};

const pitchToSemitones = (pitch) => Math.round(12 * Math.log2(pitch) * 10) / 10;
const semitonesToPitch = (st) => Math.pow(2, st / 12);

export default function SettingsPanel({ settings, onChange, onClose }) {
  const handleGain = (sound, value) =>
    onChange({ ...settings, [sound]: { ...settings[sound], gain: parseFloat(value) } });

  const handlePitch = (sound, semitones) =>
    onChange({ ...settings, [sound]: { ...settings[sound], pitch: semitonesToPitch(parseFloat(semitones)) } });

  const handleReset = (sound) =>
    onChange({ ...settings, [sound]: { ...DEFAULT_SOUND_SETTINGS[sound] } });

  const handleResetAll = () => onChange({ ...DEFAULT_SOUND_SETTINGS });

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', minWidth: '360px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: '0.9rem' }}>Geluid instellingen</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleResetAll} style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '4px', color: '#94a3b8', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>Reset alles</button>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '4px', color: '#94a3b8', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '5.5rem 1fr 1fr 1.5rem', gap: '0.5rem', marginBottom: '0.25rem', paddingBottom: '0.25rem', borderBottom: '1px solid #334155' }}>
          <span />
          <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>Volume</span>
          <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>Toonhoogte</span>
          <span />
        </div>

        {/* Rows */}
        {Object.keys(SOUND_LABELS).map(sound => {
          const s = settings[sound] || DEFAULT_SOUND_SETTINGS[sound];
          const st = pitchToSemitones(s.pitch ?? 1.0);
          const def = DEFAULT_SOUND_SETTINGS[sound];
          const isDefault = Math.abs((s.gain ?? 1.0) - def.gain) < 0.01 && Math.abs((s.pitch ?? 1.0) - def.pitch) < 0.001;

          return (
            <div key={sound} style={{ display: 'grid', gridTemplateColumns: '5.5rem 1fr 1fr 1.5rem', gap: '0.5rem', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #1a2535' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold' }}>{SOUND_LABELS[sound]}</span>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <input type="range" min="0" max="4" step="0.1" value={s.gain ?? 1.0}
                  onChange={e => handleGain(sound, e.target.value)}
                  style={{ width: '100%', accentColor: '#3b82f6' }} />
                <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{(s.gain ?? 1.0).toFixed(1)}×</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <input type="range" min="-12" max="12" step="0.5" value={st}
                  onChange={e => handlePitch(sound, e.target.value)}
                  style={{ width: '100%', accentColor: '#a78bfa' }} />
                <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{st >= 0 ? '+' : ''}{st} st</span>
              </div>

              <button onClick={() => handleReset(sound)} disabled={isDefault}
                style={{ background: 'transparent', border: 'none', color: isDefault ? '#1e3a5f' : '#64748b', cursor: isDefault ? 'default' : 'pointer', fontSize: '1rem', padding: 0 }}
                title="Reset">↺</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
