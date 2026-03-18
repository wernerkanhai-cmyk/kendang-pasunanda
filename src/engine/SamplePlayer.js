/**
 * SamplePlayer — laadt alle WAV-samples en speelt ze af met random variatie (1 van 4).
 * Bestanden staan in /public/audio/ met naamconventie: {track}_{geluid}_{01-04}.wav
 */

// Volume multiplier per sound (1.0 = normaal)
const SOUND_GAIN = {
  'det': 6.0,
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
  }

  _initCtx() {
    if (!this.audioCtx) {
      // 'interactive' = laagste latency die de browser toestaat
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
          promises.push(this._load(key, `/audio/${key}.wav`));
        }
      }
    }

    // Gong heeft maar 1 sample
    promises.push(this._load('gong_01', '/audio/gong_01.wav'));

    await Promise.allSettled(promises);

    // Warm up: speel een stil 1-frame buffer af zodat de audio pipeline al
    // actief is bij de eerste echte noot. Zonder dit heeft de eerste noot
    // extra opstartlatency.
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
  play(symbol, track, when = 0) {
    if (symbol === '.' || !symbol) return;
    const sound = SYMBOL_TO_SOUND[symbol];
    if (!sound) return;
    const n = String(Math.floor(Math.random() * VARIANTS) + 1).padStart(2, '0');
    this._trigger(`${track}_${sound}_${n}`, when, SOUND_GAIN[sound] ?? 1.0);
  }

  /** Speel de gong af */
  playGong(when = 0) {
    this._trigger('gong_01', when);
  }

  _trigger(key, when, gainValue = 1.0) {
    const buf = this.buffers[key];
    if (!buf || !this.audioCtx) return;

    // Zorg dat de context altijd actief is voor directe weergave
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;

    if (gainValue !== 1.0) {
      const gain = this.audioCtx.createGain();
      gain.gain.value = gainValue;
      src.connect(gain);
      gain.connect(this.audioCtx.destination);
    } else {
      src.connect(this.audioCtx.destination);
    }

    // when > 0: gepland door AudioScheduler (gebruik die tijd exact)
    // when = 0: directe aanslag — gebruik currentTime + 3ms kleine buffer
    //           om underruns te voorkomen zonder hoorbare vertraging
    const t = when > 0 ? when : this.audioCtx.currentTime + 0.003;
    src.start(t);
  }

  /** Geeft de AudioContext terug (zodat AudioScheduler die kan delen) */
  getContext() {
    this._initCtx();
    return this.audioCtx;
  }
}
