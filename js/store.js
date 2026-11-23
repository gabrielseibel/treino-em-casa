// Persistência local (localStorage), opcionalmente criptografada com PIN (AES-GCM + PBKDF2).
// Nada sai do aparelho.

const META = 'tc.meta';
const DATA = 'tc.data';

let key = null;     // CryptoKey quando há PIN
let timer = null;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META)) || {}; } catch { return {}; }
}

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export const isLocked = () => !!readMeta().encrypted && !key;
export const hasPin = () => !!readMeta().encrypted;

export function loadPlain() {
  if (readMeta().encrypted) return null;
  try { return JSON.parse(localStorage.getItem(DATA)); } catch { return null; }
}

export async function unlock(pin) {
  const meta = readMeta();
  const k = await deriveKey(pin, unb64(meta.salt));
  const blob = JSON.parse(localStorage.getItem(DATA));
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, k, unb64(blob.ct));
    key = k;
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null; // PIN errado
  }
}

async function write(state) {
  const json = JSON.stringify(state);
  if (!key) {
    if (readMeta().encrypted) return; // bloqueado: nunca gravar em texto puro
    localStorage.setItem(DATA, json);
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json));
  localStorage.setItem(DATA, JSON.stringify({ iv: b64(iv), ct: b64(ct) }));
}

let pending = null;
export function save(state) {
  pending = state;
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export async function flush() {
  clearTimeout(timer);
  if (!pending) return;
  const s = pending; pending = null;
  try { await write(s); } catch (e) { console.error('Falha ao salvar', e); }
}

export async function setPin(pin, state) {
  if (!pin) {
    key = null;
    localStorage.setItem(META, JSON.stringify({ encrypted: false }));
  } else {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    key = await deriveKey(pin, salt);
    localStorage.setItem(META, JSON.stringify({ encrypted: true, salt: b64(salt) }));
  }
  await write(state);
}

export function lockNow() { key = null; }

export function wipe() {
  key = null;
  localStorage.removeItem(META);
  localStorage.removeItem(DATA);
}

export const cryptoAvailable = () => !!(globalThis.crypto && crypto.subtle);
