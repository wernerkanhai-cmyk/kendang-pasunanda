import { useRef, useState } from 'react';
import { getHandForSymbol } from '../engine/patternLogic';
import { useT } from '../i18n';

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

HOE BALKEN ERUITZIEN — EXACTE OFFSETREGELS:
  Geen balk boven de noot          → kwartnoot  → offset 0 (alleen)
  1 balk boven 2 noten             → 2× achtste  → offsets 0 en 6
  1 balk boven 4 noten             → 4× achtste  → offsets 0, 6, 12, 18 (max 2 per balk)
  2 balken boven 2 noten           → 2× 16e noot → offsets 0 en 3   ← LET OP: NIET 0 en 6!
  2 balken boven 4 noten           → 4× 16e noot → offsets 0, 3, 6, 9
  2 balken boven 3 noten           → 3× 16e noot → offsets 0, 3, 6

CRUCIAAL: 2 balken boven een PAAR noten = offsets 0 en 3, NIET 0 en 6.
Voorbeeld: [P̂ ṗ] met 2 balken erboven → P̂ op offset 0, ṗ op offset 3.

⚠️ VEREENVOUDIGINGSREGEL — LEES DIT GOED:
Een 16e noot waarvan de andere 16e positie leeg is (rust) wordt geschreven met slechts
1 balk — dit ziet eruit als een achtste noot. Toch is het offset 0 of 3.
MAAR: in de praktijk is 1 balk bijna altijd gewoon een achtste noot (o=0 en o=6).

⚠️ TELREGEL — CRUCIAAL:
Tel het EXACTE aantal horizontale balklijnen boven de noten ZORGVULDIG.
  • 1 enkele horizontale lijn → achtste noot (o=0 en o=6)
  • 2 duidelijk APARTE horizontale lijnen → 16e noot (o=0 en o=3)
Bij twijfel: gebruik achtste-noot offsets (o=0 en o=6). Achtste is veruit het meest voorkomend.
Vergis je NIET: 1 balk ziet er soms dikker uit maar is nog steeds 1 balk = achtste.

Een stip (·) is een RUST. De balk boven de stip geeft de rustduur aan:
  Stip zonder balk  → kwartnoot rust  → volgende noot op offset 0 van volgende tel
  Stip met 1 balk   → achtste rust   → volgende noot op offset 6
  Stip met 2 balken → 16e rust       → volgende noten op offsets 3 (en evt. 6, 9)

Gemengde voorbeelden binnen één tel (b=beat):
  [noot-1balk] [noot-1balk]              → o=0 en o=6  (twee achtsten) ← MEEST VOORKOMEND
  [noot-2balken] [noot-2balken]          → o=0 en o=3  (twee 16en)
  [·-1balk] [noot-1balk]                 → o=6         (8e rust + één achtste)
  [·-1balk] [noot-2balken] [noot-2balken]→ o=6 en o=9  (8e rust + twee 16en)
  [noot-2balken]×4                       → o=0,3,6,9

GONG-SYMBOOL: Een omcirkeld symbool (⊙ of cirkel om een letter) is een gongmarkering,
GEEN noot. Negeer het volledig — neem het niet op in de JSON.

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

ABSOLUTE REGEL — KUMPYANG/KUTIPLAK (bovenste sub-rij, P-varianten):
P-symboolparen in de BOVENSTE sub-rij zijn ALTIJD achtste noten: o=0 en o=6.
Gebruik NOOIT o=3 voor P-symbolen in de bovenste sub-rij.
De balkjes boven P-paren zien er soms dik of dubbel uit — dit is het handschrift, GEEN dubbele balk.
Een dikke balk is nog steeds 1 balk. Gebruik altijd o=0 en o=6 voor P-paren.

ALLEEN in de ONDERSTE sub-rij (D / t / Ø-symbolen) kunnen 16e noten voorkomen (o=3 of o=9),
maar ook daar: 8e noten (o=0 en o=6) zijn het meest voorkomend.

${MAATINDELING}

${SYMBOOLMAPPING}

Geef exact dit formaat terug (ALTIJD 4 elementen, ook als leeg):
{"anak":[[{"b":1,"o":0,"s":"J"},{"b":1,"o":6,"s":"F"},{"b":2,"o":0,"s":";"},{"b":2,"o":6,"s":"F"},{"b":3,"o":0,"s":"J"},{"b":3,"o":6,"s":"F"},{"b":4,"o":0,"s":";"},{"b":4,"o":6,"s":"F"}],[],[],[]]}

Toelichting voorbeeld: P-paren op o=0 en o=6 (achtste noten). NOOIT o=3 voor P-symbolen.
Bottom sub-rij voorbeeld: · DD · D D tt · → beat2: C op o=0 en o=6; beat3: C op o=0, C op o=6; beat4: C op o=0, N op o=6.
Waarbij: b=beat(1-4), o=offset(0,3,6,9), s=symboolcode.
LET OP: Zowel TOP als BOTTOM sub-rij symbolen gaan in dezelfde anak[] array.
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

ABSOLUTE REGEL — P-VARIANTEN (bovenste sub-rij):
P-symboolparen in de BOVENSTE sub-rij zijn ALTIJD achtste noten: o=0 en o=6.
Gebruik NOOIT o=3 voor P-symbolen in de bovenste sub-rij.
Een dikke of vette balk boven P-paren is nog steeds 1 balk — gebruik altijd o=0 en o=6.

ALLEEN in de ONDERSTE sub-rij (D / t / Ø-symbolen) kunnen 16e noten voorkomen (o=3 of o=9).

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
    if (idx >= 0 && idx < 48) {
      const s = symToSlot(n.s);
      // Merge top+bottom — niet overschrijven als al gevuld (beide sub-rijen in één array)
      if (s.top)    slots[idx].top    = s.top;
      if (s.bottom) slots[idx].bottom = s.bottom;
    }
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
  const t = useT();
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput]         = useState('');

  const savedKey = () => localStorage.getItem(API_KEY_STORAGE) || '';

  // Resize/convert image to JPEG, max 2000px wide, quality 0.85
  // Gebruikt createObjectURL ipv readAsDataURL — voorkomt iOS "Load failed" bij grote bestanden
  const prepareImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image — probeer een kleiner of ander bestand'));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 2000;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      } catch (err) {
        reject(new Error(`Canvas export mislukt: ${err.message}`));
      }
    };
    img.src = url;
  });

  const handleFile = async (file) => {
    const key = savedKey();
    if (!key) { setShowKeyInput(true); return; }

    setLoading(true);
    setError(null);

    try {
      const isPdf = file.type === 'application/pdf';
      let base64, mimeType;

      if (isPdf) {
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
          reader.onerror = () => reject(new Error('Could not read PDF'));
          reader.readAsDataURL(file);
        });
        mimeType = 'application/pdf';
      } else {
        base64   = await prepareImage(file);
        mimeType = 'image/jpeg';
      }

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
      console.error('[OCR] error:', err);
      setError(err.message || String(err));
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
      <input type="file" accept="image/*" capture style={{ display: 'none' }} ref={cameraInputRef}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); resetInputs(); }} />

      <button className="btn-secondary" title={t('chooseFile')}
        style={btnStyle({ borderRadius: '6px 0 0 6px' })} disabled={loading}
        onClick={() => fileInputRef.current?.click()}>
        {loading ? '⏳' : '📁'} Scan
      </button>
      <button className="btn-secondary" title={t('useCamera')}
        style={btnStyle({ borderRadius: '0 6px 6px 0', borderLeft: 'none' })} disabled={loading}
        onClick={() => cameraInputRef.current?.click()}>
        📷
      </button>
      <button className="btn-secondary" title="Change API key"
        style={btnStyle({ borderRadius: '6px', marginLeft: '4px' })}
        onClick={() => setShowKeyInput(true)}>
        🔑
      </button>

      {error && (
        <div style={{ color: '#fc8181', fontSize: '0.75rem', marginTop: '0.25rem', maxWidth: '300px' }}>
          {error}
          {(error.toLowerCase().includes('api') || error.includes('401') || error.includes('key')) && (
            <button onClick={() => setShowKeyInput(true)}
              style={{ marginLeft: '0.5rem', color: '#90cdf4', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>
              {t('changeApiKey')}
            </button>
          )}
        </div>
      )}

      {showKeyInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px',
            border: '1px solid var(--border-focus)', width: '360px' }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: '0.75rem' }}>{t('apiKeyTitle')}</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {t('apiKeyDesc')}
            </p>
            <input type="password" placeholder={t('apiKeyPlaceholder')} value={keyInput}
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
                {t('cancel')}
              </button>
              <button onClick={saveKey}
                style={{ padding: '0.4rem 1rem', borderRadius: '4px', background: '#3b82f6',
                  color: '#fff', border: 'none', cursor: 'pointer' }}>
                {t('saveApiKey')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRScanner;
