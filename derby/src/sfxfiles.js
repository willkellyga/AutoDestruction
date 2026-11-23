// Where a sound's bytes come from. The one-file builds (build.mjs: auto-destruction.html, which opens from disk, and the
// artifact) carry every clip inside the page, so an import of an .mp3 or .wav is its bytes. The served build (dist/web,
// what derby/server hands out) keeps the sounds out of the page: each is a file of its own in sfx/ beside it, named
// after its content so a browser can keep it for a year, and an import of one is { __sfx: 'sfx/<name>-<hash>.mp3' }.
// Those are fetched once the page is up, all at once, and play as they arrive; one that fails stays quiet.
const got = new Map();
const EMPTY = new Uint8Array(0);   // a sound that didn't come: decoding it fails, quietly, as a bad clip always has
export function bytes(v) {
  if (!v || typeof v.__sfx !== 'string') return Promise.resolve(v || EMPTY);
  if (!got.has(v.__sfx)) got.set(v.__sfx, fetch(v.__sfx).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => new Uint8Array(b)).catch(() => EMPTY));
  return got.get(v.__sfx);
}
// a bank of sets ({ name: [clip, clip] }, as src/sfx-bank.js has them) with every clip's bytes in, in the same order
export async function bank(b) {
  const out = {};
  await Promise.all(Object.entries(b).map(async ([k, list]) => { out[k] = await Promise.all(list.map(bytes)); }));
  return out;
}
