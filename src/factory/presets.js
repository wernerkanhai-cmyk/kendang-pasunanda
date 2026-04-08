/**
 * Factory Templates — read-only song templates that ship with the app.
 *
 * Each template is a complete song (one or more patterns). They appear as a
 * fixed "Templates" folder at the top of the Library. Clicking a template
 * creates an editable copy in the user's own library; the template itself
 * cannot be modified or deleted from inside the app.
 *
 * SHAPE
 * -----
 *   {
 *     id:       'unique-string',          // any non-empty unique id, e.g. 'tepak-dua-basic-1'
 *     name:     'Tepak Dua — Basic',      // shown in the template list
 *     category: 'Tepak Dua',              // optional grouping label (matches FACTORY_CATEGORIES)
 *     bpm:      80,                        // starting tempo (number)
 *     patterns: [                          // one or more patterns (rows / regels)
 *       {
 *         name: 'Pangjadi 1',
 *         anak:   [...192 slot objects...],   // {top, bottom} per slot
 *         indung: [...192 slot objects...],
 *         gong:   [],                          // optional gong slot indices
 *         tempoTrackEnabled: false,
 *         tempoTrack: [],
 *       },
 *     ],
 *   }
 *
 * SLOTS: 1 maat = 48 slots | 1 tel = 12 slots | 1/8 = 6 slots | 1/16 = 3 slots
 *
 * HOW TO ADD A TEMPLATE
 * ---------------------
 *   1. Create a song in the running app exactly as you want the template to look.
 *   2. Use the export button in the library to download a .kendang file.
 *   3. Use a tool like the one shown in /docs (TODO) to convert the encoded
 *      file into a JS object literal, or hand-author one using the shape above.
 *   4. Import the resulting object and push it into FACTORY_PRESETS below.
 */

export const FACTORY_PRESETS = [];

export const FACTORY_CATEGORIES = [
  { label: 'Tepak Dua' },
  { label: 'Tepak Tilu' },
  { label: 'Tepak Paleredan' },
  { label: 'Mincid' },
  { label: 'Padungdung' },
];
