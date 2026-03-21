/**
 * SamplePlayer — laadt alle WAV-samples en speelt ze af met random variatie (1 van 4).
 * Bestanden staan in /public/audio/ met naamconventie: {track}_{geluid}_{01-04}.wav
 */

export const DEFAULT_SOUND_SETTINGS = {
  tung:    { gain: 1.0, pitch: 1.0 },
  dong:    { gain: 1.0, pitch: 1.0 },
  ting:    { gain: 1.0, pitch: 1.0 },
  det:     { gain: 3.0, pitch: 1.0 },
  dededet: { gain: 1.0, pitch: 1.0 },
  pling:   { gain: 1.0, pitch: 1.0 },
  pang:    { gain: 1.0, pitch: 1.0 },
  ping:    { gain: 1.0, pitch: 1.0 },
  pong:    { gain: 1.0, pitch: 1.0 },
  plak:    { gain: 1.0, pitch: 1.0 },
  pak:     { gain: 1.0, pitch: 1.0 },
  peung:   { gain: 1.0, pitch: 1.0 },
  gong:    { gain: 1.0, pitch: 1.0 },
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

const TRACKS = ['anak', 'indung'];
const SOUNDS = Object.values(SYMBOL_TO_SOUND).filter((v, i, a) => a.indexOf(v) === i);
const VARIANTS = 4;

export class SamplePlayer {
  constructor() {
    this.audioCtx = null;
    this.buffers = {};   // key → AudioBuffer
    this.settings = {}; // sound → { gain, pitch }
  }

  updateSettings(settings) {
    this.settings = settings || {};
  }

  _initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  async loadAll() {
    this._initCtx();
    const promises = [];

    for (const track of TRACKS) {
      for (const sound of SOUNDS) {
        for (let i = 1; i <= VARIANTS; i++) {
          const n = String(i).padStart(2, '0');
          const key = `${track}_${sound}_${n}`;
          promises.push(this._load(key, `${import.meta.env.BASE_URL}audio/${key}.wav`));
        }
      }
    }

    promises.push(this._load('gong_01', `${import.meta.env.BASE_URL}audio/gong_01.wav`));

    await Promise.allSettled(promises);
    this._warmup();
  }

  _warmup() {
    if (!this.audioCtx) return;
    try {
      const silent = this.audioCtx.createBuffer(1, 1, this.audioCtx.sampleRate);
      const src = this.audioCtx.createBufferSource();
      src.buffer = silent;
      src.connect(this.audioCtx.destination);
      src.start(this.audioCtx.currentTime);
    } catch {}
  }

  async _load(key, url) {
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      this.buffers[key] = await this.audioCtx.decodeAudioData(arr);
    } catch {
      // sample niet gevonden — stil doorgaan
    }
  }

  /** Speel een drumsymbool af (bijv. 'N', 'C', '?') op het opgegeven track */
  play(symbol, track, when = 0, trackGain = 1.0) {
    if (symbol === '.' || !symbol) return;
    const sound = SYMBOL_TO_SOUND[symbol];
    if (!sound) return;
    const n = String(Math.floor(Math.random() * VARIANTS) + 1).padStart(2, '0');
    const s = this.settings[sound] || DEFAULT_SOUND_SETTINGS[sound] || {};
    this._trigger(`${track}_${sound}_${n}`, when, (s.gain ?? 1.0) * trackGain, s.pitch ?? 1.0);
  }

  /** Speel de gong af */
  playGong(when = 0) {
    const s = this.settings['gong'] || DEFAULT_SOUND_SETTINGS['gong'] || {};
    this._trigger('gong_01', when, s.gain ?? 1.0, s.pitch ?? 1.0);
  }

  _trigger(key, when, gainValue = 1.0, pitchValue = 1.0) {
    const buf = this.buffers[key];
    if (!buf || !this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    if (pitchValue !== 1.0) src.playbackRate.value = pitchValue;

    if (gainValue !== 1.0) {
      const gain = this.audioCtx.createGain();
      gain.gain.value = gainValue;
      src.connect(gain);
      gain.connect(this.audioCtx.destination);
    } else {
      src.connect(this.audioCtx.destination);
    }

    const t = when > 0 ? when : this.audioCtx.currentTime + 0.003;
    src.start(t);
  }

  /** Geeft de AudioContext terug (zodat AudioScheduler die kan delen) */
  getContext() {
    this._initCtx();
    return this.audioCtx;
  }
}
