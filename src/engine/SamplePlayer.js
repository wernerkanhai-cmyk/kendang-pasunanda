/**
 * SamplePlayer — laadt alle WAV-samples en speelt ze af met random variatie (1 van 4).
 * Ondersteunt twee sample sets: 'kendang' en 'vox'.
 * Bij 'vox': combislagen worden herkend en als combo-sample afgespeeld.
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

// Combislagen: gesorteerd paar van sounds → combo naam
// Sleutel = twee sound-namen alfabetisch gesorteerd, samengevoegd met '+'
const COMBO_MAP = {
  'dong+pak':   'bang',   // Pak + Dong
  'dong+pang':  'blang',  // Pang + Dong
  'det+plak':   'blap',   // Plak + Det
  'pang+tung':  'plang',  // Pang + Tung
  'peung+tung': 'tleung', // Peung + Tung
  'peung+ting': 'pleung', // Peung + Ting
};

// Bestandsnaam-kapitalisatie voor VOX samples
const VOX_SOUND_FILE = {
  tung: 'Tung', dong: 'Dong', ting: 'Ting', det: 'Det',
  dededet: 'Dedet', pling: 'Pling', pang: 'Pang', ping: 'Ping',
  pong: 'Pong', plak: 'Plak', pak: 'Pak', peung: 'Peung',
};

const VOX_COMBO_FILE = {
  bang: 'Bang', blang: 'Blang', blap: 'Blap',
  plang: 'Plang', tleung: 'Tleung', pleung: 'Pleung',
};

const TRACKS = ['anak', 'indung'];
const SOUNDS = Object.values(SYMBOL_TO_SOUND).filter((v, i, a) => a.indexOf(v) === i);
const VARIANTS = 4;

export class SamplePlayer {
  constructor() {
    this.audioCtx = null;
    this.buffers    = {};  // kendang buffers: key → AudioBuffer
    this.voxBuffers = {};  // vox buffers: key → AudioBuffer
    this.settings   = {};
    this.sampleSet  = 'kendang'; // 'kendang' | 'vox'
  }

  updateSettings(settings) {
    this.settings = settings || {};
  }

  setSampleSet(set) {
    this.sampleSet = set;
    if (set === 'vox' && Object.keys(this.voxBuffers).length === 0) {
      this.loadVox();
    }
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

      // Reguliere samples
      for (const [sound, fileName] of Object.entries(VOX_SOUND_FILE)) {
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
    try {
      const silent = this.audioCtx.createBuffer(1, 1, this.audioCtx.sampleRate);
      const src = this.audioCtx.createBufferSource();
      src.buffer = silent;
      src.connect(this.audioCtx.destination);
      src.start(this.audioCtx.currentTime);
    } catch {}
  }

  async _load(key, url, target) {
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn('[SamplePlayer] 404:', url); return; }
      const arr = await res.arrayBuffer();
      target[key] = await this.audioCtx.decodeAudioData(arr);
    } catch (e) {
      console.warn('[SamplePlayer] load error:', url, e);
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
