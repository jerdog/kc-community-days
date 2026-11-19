// Encrypted, HttpOnly session cookies (AES-GCM, key derived from SESSION_SECRET).
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const keys = new Map();
async function key(secret) {
  if (!keys.has(secret)) {
    const raw = await crypto.subtle.digest('SHA-256', enc.encode(`communitydays-admin:${secret}`));
    keys.set(secret, await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
  }
  return keys.get(secret);
}

export async function seal(value, secret, ttlSeconds) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = enc.encode(JSON.stringify({ v: value, exp: Date.now() + ttlSeconds * 1000 }));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), body);
  return `${b64u(iv)}.${b64u(ct)}`;
}

export async function unseal(token, secret) {
  try {
    const [iv, ct] = token.split('.');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await key(secret), unb64u(ct));
    const { v, exp } = JSON.parse(dec.decode(plain));
    return exp > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function cookie(name, value, { maxAge, path = '/admin' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}
