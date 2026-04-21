// AES-256-GCM encryption using Web Crypto API
const STORAGE_PREFIX = 'cg_';
// These keys are excluded from backups for security
const EXCLUDED_FROM_BACKUP = ['api_keys', 'api_keys_enc'];

export async function deriveKey(pin) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('cardgenius_salt_v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encryptData(data, pin) {
  const key = await deriveKey(pin);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedStr, pin) {
  try {
    const key = await deriveKey(pin);
    const combined = Uint8Array.from(atob(encryptedStr), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

// Storage helpers
export const storage = {
  get: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(STORAGE_PREFIX + key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage write failed:', e);
      return false;
    }
  },
  remove: (key) => {
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch {}
  },
  clear: () => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }
};

// Trigger a download in all browsers reliably
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Backup: exports all card/offer/settings data, excludes API keys
export function exportBackup() {
  const backup = {};
  Object.keys(localStorage)
    .filter(k => {
      if (!k.startsWith(STORAGE_PREFIX)) return false;
      const shortKey = k.slice(STORAGE_PREFIX.length);
      return !EXCLUDED_FROM_BACKUP.includes(shortKey);
    })
    .forEach(k => { backup[k] = localStorage.getItem(k); });

  const payload = {
    version: 1,
    appName: 'CardGenius',
    timestamp: new Date().toISOString(),
    data: backup,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `cardgenius_backup_${new Date().toISOString().slice(0, 10)}.json`);
}

// Restore: imports backup, skips API key entries even if somehow present
export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('Missing data field');
        }
        Object.entries(parsed.data).forEach(([k, v]) => {
          const shortKey = k.startsWith(STORAGE_PREFIX)
            ? k.slice(STORAGE_PREFIX.length)
            : k;
          if (!EXCLUDED_FROM_BACKUP.includes(shortKey)) {
            localStorage.setItem(k, v);
          }
        });
        resolve(true);
      } catch (err) {
        reject(new Error('Invalid backup file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

// CSV Export for offers
export function exportOffersCSV(offers) {
  if (!offers || offers.length === 0) return;
  const headers = ['Card', 'Category', 'Merchant', 'Offer', 'Discount', 'Promo Code', 'Valid From', 'Valid Until', 'Min Spend (₹)', 'Max Cashback (₹)', 'Terms', 'Source', 'Added On'];
  const rows = offers.map(o => [
    o.cardName || '',
    o.category || '',
    o.merchant || '',
    o.description || '',
    o.discount || '',
    o.promoCode || '',
    o.validFrom || '',
    o.validUntil || '',
    o.minSpend || '',
    o.maxCashback || '',
    o.terms || '',
    o.source || '',
    o.addedAt ? o.addedAt.slice(0, 10) : '',
  ]);
  const escape = (val) => `"${String(val).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Excel
  triggerDownload(blob, `cardgenius_offers_${new Date().toISOString().slice(0, 10)}.csv`);
}
