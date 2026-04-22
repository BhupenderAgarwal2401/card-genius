const KEY = 'cg_email_sync_session_v2';
const MAX_EMAIL_CHARS = 100_000;

export function loadEmailSyncSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveEmailSyncSession(payload) {
  try {
    const copy = { ...payload, version: 1 };
    if (typeof copy.emailText === 'string' && copy.emailText.length > MAX_EMAIL_CHARS) {
      copy.emailText = copy.emailText.slice(0, MAX_EMAIL_CHARS);
    }
    sessionStorage.setItem(KEY, JSON.stringify(copy));
  } catch (e) {
    console.warn('Email sync session save failed', e);
  }
}

export function clearEmailSyncSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
