/**
 * VoiceInput — herkent gesproken kendang-klanknamen via Web Speech API
 * en roept onSymbol(symbol) aan zodra een klank is herkend.
 *
 * Mapping: gesproken woord → kendang-symbool (voor handleDrumTrigger)
 */

const WORD_TO_SYMBOL = {
  // Ketipung — tung
  'tung': 'N', 'tong': 'N', 'tongue': 'N', 'tun': 'N', 'ton': 'N', 'tum': 'N',
  // Gedug — dong
  'dong': 'C', 'dung': 'C', 'dung': 'C', 'doong': 'C', 'dooong': 'C',
  // Gedug — ting
  'ting': 'X', 'thing': 'X', 'teen': 'X', 'ding': 'X', 'tink': 'X', 'think': 'X',
  // Gedug — det
  'det':  'V', 'dat':  'V', 'debt': 'V', 'dut': 'V', 'dit': 'V', 'dead': 'V',
  // Kumpyang — pling
  'pling': 'A', 'pling': 'A', 'plink': 'A', 'fling': 'A', 'bling': 'A',
  // Kumpyang — pang
  'pang': 'J', 'bang': 'J', 'fang': 'J',
  // Kumpyang — ping
  'ping': ';', 'bing': ';', 'pink': ';',
  // Kumpyang — pong
  'pong': ':', 'bong': ':',
  // Kumpyang — plak
  'plak': 'L', 'plaque': 'L', 'plac': 'L', 'plack': 'L', 'pluck': 'L', 'black': 'L',
  // Kutiplak — pak
  'pak':  'G', 'pack': 'G', 'puck': 'G', 'back': 'G', 'bak': 'G', 'puck': 'G',
  // Kutiplak — peung
  'peung': 'F', 'pung': 'F', 'poeng': 'F', 'pung': 'F', 'poeung': 'F', 'pung': 'F',
  'fung': 'F', 'phung': 'F', 'young': 'F', 'lung': 'F',
  // Gong
  'gong': 'S', 'kong': 'S', 'song': 'S', 'gone': 'S',
  // Rust
  'rest': '.', 'rust': '.', 'pause': '.', 'stop': '.', 'space': '.',
};

// Alle herkende woorden als Set voor snelle lookup
const KNOWN_WORDS = new Set(Object.keys(WORD_TO_SYMBOL));

export class VoiceInput {
  constructor({ onSymbol, onStateChange }) {
    this.onSymbol      = onSymbol;       // (symbol: string) => void
    this.onStateChange = onStateChange;  // ('listening'|'off') => void
    this.recognition   = null;
    this.running       = false;
    this.supported     = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(lang = 'en-US') {
    if (!this.supported || this.running) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();

    rec.continuous      = true;
    rec.interimResults  = false; // Alleen finale resultaten — voorkomt dubbele writes
    rec.maxAlternatives = 5;
    rec.lang            = lang;

    // Optioneel: hint de grammar als browser het ondersteunt
    try {
      const SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      if (SGL) {
        const gl = new SGL();
        const words = [...KNOWN_WORDS].join(' | ');
        gl.addFromString(`#JSGF V1.0; grammar kendang; public <klank> = ${words};`, 1);
        rec.grammars = gl;
      }
    } catch (_) { /* grammar niet ondersteund, werkt zonder */ }

    rec.onstart = () => this.onStateChange?.('listening');

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue; // Alleen finale resultaten verwerken

        // Doorzoek alle alternatieven op eerste herkenbare klank
        let matched = false;
        for (let a = 0; a < result.length && !matched; a++) {
          const words = result[a].transcript.toLowerCase().trim().split(/\s+/);
          for (const word of words) {
            const cleaned = word.replace(/[^a-z]/g, '');
            const symbol  = WORD_TO_SYMBOL[cleaned];
            if (symbol) {
              this.onSymbol(symbol);
              matched = true;
              break;
            }
          }
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return; // Normaal — gewoon wachten
      console.warn('VoiceInput error:', e.error);
    };

    rec.onend = () => {
      if (this.running) {
        // Herstart automatisch zodat luisteren doorgaat
        try { rec.start(); } catch (_) {}
      } else {
        this.onStateChange?.('off');
      }
    };

    this.recognition = rec;
    this.running     = true;

    try {
      rec.start();
    } catch (e) {
      console.warn('VoiceInput start failed:', e);
      this.running = false;
      this.onStateChange?.('off');
    }
  }

  stop() {
    this.running = false;
    try { this.recognition?.stop(); } catch (_) {}
    this.recognition = null;
    this.onStateChange?.('off');
  }

  get isSupported() { return this.supported; }
}
