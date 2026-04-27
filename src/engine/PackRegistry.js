/**
 * PackRegistry — laadt en cachet pack-manifesten (instrument / voice / notation).
 *
 * Manifesten leven in `public/packs/<id>/pack.json` en worden gefetched ten
 * opzichte van `import.meta.env.BASE_URL`. Sample-URLs binnen een manifest zijn
 * altijd relatief aan BASE_URL.
 *
 * Schema (zie public/packs/[id]/pack.json voor concrete voorbeelden):
 *   instrument: { id, type:'instrument', tracks[], sounds{}, samples{urlTemplate,variants}, auxiliary?, ... }
 *   voice:      { id, type:'voice', samples{urlTemplate, soundFileNames, missing?}, combos[]? }
 *   notation:   { id, type:'notation', font{family,url}, restGlyph, soundToGlyph{} }
 *
 * URL-template placeholders:
 *   {track}      trackId lowercase     → "anak"
 *   {TRACK}      trackId uppercase     → "ANAK"
 *   {Track}      trackId titlecase     → "Anak"
 *   {sound}      soundId lowercase     → "tung"
 *   {SoundFile}  uit soundFileNames    → "Tung" (fallback: titlecase van soundId)
 *   {ComboFile}  combo.fileName        → "Bang"
 *   {n}          variant 2-digit gepad → "01".."99"
 */

import { errorLog } from '../utils/errorLog.js';

const titleCase = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
const padN = (i, width = 2) => String(i).padStart(width, '0');

/** Vervang placeholders in een URL-template. Onbekende placeholders blijven staan. */
export const resolveTemplate = (template, ctx = {}) => {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (key in ctx) return String(ctx[key]);
    return `{${key}}`;
  });
};

/** Bouw de placeholder-context voor een sample. */
export const sampleContext = ({ track, sound, variant, soundFileNames, comboFile }) => {
  const ctx = {};
  if (track !== undefined) {
    ctx.track = String(track).toLowerCase();
    ctx.TRACK = String(track).toUpperCase();
    ctx.Track = titleCase(track);
  }
  if (sound !== undefined) {
    ctx.sound = String(sound).toLowerCase();
    ctx.Sound = titleCase(sound);
    ctx.SoundFile = (soundFileNames && soundFileNames[sound]) || titleCase(sound);
  }
  if (variant !== undefined) {
    ctx.n = padN(variant);
  }
  if (comboFile !== undefined) {
    ctx.ComboFile = comboFile;
  }
  return ctx;
};

/** Validate dat een manifest een minimaal correcte vorm heeft. Gooit Error bij fouten. */
const validatePack = (pack) => {
  if (!pack || typeof pack !== 'object') throw new Error('pack: not an object');
  if (typeof pack.id !== 'string') throw new Error('pack: missing id');
  if (!['instrument', 'voice', 'notation'].includes(pack.type)) {
    throw new Error(`pack ${pack.id}: invalid type "${pack.type}"`);
  }
  if (pack.type === 'instrument') {
    if (!Array.isArray(pack.tracks) || pack.tracks.length === 0) throw new Error(`pack ${pack.id}: tracks[] required`);
    if (!pack.sounds || typeof pack.sounds !== 'object')         throw new Error(`pack ${pack.id}: sounds{} required`);
    if (!pack.samples?.urlTemplate)                              throw new Error(`pack ${pack.id}: samples.urlTemplate required`);
  }
  if (pack.type === 'voice') {
    if (!pack.samples?.urlTemplate) throw new Error(`pack ${pack.id}: samples.urlTemplate required`);
  }
  if (pack.type === 'notation') {
    if (!pack.font?.url)        throw new Error(`pack ${pack.id}: font.url required`);
    if (!pack.font?.family)     throw new Error(`pack ${pack.id}: font.family required`);
    if (!pack.soundToGlyph)     throw new Error(`pack ${pack.id}: soundToGlyph required`);
  }
};

export class PackRegistry {
  constructor(baseUrl = import.meta.env.BASE_URL) {
    this.baseUrl = baseUrl;
    this.cache = new Map(); // id → manifest
    this.inflight = new Map(); // id → Promise
  }

  /**
   * Maak een absolute URL relatief aan BASE_URL en encode reserved chars
   * (spaties etc.) in het pad. Bestaande %XX-sequenties worden niet dubbel
   * gecodeerd dankzij encodeURI.
   */
  resolveUrl(relUrl) {
    if (!relUrl) return '';
    if (/^https?:\/\//.test(relUrl)) return relUrl;
    const trimmed = relUrl.replace(/^\//, '');
    return `${this.baseUrl}${encodeURI(trimmed)}`;
  }

  /** Laadt een manifest (gecachet). Returnt het manifest, of throwt op falen. */
  async load(packId) {
    if (this.cache.has(packId)) return this.cache.get(packId);
    if (this.inflight.has(packId)) return this.inflight.get(packId);

    const url = `${this.baseUrl}packs/${packId}/pack.json`;
    const promise = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`PackRegistry: fetch failed for "${packId}" (${res.status})`);
      const pack = await res.json();
      validatePack(pack);
      this.cache.set(packId, pack);
      return pack;
    })().catch((e) => {
      this.inflight.delete(packId);
      errorLog.error('PackRegistry', 'load failed', `${packId} — ${e.message}`);
      throw e;
    });

    this.inflight.set(packId, promise);
    const pack = await promise;
    this.inflight.delete(packId);
    return pack;
  }

  /** Synchrone getter — alleen geldig nadat load() resolved is. */
  get(packId) {
    return this.cache.get(packId) || null;
  }

  /**
   * Ontdek alle beschikbare packs via `public/packs/index.json` en
   * laad hun manifesten. Returnt ze gegroepeerd op type.
   */
  async discoverAll() {
    const indexUrl = `${this.baseUrl}packs/index.json`;
    const res = await fetch(indexUrl);
    if (!res.ok) throw new Error(`PackRegistry: index.json fetch failed (${res.status})`);
    const idx = await res.json();
    const ids = Array.isArray(idx?.packs) ? idx.packs : [];
    const settled = await Promise.allSettled(ids.map(id => this.load(id)));
    const grouped = { instrument: [], voice: [], notation: [] };
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      const pack = r.value;
      if (grouped[pack.type]) grouped[pack.type].push(pack);
    }
    return grouped;
  }

  /**
   * Bouw alle sample-URLs voor een instrument-pack als
   *   { sampleKey: absoluteUrl, ... }
   * waarbij sampleKey = `${track}_${sound}_${nn}`. Auxiliary (gong) komt erbij.
   */
  buildInstrumentSampleMap(pack) {
    if (pack.type !== 'instrument') throw new Error(`buildInstrumentSampleMap: not an instrument pack (${pack.id})`);
    const out = {};
    const tpl = pack.samples.urlTemplate;
    const variants = pack.samples.variants || 4;

    for (const track of pack.tracks) {
      for (const soundId of track.soundIds || []) {
        for (let i = 1; i <= variants; i++) {
          const key = `${track.id}_${soundId}_${padN(i)}`;
          const ctx = sampleContext({ track: track.id, sound: soundId, variant: i });
          out[key] = this.resolveUrl(resolveTemplate(tpl, ctx));
        }
      }
    }
    if (pack.auxiliary) {
      for (const [auxId, aux] of Object.entries(pack.auxiliary)) {
        if (aux?.url) out[auxId] = this.resolveUrl(aux.url);
      }
    }
    return out;
  }

  /**
   * Bouw alle sample-URLs voor een voice-pack:
   *   { sampleKey: absoluteUrl, ... }
   * sampleKey-conventie:
   *   reguliere samples: `vox_${track}_${sound}_${nn}`
   *   combo samples:     `vox_combo_${track}_${comboId}_${i}`     (i = 1..variants, ongepad)
   *
   * Het instrument-pack bepaalt welke (track, sound) combinaties bestaan;
   * dat moet meegegeven worden zodat de voice-pack daar tegenaan kan mappen.
   */
  buildVoiceSampleMap(voicePack, instrumentPack) {
    if (voicePack.type !== 'voice') throw new Error(`buildVoiceSampleMap: not a voice pack (${voicePack.id})`);
    const out = {};
    const tpl = voicePack.samples.urlTemplate;
    const variants = voicePack.samples.variants || 4;
    const soundFileNames = voicePack.samples.soundFileNames || {};
    const missing = new Set(
      (voicePack.samples.missing || []).map(m => `${m.track}__${m.sound}`)
    );

    for (const track of instrumentPack.tracks) {
      for (const soundId of track.soundIds || []) {
        if (missing.has(`${track.id}__${soundId}`)) continue;
        for (let i = 1; i <= variants; i++) {
          const key = `vox_${track.id}_${soundId}_${padN(i)}`;
          const ctx = sampleContext({ track: track.id, sound: soundId, variant: i, soundFileNames });
          out[key] = this.resolveUrl(resolveTemplate(tpl, ctx));
        }
      }
    }

    for (const combo of voicePack.combos || []) {
      const comboFile = combo.fileName || titleCase(combo.id);
      for (const track of instrumentPack.tracks) {
        const trackTpl = combo.urlTemplates?.[track.id];
        if (!trackTpl) continue;
        for (let i = 1; i <= variants; i++) {
          const key = `vox_combo_${track.id}_${combo.id}_${i}`;
          const ctx = { ...sampleContext({ track: track.id, variant: i }), ComboFile: comboFile };
          out[key] = this.resolveUrl(resolveTemplate(trackTpl, ctx));
        }
      }
    }
    return out;
  }

  /** Bouw een lookup van combo-id op gesorteerd-paar van soundIds, voor combo-detectie. */
  buildComboLookup(voicePack) {
    const map = {};
    for (const combo of voicePack.combos || []) {
      if (!Array.isArray(combo.sounds) || combo.sounds.length !== 2) continue;
      const key = [...combo.sounds].sort().join('+');
      map[key] = combo.id;
    }
    return map;
  }
}

/** Gedeelde singleton — hergebruikt over de hele app. */
export const packRegistry = new PackRegistry();
