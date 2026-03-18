import { useRef, useState } from 'react';
import { getHandForSymbol } from '../engine/patternLogic';

const API_KEY_STORAGE = 'anthropic_api_key';

const SYMBOOLMAPPING = `
KUMPYANG (grote P — bovenkant kendanghoofd):
  Grote P zonder teken (pang)                → "J"
  Grote P met horizontale streep boven (ping) → ";"
  Grote P met kruisje boven (pong)            → ":"
  D met V door het bovenste deel (pling)      → "A"

KUTIPLAK (kleine p — bovenkant kendanghoofd):
  Kleine p met 2 verticale streepjes (pak)   → "G"
  Kleine p met 1 verticaal streepje (peung)  → "F"

ONDERKANT KENDANGHOOFD (D/Ø/T/t familie):
  D (dong — gewone D-vorm, geen extra teken)             → "C"
  Ø / Ð / D met streep erdoor (det — D met diagonale of verticale lijn door het midden) → "V"
  t (tung — kleine letter t, kruisvorm)     → "N"
  T (ting — hoofdletter T, kruisvorm)      → "X"
  L (plak)                                               → "L"
  S (dededet)                                            → "S"`.trim();

const MAATINDELING = `
BALKLIJNEN bepalen de nootwaarde. Een balk is een horizontale lijn die boven een groep
van 2 of meer symbolen getrokken is en ze visueel verbindt.

HOE BALKEN ERUITZIEN:
  Geen balk boven de noot          → kwartnoot  → offset 0
  1 horizontale lijn boven 2 noten → achtste     → de 2 noten op offsets 0 en 6
  2 parallelle lijnen boven noten  → 16e noot    → 4 noten op offsets 0, 3, 6, 9

LET OP: Een balk verbindt een GROEP noten — zoek de lijn boven elke noot en tel hoeveel
parallelle lijnen er zijn. Twee symbolen met 1 balk erboven = elk een achtste noot.

Een stip (·) is een RUST. De balk boven de stip geeft de rustduur aan:
  Stip zonder balk  → kwartnoot rust
  Stip met 1 balk   → achtste rust  → volgende noten op offsets 6, 9
  Stip met 2 balken → 16e rust      → volgende noten op offsets 3, 6, 9

Gemengde voorbeelden binnen één tel:
  [noot-1balk] [noot-1balk]        → offsets 0 en 6  (twee achtste noten)
  [·-1balk] [noot-2balken] [noot-2balken] → offsets 6 en 9  (8e rust + twee 16e noten)
  [noot-2balken] [noot-2balken] [noot-2balken] [noot-2balken] → offsets 0,3,6,9

Rust-stippen (·) nooit opnemen in de JSON — alleen de klingende noten.`.trim();

// Prompt 1: scan alleen anak (zwarte inkt)
const buildAnakPrompt = () => `
Analyseer de afbeelding van Sundanese Kendang Pasunanda-slagwerknotatie.
Geef ALLEEN een geldig JSON-object terug. Geen uitleg, geen tekst buiten de JSON.

TAAK: Scan uitsluitend de ZWARTE inkt-symbolen. Negeer alle rode/gekleurde symbolen volledig.

De zwarte sectie toont 4 maten in 2 sub-rijen. BEIDE sub-rijen moeten worden opgenomen in de output:
  Bovenste sub-rij: kumpyang/kutiplak P-varianten (zwart) → ook opnemen in anak[]
  ─────── horizontale lijn ──────────────────────────────
  Onderste sub-rij: D / Ø / T / t symbolen (zwart)       → OOK opnemen in anak[]

LET OP: De noten uit BEIDE sub-rijen komen in dezelfde anak[] array per maat.
Sla de onderste sub-rij NIET over — die is even belangrijk als de bovenste.

${MAATINDELING}

${SYMBOOLMAPPING}

Geef exact dit formaat terug (ALTIJD 4 elementen, ook als leeg):
{"anak":[[{"b":1,"o":0,"s":";"}, {"b":1,"o":6,"s":"F"}, {"b":1,"o":6,"s":"C"}, {"b":1,"o":9,"s":"C"}, {"b":2,"o":0,"s":"X"}],[{"b":1,"o":0,"s":"C"}],[],[]]}

Voorbeeld: b=1 o=6 en b=1 o=9 zijn twee 16e noten op de 2e helft van tel 1.
Waarbij: b=beat(1-4), o=offset(0,3,6,9), s=symboolcode.
Lege maten → []. Rust-punten (·) nooit opnemen.
";" en ":" altijd tussen aanhalingstekens: {"s":";"} {"s":":"}
`.trim();

// Prompt 2: scan alleen indung (rode inkt)
const buildIndungPrompt = () => `
Analyseer de afbeelding van Sundanese Kendang Pasunanda-slagwerknotatie.
Geef ALLEEN een geldig JSON-object terug. Geen uitleg, geen tekst buiten de JSON.

TAAK: Scan uitsluitend de RODE inkt-symbolen. Negeer alle zwarte symbolen volledig.

De rode sectie toont 4 maten in 2 sub-rijen. BEIDE sub-rijen moeten worden opgenomen in de output:
  Bovenste sub-rij: p / P varianten (rood)              → opnemen in indung[]
  ─────── horizontale lijn ────────────────
  Onderste sub-rij: Ø / D / t symbolen (rood)           → OOK opnemen in indung[]

LET OP: De noten uit BEIDE sub-rijen komen in dezelfde indung[] array per maat.
Sla de onderste sub-rij NIET over — die is even belangrijk als de bovenste.

${MAATINDELING}

${SYMBOOLMAPPING}

Geef exact dit formaat terug (ALTIJD 4 elementen, ook als leeg):
{"indung":[[{"b":1,"o":0,"s":"V"}, {"b":1,"o":6,"s":"F"}, {"b":2,"o":0,"s":"C"}],[{"b":1,"o":0,"s":"F"}, {"b":1,"o":6,"s":"F"}],[],[]]}

Voorbeeld: b=1 o=0 en b=1 o=6 zijn twee achtste noten op tel 1.
Waarbij: b=beat(1-4), o=offset(0,3,6,9), s=symboolcode.
Lege maten → []. Rust-punten (·) nooit opnemen.
";" en ":" altijd tussen aanhalingstekens: {"s":";"} {"s":":"}
`.trim();

// JSON repair + parse
const parseJson = (text) => {
  let jsonStr;
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    jsonStr = codeBlock[1];
  } else {
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Geen JSON gevonden in respons');
    jsonStr = text.slice(start, end + 1);
  }
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
  jsonStr = jsonStr.replace(/"([^"]+)"\s*;/g, '"$1":');
  jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*;/g, '$1"$2":');
  jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  jsonStr = jsonStr.replace(/"s"\s*:\s*([;:])\s*([,}\]])/g, '"s":"$1"$2');
  return JSON.parse(jsonStr);
};

// API call helper
const callClaude = async (key, mediaBlock, promptText) => {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: 'You are a music notation parser. Output ONLY valid JSON. No explanations, no markdown.',
      messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: promptText }] }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API fout ${resp.status}`);
  }
  const data = await resp.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Geen tekst in API-respons');
  return parseJson(text);
};

// Zet een symbool om naar {top, bottom}
const symToSlot = (sym) => {
  if (!sym) return { top: '', bottom: '' };
  const hand = getHandForSymbol(sym);
  if (hand === 'both') return { top: sym, bottom: sym };
  if (hand === 'top')  return { top: sym, bottom: '' };
  return { top: '', bottom: sym };
};

const emptySlots = () => Array.from({ length: 48 }, () => ({ top: '', bottom: '' }));

const notesToSlots = (notes) => {
  const slots = emptySlots();
  for (const n of (Array.isArray(notes) ? notes : [])) {
    const idx = (n.b - 1) * 12 + (n.o || 0);
    if (idx >= 0 && idx < 48) slots[idx] = symToSlot(n.s);
  }
  return slots;
};

// Zorg dat array precies 4 elementen heeft
const normalize4 = (arr) => {
  const a = Array.isArray(arr) ? [...arr] : [];
  while (a.length < 4) a.push([]);
  return a.slice(0, 4);
};

const OCRScanner = ({ onScanResult }) => {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput]         = useState('');

  const savedKey = () => localStorage.getItem(API_KEY_STORAGE) || '';

  const handleFile = async (file) => {
    const key = savedKey();
    if (!key) { setShowKeyInput(true); return; }

    setLoading(true);
    setError(null);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const isPdf    = file.type === 'application/pdf';
      const mimeType = file.type || 'image/jpeg';
      const mediaBlock = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image',    source: { type: 'base64', media_type: mimeType,           data: base64 } };

      // Twee parallelle calls: één voor anak (zwart), één voor indung (rood)
      const [anakResult, indungResult] = await Promise.all([
        callClaude(key, mediaBlock, buildAnakPrompt()),
        callClaude(key, mediaBlock, buildIndungPrompt()),
      ]);

      const anakMeasures   = normalize4(anakResult.anak);
      const indungMeasures = normalize4(indungResult.indung);

      const pattern = {
        id: crypto.randomUUID(),
        name: 'Scan regel 1',
        anak:   anakMeasures.flatMap(notesToSlots),
        indung: indungMeasures.flatMap(notesToSlots),
        gong: [],
      };

      if (onScanResult) onScanResult([pattern]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    if (keyInput.trim()) {
      localStorage.setItem(API_KEY_STORAGE, keyInput.trim());
      setShowKeyInput(false);
      setKeyInput('');
    }
  };

  const btnStyle = (extra = {}) => ({
    background: 'rgba(255,255,255,0.1)',
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border-focus)',
    color: '#fff',
    opacity: loading ? 0.6 : 1,
    cursor: loading ? 'wait' : 'pointer',
    ...extra,
  });

  const resetInputs = () => {
    if (fileInputRef.current)   fileInputRef.current.value   = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div style={{ display: 'inline-flex', gap: '2px', marginRight: '1rem' }}>
      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileInputRef}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); resetInputs(); }} />
      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} ref={cameraInputRef}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); resetInputs(); }} />

      <button className="btn-secondary" title="Foto of PDF kiezen"
        style={btnStyle({ borderRadius: '6px 0 0 6px' })} disabled={loading}
        onClick={() => fileInputRef.current?.click()}>
        {loading ? '⏳' : '📁'} Scan
      </button>
      <button className="btn-secondary" title="Camera gebruiken"
        style={btnStyle({ borderRadius: '0 6px 6px 0', borderLeft: 'none' })} disabled={loading}
        onClick={() => cameraInputRef.current?.click()}>
        📷
      </button>

      {error && (
        <div style={{ color: '#fc8181', fontSize: '0.75rem', marginTop: '0.25rem', maxWidth: '300px' }}>
          {error}
          {(error.includes('401') || error.includes('API')) && (
            <button onClick={() => setShowKeyInput(true)}
              style={{ marginLeft: '0.5rem', color: '#90cdf4', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>
              API-sleutel wijzigen
            </button>
          )}
        </div>
      )}

      {showKeyInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px',
            border: '1px solid var(--border-focus)', width: '360px' }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>Anthropic API-sleutel</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Vereist voor OCR. Sleutel wordt lokaal opgeslagen en nooit verstuurd naar andere servers.
            </p>
            <input type="password" placeholder="sk-ant-..." value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px',
                background: '#0f172a', color: '#e2e8f0',
                border: '1px solid var(--border-focus)', marginBottom: '1rem', boxSizing: 'border-box' }}
              autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowKeyInput(false); setKeyInput(''); }}
                style={{ padding: '0.4rem 1rem', borderRadius: '4px', background: 'transparent',
                  color: '#94a3b8', border: '1px solid #475569', cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={saveKey}
                style={{ padding: '0.4rem 1rem', borderRadius: '4px', background: '#3b82f6',
                  color: '#fff', border: 'none', cursor: 'pointer' }}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRScanner;
