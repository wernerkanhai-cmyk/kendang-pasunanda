/**
 * VoiceInput — herkent gesproken kendang-klanknamen via Web Speech API
 * en roept onSymbol(symbol) aan zodra een klank is herkend.
 *
 * Mapping: gesproken woord → kendang-symbool (voor handleDrumTrigger)
 */

const WORD_TO_SYMBOL = {
  // Ketipung
  'tung':  'N', 'tong':  'N', 'tong':  'N',
  // Gedug
  'dong':  'C', 'dung':  'C',
  'ting':  'X', 'thing': 'X', 'teen':  'X',
  'det':   'V', 'dat':   'V', 'debt':  'V',
  // Kumpyang
  'pling': 'A', 'pling': 'A', 'pling':'A',
  'pang':  'J',
  'ping':  ';',
  'pong':  ':',
  'plak':  'L', 'plaque':'L', 'plac':  'L', 'plack': 'L',
  // Kutiplak
  'pak':   'G', 'pack':  'G', 'puck':  'G',
  'peung': 'F', 'pung':  'F', 'poeng': 'F', 'pöng':  'F',
  // Gong
  'gong':  'S', 'kong':  'S',
  // Rust
  'rest':  '.', 'rust':  '.', 'pause': '.', 'stop':  '.',
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

  start(lang = 'id-ID') {
    if (!this.supported || this.running) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();

    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 3;
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
        // Check alle alternatieven per resultaat
        const result = event.results[i];
        for (let a = 0; a < result.length; a++) {
          const words = result[a].transcript.toLowerCase().trim().split(/\s+/);
          for (const word of words) {
            const cleaned = word.replace(/[^a-z]/g, '');
            const symbol  = WORD_TO_SYMBOL[cleaned];
            if (symbol) {
              this.onSymbol(symbol);
              break; // Eerste match per alternatief
            }
          }
          if (result.isFinal) break; // Stop bij final resultaat
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
