/**
 * SamplePlayer — laadt alle WAV-samples en speelt ze af met random variatie (1 van 4).
 * Ondersteunt twee sample sets: 'kendang' en 'vox'.
 * Bij 'vox': combislagen worden herkend en als combo-sample afgespeeld.
 */

import { errorLog } from '../utils/errorLog.js';

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

// Combislagen: gesorteerd paar van sounds → combo naam
// Sleutel = twee sound-namen alfabetisch gesorteerd, samengevoegd met '+'
// Alleen combinaties waarvoor ook daadwerkelijk sample-bestanden bestaan
const COMBO_MAP = {
  'dong+pak':   'bang',   // Pak + Dong
  'dong+pang':  'blang',  // Pang + Dong
  'det+plak':   'blap',   // Plak + Det
  'pang+tung':  'plang',  // Pang + Tung
  'peung+tung': 'tleung', // Peung + Tung
  // 'peung+ting': 'pleung' — sample-bestanden bestaan niet, weggelaten
};

// Bestandsnaam-kapitalisatie voor VOX samples per track
// Pling bestaat alleen voor ANAK — niet voor INDUNG
const VOX_SOUND_FILE_ANAK   = { tung: 'Tung', dong: 'Dong', ting: 'Ting', det: 'Det', dededet: 'Dedet', pling: 'Pling', pang: 'Pang', ping: 'Ping', pong: 'Pong', plak: 'Plak', pak: 'Pak', peung: 'Peung' };
const VOX_SOUND_FILE_INDUNG = { tung: 'Tung', dong: 'Dong', ting: 'Ting', det: 'Det', dededet: 'Dedet',               pang: 'Pang', ping: 'Ping', pong: 'Pong', plak: 'Plak', pak: 'Pak', peung: 'Peung' };

const VOX_COMBO_FILE = {
  bang: 'Bang', blang: 'Blang', blap: 'Blap',
  plang: 'Plang', tleung: 'Tleung',
  // pleung: 'Pleung' — sample-bestanden bestaan niet
};

const TRACKS = ['anak', 'indung'];
const SOUNDS = Object.values(SYMBOL_TO_SOUND).filter((v, i, a) => a.indexOf(v) === i);
const VARIANTS = 4;

export class SamplePlayer {
  constructor() {
    this.audioCtx = null;
    this.buffers    = {};  // kendang buffers: key → AudioBuffer
    this.voxBuffers = {};  // vox buffers: key → AudioBuffer
    this.transientOffsets = {}; // key → seconds offset tot eerste transient
    this.settings   = {};
    this.sampleSet  = 'kendang'; // 'kendang' | 'vox'
    this._voxLoadPromise = null; // Promise die resolved als vox klaar is
  }

  updateSettings(settings) {
    this.settings = settings || {};
  }

  setSampleSet(set) {
    this.sampleSet = set;
    if (set === 'vox' && !this._voxLoadPromise) {
      this._voxLoadPromise = this.loadVox();
    }
  }

  /** Wacht tot vox samples geladen zijn (resolved direct als al klaar) */
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
    const promises = [];

    // Sounds per track — pling bestaat alleen voor anak
    const ANAK_SOUNDS   = SOUNDS;
    const INDUNG_SOUNDS = SOUNDS.filter(s => s !== 'pling');

    for (const track of TRACKS) {
      const trackSounds = track === 'anak' ? ANAK_SOUNDS : INDUNG_SOUNDS;
      for (const sound of trackSounds) {
        for (let i = 1; i <= VARIANTS; i++) {
          const n = String(i).padStart(2, '0');
          const key = `${track}_${sound}_${n}`;
          promises.push(this._load(key, `${import.meta.env.BASE_URL}audio/${key}.wav`, this.buffers));
        }
      }
    }

    promises.push(this._load('gong_01', `${import.meta.env.BASE_URL}audio/gong_01.wav`, this.buffers));

    await Promise.allSettled(promises);
    this._warmup();
  }

  async loadVox() {
    this._initCtx();
    const base = `${import.meta.env.BASE_URL}audio/KENDANG%20VOX/`;
    const promises = [];

    for (const track of TRACKS) {
      const trackFolder = track === 'anak' ? 'ANAK' : 'INDUNG';
      const trackUpper  = track === 'anak' ? 'ANAK' : 'INDUNG';

      // Reguliere samples — pling bestaat alleen voor anak
      const soundFile = track === 'anak' ? VOX_SOUND_FILE_ANAK : VOX_SOUND_FILE_INDUNG;
      for (const [sound, fileName] of Object.entries(soundFile)) {
        for (let i = 1; i <= VARIANTS; i++) {
          const n = String(i).padStart(2, '0');
          const key = `vox_${track}_${sound}_${n}`;
          const url = `${base}${trackFolder}/VOX_${trackUpper}_${fileName}_${n}.wav`;
          promises.push(this._load(key, url, this.voxBuffers));
        }
      }

      // Combo samples
      for (const [combo, fileName] of Object.entries(VOX_COMBO_FILE)) {
        for (let i = 1; i <= VARIANTS; i++) {
          const key = `vox_combo_${track}_${combo}_${i}`;
          let url;
          if (track === 'anak') {
            url = `${base}ANAK/COMBO/VOX_ANAK_COMBO_${fileName}0${i}.wav`;
          } else {
            url = `${base}INDUNG/COMBO/VOX_INDUNG_${fileName}0${i}.wav`;
          }
          promises.push(this._load(key, url, this.voxBuffers));
        }
      }
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
  }

  /**
   * Zoek de eerste transient in een AudioBuffer.
   * Scant alle kanalen sample voor sample tot de amplitude > threshold.
   * Geeft de offset in seconden terug (met 1ms veiligheidsmarge).
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
          // 1ms veiligheidsmarge — zodat de attack niet wordt afgeknipt
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

  /**
   * Speel een slot af (top + bottom tegelijk), met combo-detectie in vox-modus.
   * Als sampleSet === 'vox' en de twee sounds vormen een combo: speel de combo.
   */
  playSlot(topSymbol, bottomSymbol, track, when = 0, trackGain = 1.0) {
    const topSound    = topSymbol    && topSymbol    !== '.' ? SYMBOL_TO_SOUND[topSymbol]    : null;
    const bottomSound = bottomSymbol && bottomSymbol !== '.' ? SYMBOL_TO_SOUND[bottomSymbol] : null;

    if (this.sampleSet === 'vox' && topSound && bottomSound) {
      const key = [topSound, bottomSound].sort().join('+');
      const combo = COMBO_MAP[key];
      if (combo) {
        this._playVoxCombo(combo, track, when, trackGain);
        return;
      }
    }

    // Geen combo: speel individueel
    if (topSound)    this._playSingle(topSound,    track, when, trackGain);
    if (bottomSound) this._playSingle(bottomSound, track, when, trackGain);
  }

  /** Speel een enkel drumsymbool af (bijv. vanuit DrumPad of live input) */
  play(symbol, track, when = 0, trackGain = 1.0) {
    if (symbol === '.' || !symbol) return;
    const sound = SYMBOL_TO_SOUND[symbol];
    if (!sound) return;
    this._playSingle(sound, track, when, trackGain);
  }

  _playSingle(sound, track, when, trackGain) {
    const n = String(Math.floor(Math.random() * VARIANTS) + 1).padStart(2, '0');
    const s = this.settings[sound] || DEFAULT_SOUND_SETTINGS[sound] || {};
    const gain = (s.gain ?? 1.0) * trackGain;

    if (this.sampleSet === 'vox') {
      const voxKey = `vox_${track}_${sound}_${n}`;
      if (this.voxBuffers[voxKey]) {
        this._trigger(voxKey, when, gain, s.pitch ?? 1.0, this.voxBuffers);
      } else {
        // Fallback naar kendang-buffer als vox nog niet geladen is
        const key = `${track}_${sound}_${n}`;
        this._trigger(key, when, gain, s.pitch ?? 1.0, this.buffers);
      }
    } else {
      const key = `${track}_${sound}_${n}`;
      this._trigger(key, when, gain, s.pitch ?? 1.0, this.buffers);
    }
  }

  _playVoxCombo(combo, track, when, trackGain) {
    const variant = Math.floor(Math.random() * VARIANTS) + 1;
    const key = `vox_combo_${track}_${combo}_${variant}`;
    this._trigger(key, when, trackGain, 1.0, this.voxBuffers);
  }

  /** Speel de gong af */
  playGong(when = 0) {
    const s = this.settings['gong'] || DEFAULT_SOUND_SETTINGS['gong'] || {};
    this._trigger('gong_01', when, s.gain ?? 1.0, s.pitch ?? 1.0, this.buffers);
  }

  _trigger(key, when, gainValue = 1.0, pitchValue = 1.0, buffers) {
    const buf = (buffers || this.buffers)[key];
    if (!buf || !this.audioCtx) return;

    const schedule = () => {
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

      const t = when > 0 ? when : this.audioCtx.currentTime + 0.003;
      const offset = this.transientOffsets[key] ?? 0;
      src.start(t, offset);
    };

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(schedule);
    } else {
      schedule();
    }
  }

  /** Geeft de AudioContext terug (zodat AudioScheduler die kan delen) */
  getContext() {
    this._initCtx();
    return this.audioCtx;
  }
}
