// Compacte base64-(de)serialisatie voor .kendang(-lib)-bestanden (export/import).
// encodeData → string; decodeData → geparsede data (gooit bij ongeldige input,
// de aanroeper vangt dat af).
export const encodeData = (data) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data))));

export const decodeData = (text) =>
  JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0))));
