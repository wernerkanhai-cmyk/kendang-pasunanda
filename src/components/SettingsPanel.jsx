import { useState } from 'react';
import { DEFAULT_SOUND_SETTINGS } from '../engine/SamplePlayer';
import { useT } from '../i18n';

const SOUND_LABELS = {
  tung: 'Tung', dong: 'Dong', ting: 'Ting', det: 'Det',
  dededet: 'Dededet', pling: 'Pling', pang: 'Pang',
  ping: 'Ping', pong: 'Pong', plak: 'Plak', pak: 'Pak',
  peung: 'Peung', gong: 'Gong',
};

const PER_SOUND_DEFAULT = { gain: 1.0, pitch: 1.0 };
const pitchToSemitones = (pitch) => Math.round(12 * Math.log2(pitch) * 10) / 10;
const semitonesToPitch = (st) => Math.pow(2, st / 12);

export default function SoundSettingsContent({
  settings,
  onChange,
  onPlay,
  cursorOffsetMs = 0,
  onCursorOffsetChange,
  // Tracks komen uit instrumentPack — gebruikt om de track-tabs op te bouwen.
  tracks,
  // Pack-selector props (optioneel — alleen getoond als availablePacks meegegeven is)
  availablePacks,
  notationPackId,
  onNotationPackChange,
  voicePackId,
  onVoicePackChange,
}) {
  const t = useT();
  const showPackSelectors = !!availablePacks;

  const trackList = Array.isArray(tracks) && tracks.length > 0
    ? tracks
    : [{ id: 'anak', label: 'Anak' }, { id: 'indung', label: 'Indung' }];

  const [activeTrack, setActiveTrack] = useState(trackList[0]?.id);
  // Als de pack wisselt en de huidige activeTrack bestaat niet meer in de
  // nieuwe lijst, switch naar de eerste beschikbare track.
  if (!trackList.find(t => t.id === activeTrack)) {
    setActiveTrack(trackList[0]?.id);
  }

  const trackSettings = settings?.tracks?.[activeTrack] || {};
  const trackDefaults = DEFAULT_SOUND_SETTINGS.tracks?.[activeTrack] || {};
  const auxSettings = settings?.aux || {};
  const auxDefaults = DEFAULT_SOUND_SETTINGS.aux || {};

  // Welke geluiden hebben we hier? Track-sounds + alle aux (zoals gong).
  const trackSoundIds = Object.keys(trackDefaults).length > 0
    ? Object.keys(trackDefaults)
    : Object.keys(trackSettings);
  const auxIds = Object.keys(auxDefaults).length > 0
    ? Object.keys(auxDefaults)
    : Object.keys(auxSettings);

  const handleTrackGain = (sound, value) =>
    onChange({
      ...settings,
      tracks: {
        ...settings.tracks,
        [activeTrack]: {
          ...settings.tracks?.[activeTrack],
          [sound]: { ...PER_SOUND_DEFAULT, ...settings.tracks?.[activeTrack]?.[sound], gain: parseFloat(value) },
        },
      },
    });

  const handleTrackPitch = (sound, semitones) =>
    onChange({
      ...settings,
      tracks: {
        ...settings.tracks,
        [activeTrack]: {
          ...settings.tracks?.[activeTrack],
          [sound]: { ...PER_SOUND_DEFAULT, ...settings.tracks?.[activeTrack]?.[sound], pitch: semitonesToPitch(parseFloat(semitones)) },
        },
      },
    });

  const handleTrackResetSound = (sound) =>
    onChange({
      ...settings,
      tracks: {
        ...settings.tracks,
        [activeTrack]: {
          ...settings.tracks?.[activeTrack],
          [sound]: { ...(trackDefaults[sound] || PER_SOUND_DEFAULT) },
        },
      },
    });

  const handleAuxGain = (auxId, value) =>
    onChange({
      ...settings,
      aux: { ...settings.aux, [auxId]: { ...PER_SOUND_DEFAULT, ...settings.aux?.[auxId], gain: parseFloat(value) } },
    });

  const handleAuxPitch = (auxId, semitones) =>
    onChange({
      ...settings,
      aux: { ...settings.aux, [auxId]: { ...PER_SOUND_DEFAULT, ...settings.aux?.[auxId], pitch: semitonesToPitch(parseFloat(semitones)) } },
    });

  const handleAuxResetSound = (auxId) =>
    onChange({
      ...settings,
      aux: { ...settings.aux, [auxId]: { ...(auxDefaults[auxId] || PER_SOUND_DEFAULT) } },
    });

  const handleResetAllForTrack = () =>
    onChange({
      ...settings,
      tracks: { ...settings.tracks, [activeTrack]: { ...trackDefaults } },
    });

  const selectStyle = {
    flex: 1, background: '#0f172a', color: '#e2e8f0',
    border: '1px solid #334155', borderRadius: '4px',
    fontSize: '0.7rem', padding: '0.2rem 0.3rem',
  };
  const labelStyle = { color: '#64748b', fontSize: '0.65rem', minWidth: '4.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' };

  const renderRow = (sound, current, def, onGain, onPitch, onReset, isAux = false) => {
    const s = current || def || PER_SOUND_DEFAULT;
    const st = pitchToSemitones(s.pitch ?? 1.0);
    const safeDef = def || PER_SOUND_DEFAULT;
    const isDefault = Math.abs((s.gain ?? 1.0) - safeDef.gain) < 0.01 && Math.abs((s.pitch ?? 1.0) - safeDef.pitch) < 0.001;
    const previewable = !!onPlay && !isAux;
    return (
      <div key={sound} style={{ display: 'grid', gridTemplateColumns: '4.5rem 1fr 1fr 1.5rem', gap: '0.4rem', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid #1a2535' }}>
        <span
          onClick={() => { if (previewable) onPlay(sound, activeTrack); }}
          style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 'bold', cursor: previewable ? 'pointer' : 'default', userSelect: 'none' }}
          title={previewable ? 'Tik om te beluisteren' : undefined}
        >{SOUND_LABELS[sound] || sound}</span>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
          <input type="range" min="0" max="4" step="0.1" value={s.gain ?? 1.0}
            onChange={e => onGain(sound, e.target.value)}
            style={{ width: '100%', accentColor: '#3b82f6' }} />
          <span style={{ color: '#94a3b8', fontSize: '0.6rem' }}>{(s.gain ?? 1.0).toFixed(1)}×</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
          <input type="range" min="-12" max="12" step="0.5" value={st}
            onChange={e => onPitch(sound, e.target.value)}
            style={{ width: '100%', accentColor: '#a78bfa' }} />
          <span style={{ color: '#94a3b8', fontSize: '0.6rem' }}>{st >= 0 ? '+' : ''}{st} st</span>
        </div>

        <button onClick={() => onReset(sound)} disabled={isDefault}
          style={{ background: 'transparent', border: 'none', color: isDefault ? '#1e3a5f' : '#64748b', cursor: isDefault ? 'default' : 'pointer', fontSize: '1rem', padding: 0 }}
          title="Reset">↺</button>
      </div>
    );
  };

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
      {/* Pack-selectors */}
      {showPackSelectors && (
        <div style={{ borderBottom: '1px solid #334155', paddingBottom: '0.4rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {availablePacks.notation?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={labelStyle}>Notatie</span>
              <select value={notationPackId || ''} onChange={(e) => onNotationPackChange?.(e.target.value)} style={selectStyle}>
                {availablePacks.notation.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </div>
          )}
          {availablePacks.voice?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={labelStyle}>Stem</span>
              <select value={voicePackId || ''} onChange={(e) => onVoicePackChange?.(e.target.value || null)} style={selectStyle}>
                <option value="">— geen vocale stem —</option>
                {availablePacks.voice.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Track-tabs */}
      {trackList.length > 1 && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '0.4rem', borderBottom: '1px solid #334155', paddingBottom: '0.3rem' }}>
          {trackList.map(track => (
            <button
              key={track.id}
              onClick={() => setActiveTrack(track.id)}
              style={{
                flex: 1,
                background: activeTrack === track.id ? '#334155' : 'transparent',
                color: activeTrack === track.id ? '#e2e8f0' : '#64748b',
                border: '1px solid',
                borderColor: activeTrack === track.id ? '#3b82f6' : '#334155',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >{track.label || track.id}</button>
          ))}
        </div>
      )}

      {/* Reset all for active track + column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '4.5rem 1fr 1fr 1.5rem', gap: '0.4rem', marginBottom: '0.25rem', paddingBottom: '0.25rem', borderBottom: '1px solid #334155', alignItems: 'center' }}>
        <button
          onClick={handleResetAllForTrack}
          style={{ background: 'transparent', border: '1px solid #475569', borderRadius: '4px', color: '#94a3b8', padding: '0.15rem 0.3rem', cursor: 'pointer', fontSize: '0.65rem', gridColumn: '1' }}
          title={`Reset alle waarden voor ${activeTrack}`}
        >{t('resetAll')}</button>
        <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>{t('volumeLabel')}</span>
        <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>{t('pitchLabel')}</span>
        <span />
      </div>

      {/* Track-sounds */}
      {trackSoundIds.map(sound =>
        renderRow(sound, trackSettings[sound], trackDefaults[sound], handleTrackGain, handleTrackPitch, handleTrackResetSound, false)
      )}

      {/* Auxiliary (gong) — track-onafhankelijk */}
      {auxIds.length > 0 && (
        <>
          <div style={{ marginTop: '0.5rem', paddingTop: '0.3rem', borderTop: '1px solid #334155', color: '#64748b', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
            Aux
          </div>
          {auxIds.map(auxId =>
            renderRow(auxId, auxSettings[auxId], auxDefaults[auxId], handleAuxGain, handleAuxPitch, handleAuxResetSound, true)
          )}
        </>
      )}

      {/* Cursor-audio sync offset */}
      {onCursorOffsetChange && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem', flex: 1 }}>{t('cursorSyncOffsetTitle')}</span>
            <span style={{ color: '#e2e8f0', fontSize: '0.7rem', minWidth: '4rem', textAlign: 'right' }}>{cursorOffsetMs} ms</span>
            <button
              onClick={() => onCursorOffsetChange(0)}
              style={{ background: 'transparent', border: 'none', color: cursorOffsetMs === 0 ? '#1e3a5f' : '#64748b', cursor: cursorOffsetMs === 0 ? 'default' : 'pointer', fontSize: '1rem', padding: 0 }}
              title="Reset">↺</button>
          </div>
          <input type="range" min="-3000" max="500" step="25" value={cursorOffsetMs}
            onChange={e => onCursorOffsetChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#f59e0b' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.6rem' }}>
            <span>-3000ms</span><span>0</span><span>+500ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
