/**
 * SamplePlayer — laadt sample-buffers en speelt ze af met random variatie.
 *
 * Pack-driven: configuratie (welke tracks, welke sounds, welke sample-paden,
 * welke combos) komt uit een InstrumentPack en optioneel een VoicePack die
 * vooraf via `setInstrumentPack()` / `setVoicePack()` worden gezet.
 *
 * De klassieke API blijft hetzelfde:
 *   - playSlot(topSymbol, bottomSymbol, track, when, gain, accT, accB)
 *   - play(symbol, track, when, gain)
 *   - playGong(when)
 *   - setSampleSet('kendang' | 'vox')
 *   - loadAll(), waitForVox()
 *
 * `SYMBOL_TO_SOUND` en `DEFAULT_SOUND_SETTINGS` worden nog steeds geëxporteerd
 * voor SettingsPanel / App.jsx — deze worden in een latere stap vervangen door
 * een pack-aware UI.
 */

import { errorLog } from '../utils/errorLog.js';
import { packRegistry, sampleContext, resolveTemplate } from './PackRegistry.js';

// ----- Compat-shim: defaults van de Sundanese pack ----------------------------
// Deze constanten worden nog door SettingsPanel.jsx en App.jsx geconsumeerd.
// Ze zijn de Sunda-kendang defaults (id 'sunda-kendang') en raken vervangen
// zodra de UI pack-aware wordt (stap 4/7).

export const DEFAULT_SOUND_SETTINGS = {
  tung:    { gain: 3.0, pitch: 1.0 },
  dong:    { gain: 3.0, pitch: 1.0 },
  ting:    { gain: 3.0, pitch: 1.0 },
  det:     { gain: 3.0, pitch: 1.0 },
  dededet: { gain: 3.0, pitch: 1.0 },
  pling:   { gain: 3.0, pitch: 1.0 },
  pang:    { gain: 3.0, pitch: 1.0 },
  ping:    { gain: 3.0, pitch: 1.0 },
  pong:    { gain: 3.0, pitch: 1.0 },
  plak:    { gain: 3.0, pitch: 1.0 },
  pak:     { gain: 3.0, pitch: 1.0 },
  peung:   { gain: 3.0, pitch: 1.0 },
  gong:    { gain: 3.0, pitch: 1.0 },
};

export const SYMBOL_TO_SOUND = {
  'N': 'tung',
  'C': 'dong',
  '?': 'ting',
  'V': 'det',
  'S': 'dededet',
  'A': 'pling',
  'J': 'pang',
  ';': 'ping',
  ':': 'pong',
  'L': 'plak',
  'G': 'pak',
  'F': 'peung',
};

// ----- SamplePlayer ----------------------------------------------------------

export class SamplePlayer {
  constructor() {
    this.audioCtx = null;
    this.buffers    = {};   // instrument-buffers: key → AudioBuffer
    this.voxBuffers = {};   // voice-buffers: key → AudioBuffer
    this.transientOffsets = {};
    this.settings   = {};
    this.sampleSet  = 'kendang';   // 'kendang' | 'vox'
    this._voxLoadPromise = null;

    // Pack-state
    this.instrumentPack = null;
    this.voicePack      = null;
    this._instrumentUrls = {};     // sampleKey → resolved URL
    this._voiceUrls      = {};
    this._comboLookup    = {};     // "soundA+soundB" (sorted) → comboId
  }

  /** Stel de actieve InstrumentPack in. Roep VOOR loadAll() aan. */
  setInstrumentPack(pack) {
    this.instrumentPack = pack;
    this._instrumentUrls = pack ? packRegistry.buildInstrumentSampleMap(pack) : {};
  }

  /** Stel de actieve VoicePack in (of `null` om vox uit te schakelen). */
  setVoicePack(pack) {
    this.voicePack = pack;
    if (pack && this.instrumentPack) {
      this._voiceUrls   = packRegistry.buildVoiceSampleMap(pack, this.instrumentPack);
      this._comboLookup = packRegistry.buildComboLookup(pack);
    } else {
      this._voiceUrls   = {};
      this._comboLookup = {};
    }
    // Eventuele voorgaande vox-buffers invalideren.
    this._voxLoadPromise = null;
    this.voxBuffers = {};
    // Als sampleSet al op 'vox' staat, kick de load alsnog af.
    if (this.sampleSet === 'vox' && pack && this.instrumentPack) {
      this._voxLoadPromise = this.loadVox();
    }
  }

  updateSettings(settings) {
    this.settings = settings || {};
  }

  setSampleSet(set) {
    this.sampleSet = set;
    if (set === 'vox' && !this._voxLoadPromise && this.voicePack) {
      this._voxLoadPromise = this.loadVox();
    }
  }

  /** Wacht tot vox samples geladen zijn (resolved direct als al klaar of niet van toepassing). */
  waitForVox() {
    return this._voxLoadPromise || Promise.resolve();
  }

  _initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    }
    if (!this.masterGain) {
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Force-recreate the AudioContext when it's in an unrecoverable state.
   * Re-decodes all loaded samples into the new context.
   */
  async resetAudioContext() {
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (_) {}
    }
    if (this._keepAliveId) { clearInterval(this._keepAliveId); this._keepAliveId = null; }
    this.audioCtx = null;
    this.masterGain = null;

    this._initCtx();
    await this.loadAll();
    if (this.sampleSet === 'vox' && this.voicePack) {
      this._voxLoadPromise = this.loadVox();
      await this._voxLoadPromise;
    }
    this._warmup();
    return this.audioCtx;
  }

  /** Master output node — route all audio through this so it can be silenced. */
  getMasterDestination() {
    if (!this.masterGain) this._initCtx();
    return this.masterGain;
  }

  /** Disconnect the master gain so any pending/queued audio is silenced. */
  silenceAll() {
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch (_) {}
      this.masterGain = null;
    }
  }

  async loadAll() {
    this._initCtx();
    if (!this.instrumentPack) {
      errorLog.warn('SamplePlayer', 'loadAll without instrument pack — nothing to load');
      return;
    }
    const promises = [];
    for (const [key, url] of Object.entries(this._instrumentUrls)) {
      promises.push(this._load(key, url, this.buffers));
    }
    await Promise.allSettled(promises);
    this._warmup();
  }

  async loadVox() {
    this._initCtx();
    if (!this.voicePack || !this.instrumentPack) return;
    const promises = [];
    for (const [key, url] of Object.entries(this._voiceUrls)) {
      promises.push(this._load(key, url, this.voxBuffers));
    }
    await Promise.allSettled(promises);
  }

  _warmup() {
    if (!this.audioCtx) return;
    const doWarmup = () => {
      try {
        const silent = this.audioCtx.createBuffer(1, 1, this.audioCtx.sampleRate);
        const src = this.audioCtx.createBufferSource();
        src.buffer = silent;
        src.connect(this.audioCtx.destination);
        src.start(0);
      } catch (_) {}
    };
    if (this.audioCtx.state === 'running') {
      doWarmup();
    } else {
      this.audioCtx.resume().then(doWarmup);
    }

    // Keep-alive: silent buffer every 20s so iOS doesn't suspend the context.
    if (this._keepAliveId) clearInterval(this._keepAliveId);
    this._keepAliveId = setInterval(() => {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        clearInterval(this._keepAliveId);
        return;
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      try {
        const silent = this.audioCtx.createBuffer(1, 1, this.audioCtx.sampleRate);
        const src = this.audioCtx.createBufferSource();
        src.buffer = silent;
        src.connect(this.audioCtx.destination);
        src.start(0);
      } catch (_) {}
    }, 20000);
  }

  /**
   * Zoek de eerste transient in een AudioBuffer. Geeft de offset in seconden
   * terug (met 1ms veiligheidsmarge, zodat de attack niet wordt afgeknipt).
   */
  _findTransient(buffer, threshold = 0.02) {
    const sr = buffer.sampleRate;
    const channelData = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channelData.push(buffer.getChannelData(c));
    }
    for (let i = 0; i < buffer.length; i++) {
      for (const data of channelData) {
        if (Math.abs(data[i]) > threshold) {
          const margin = Math.floor(sr * 0.001);
          return Math.max(0, (i - margin) / sr);
        }
      }
    }
    return 0;
  }

  async _load(key, url, target) {
    try {
      const res = await fetch(url);
      if (!res.ok) { errorLog.warn('SamplePlayer', '404 loading sample', url); return; }
      const arr = await res.arrayBuffer();
      const buf = await this.audioCtx.decodeAudioData(arr);
      target[key] = buf;
      this.transientOffsets[key] = this._findTransient(buf);
    } catch (e) {
      errorLog.error('SamplePlayer', 'decode error', `${url} — ${e?.message}`);
    }
  }

  _variantsFor(set) {
    if (set === 'vox') return this.voicePack?.samples?.variants || 4;
    return this.instrumentPack?.samples?.variants || 4;
  }

  /**
   * Speel een slot af (top + bottom tegelijk), met combo-detectie in vox-modus.
   */
  playSlot(topSymbol, bottomSymbol, track, when = 0, trackGain = 1.0, accentTop = false, accentBottom = false) {
    const topSound    = topSymbol    && topSymbol    !== '.' ? SYMBOL_TO_SOUND[topSymbol]    : null;
    const bottomSound = bottomSymbol && bottomSymbol !== '.' ? SYMBOL_TO_SOUND[bottomSymbol] : null;

    if (this.sampleSet === 'vox' && topSound && bottomSound) {
      const key = [topSound, bottomSound].sort().join('+');
      const combo = this._comboLookup[key];
      if (combo) {
        const comboGain = trackGain * ((accentTop || accentBottom) ? 1.3 : 1.0);
        this._playVoxCombo(combo, track, when, comboGain);
        return;
      }
    }

    if (topSound)    this._playSingle(topSound,    track, when, trackGain * (accentTop    ? 1.3 : 1.0));
    if (bottomSound) this._playSingle(bottomSound, track, when, trackGain * (accentBottom ? 1.3 : 1.0));
  }

  /** Speel een enkel drumsymbool af (DrumPad / live input) */
  play(symbol, track, when = 0, trackGain = 1.0) {
    if (symbol === '.' || !symbol) return;
    const sound = SYMBOL_TO_SOUND[symbol];
    if (!sound) return;
    this._playSingle(sound, track, when, trackGain);
  }

  _playSingle(sound, track, when, trackGain) {
    const variants = this._variantsFor(this.sampleSet);
    const n = String(Math.floor(Math.random() * variants) + 1).padStart(2, '0');
    const s = this.settings[sound] || DEFAULT_SOUND_SETTINGS[sound] || {};
    const gain = (s.gain ?? 1.0) * trackGain;

    if (this.sampleSet === 'vox') {
      const voxKey = `vox_${track}_${sound}_${n}`;
      if (this.voxBuffers[voxKey]) {
        this._trigger(voxKey, when, gain, s.pitch ?? 1.0, this.voxBuffers);
      } else {
        // Fallback naar instrument-buffer als vox nog niet geladen / sample mist
        const key = `${track}_${sound}_${n}`;
        this._trigger(key, when, gain, s.pitch ?? 1.0, this.buffers);
      }
    } else {
      const key = `${track}_${sound}_${n}`;
      this._trigger(key, when, gain, s.pitch ?? 1.0, this.buffers);
    }
  }

  _playVoxCombo(combo, track, when, trackGain) {
    const variants = this._variantsFor('vox');
    const variant  = Math.floor(Math.random() * variants) + 1;
    const key = `vox_combo_${track}_${combo}_${variant}`;
    this._trigger(key, when, trackGain, 1.0, this.voxBuffers);
  }

  /** Speel de auxiliary "gong" af (uit de InstrumentPack). */
  playGong(when = 0) {
    const auxId = 'gong';
    const aux = this.instrumentPack?.auxiliary?.[auxId];
    if (!aux) return;
    const defaults = aux.defaults || {};
    const s = this.settings[auxId] || defaults;
    this._trigger(auxId, when, s.gain ?? 1.0, s.pitch ?? 1.0, this.buffers);
  }

  _trigger(key, when, gainValue = 1.0, pitchValue = 1.0, buffers) {
    const buf = (buffers || this.buffers)[key];
    if (!buf || !this.audioCtx) return;

    const schedule = (forceNow = false) => {
      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      if (pitchValue !== 1.0) src.playbackRate.value = pitchValue;

      const dest = this.getMasterDestination();
      if (gainValue !== 1.0) {
        const gain = this.audioCtx.createGain();
        gain.gain.value = gainValue;
        src.connect(gain);
        gain.connect(dest);
      } else {
        src.connect(dest);
      }

      const t = forceNow ? this.audioCtx.currentTime + 0.003 : (when > 0 ? when : this.audioCtx.currentTime + 0.003);
      const offset = this.transientOffsets[key] ?? 0;
      src.start(t, offset);
    };

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => schedule(true));
    } else {
      schedule(false);
    }
  }

  /** Geeft de AudioContext terug (zodat AudioScheduler die kan delen) */
  getContext() {
    this._initCtx();
    return this.audioCtx;
  }
}

// resolveTemplate / sampleContext zijn beschikbaar via PackRegistry.js voor
// debug / extensie. Niet hier opnieuw exporteren.
void resolveTemplate; void sampleContext;
