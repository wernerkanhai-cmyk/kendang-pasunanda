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
    rec.interimResults  = true;  // Real-time herkenning per klank (Safari accumuleert anders alles)
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

    // Cooldown per symbool: voorkomt dubbele writes bij interim → final
    const lastFired = {}; // symbol → timestamp
    const COOLDOWN_MS = 300;

    rec.onstart = () => this.onStateChange?.('listening');

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // Log voor debugging (alleen finals voor leesbaarheid)
        if (result.isFinal) {
          const alts = [];
          for (let a = 0; a < result.length; a++) {
            alts.push(`[${a}] "${result[a].transcript}" (${result[a].confidence?.toFixed(2)})`);
          }
          console.log('VoiceInput final:', alts.join(' | '));
        }

        // Verwerk het beste alternatief (index 0) — zoek eerste herkenbare woord
        // Zowel interim als final, met cooldown om dubbele writes te voorkomen
        const now = Date.now();
        const words = result[0].transcript.toLowerCase().trim().split(/\s+/);
        // Neem het LAATSTE woord: bij interim groeit het transcript, het nieuwste woord staat achteraan
        for (let w = words.length - 1; w >= 0; w--) {
          const cleaned = words[w].replace(/[^a-z]/g, '');
          const symbol  = WORD_TO_SYMBOL[cleaned];
          if (symbol) {
            if (!lastFired[symbol] || now - lastFired[symbol] > COOLDOWN_MS) {
              lastFired[symbol] = now;
              this.onSymbol(symbol);
            }
            break; // Eerste (laatste) match per result
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
