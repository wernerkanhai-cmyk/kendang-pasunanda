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

export default function SoundSettingsContent({ settings, onChange }) {
  const handleGain = (sound, value) =>
    onChange({ ...settings, [sound]: { ...settings[sound], gain: parseFloat(value) } });

  const handlePitch = (sound, semitones) =>
    onChange({ ...settings, [sound]: { ...settings[sound], pitch: semitonesToPitch(parseFloat(semitones)) } });

  const handleReset = (sound) =>
    onChange({ ...settings, [sound]: { ...DEFAULT_SOUND_SETTINGS[sound] } });

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
      {/* Reset all + column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '4.5rem 1fr 1fr 1.5rem', gap: '0.4rem', marginBottom: '0.25rem', paddingBottom: '0.25rem', borderBottom: '1px solid #334155', alignItems: 'center' }}>
        <button
          onClick={() => onChange({ ...DEFAULT_SOUND_SETTINGS })}
          style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '4px', color: '#94a3b8', padding: '0.15rem 0.3rem', cursor: 'pointer', fontSize: '0.65rem', gridColumn: '1' }}
        >Reset alles</button>
        <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>Volume</span>
        <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>Toonhoogte</span>
        <span />
      </div>

      {Object.keys(SOUND_LABELS).map(sound => {
        const s = settings[sound] || DEFAULT_SOUND_SETTINGS[sound];
        const st = pitchToSemitones(s.pitch ?? 1.0);
        const def = DEFAULT_SOUND_SETTINGS[sound];
        const isDefault = Math.abs((s.gain ?? 1.0) - def.gain) < 0.01 && Math.abs((s.pitch ?? 1.0) - def.pitch) < 0.001;

        return (
          <div key={sound} style={{ display: 'grid', gridTemplateColumns: '4.5rem 1fr 1fr 1.5rem', gap: '0.4rem', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid #1a2535' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 'bold' }}>{SOUND_LABELS[sound]}</span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
              <input type="range" min="0" max="4" step="0.1" value={s.gain ?? 1.0}
                onChange={e => handleGain(sound, e.target.value)}
                style={{ width: '100%', accentColor: '#3b82f6' }} />
              <span style={{ color: '#94a3b8', fontSize: '0.6rem' }}>{(s.gain ?? 1.0).toFixed(1)}×</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
              <input type="range" min="-12" max="12" step="0.5" value={st}
                onChange={e => handlePitch(sound, e.target.value)}
                style={{ width: '100%', accentColor: '#a78bfa' }} />
              <span style={{ color: '#94a3b8', fontSize: '0.6rem' }}>{st >= 0 ? '+' : ''}{st} st</span>
            </div>

            <button onClick={() => handleReset(sound)} disabled={isDefault}
              style={{ background: 'transparent', border: 'none', color: isDefault ? '#1e3a5f' : '#64748b', cursor: isDefault ? 'default' : 'pointer', fontSize: '1rem', padding: 0 }}
              title="Reset">↺</button>
          </div>
        );
      })}
    </div>
  );
}
