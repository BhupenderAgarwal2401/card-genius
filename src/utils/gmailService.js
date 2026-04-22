// Gmail API OAuth 2.0 helper
// Uses Google Identity Services (browser-based, no backend needed)

const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const TOKEN_STORAGE_KEY = 'cg_gmail_oauth_token';
const NEXT_HASH_KEY = 'cg_gmail_oauth_next_hash';
const JUST_CONNECTED_KEY = 'cg_gmail_just_connected';
const OAUTH_ERROR_KEY = 'cg_gmail_oauth_error';

let tokenClient = null;
let gapiLoaded = false;
let gisLoaded = false;
let lastClientOptions = { useRedirect: false };

/** Installed PWA / iOS home-screen: OAuth popups are unreliable — use redirect flow. */
export function prefersGmailRedirectUx() {
  if (typeof window === 'undefined') return false;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return standalone;
}

/** Must match Google Cloud Console “Authorized redirect URIs” for the OAuth Web client. */
export function getGmailRedirectUri() {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname || '/';
  return `${window.location.origin}${path.endsWith('/') ? path : `${path}/`}`;
}

/**
 * Call before React mounts. GIS redirect returns #access_token=... which breaks HashRouter.
 * Saves token to sessionStorage and restores a clean hash route.
 */
export function consumeGmailOAuthRedirectFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const h = window.location.hash;
    if (!h || h.length < 2) return;
    if (h.startsWith('#/')) return;

    const fragment = h.slice(1);
    const params = new URLSearchParams(fragment);

    if (params.get('error')) {
      sessionStorage.setItem(
        OAUTH_ERROR_KEY,
        JSON.stringify({ error: params.get('error'), detail: params.get('error_description') || '' })
      );
      const next = sessionStorage.getItem(NEXT_HASH_KEY) || '#/email';
      sessionStorage.removeItem(NEXT_HASH_KEY);
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
      return;
    }

    const access_token = params.get('access_token');
    if (!access_token) return;

    const expires_in = parseInt(params.get('expires_in') || '3600', 10);
    const payload = {
      access_token,
      expires_at: Date.now() + Math.max(120, expires_in - 120) * 1000,
    };
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
    sessionStorage.setItem(JUST_CONNECTED_KEY, '1');

    const next = sessionStorage.getItem(NEXT_HASH_KEY) || '#/email';
    sessionStorage.removeItem(NEXT_HASH_KEY);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  } catch (e) {
    console.warn('Gmail OAuth URL handling failed', e);
  }
}

export function readStoredGmailToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t?.access_token || !t?.expires_at) return null;
    return t;
  } catch {
    return null;
  }
}

export function clearStoredGmailToken() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function readGmailOAuthError() {
  try {
    const raw = sessionStorage.getItem(OAUTH_ERROR_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OAUTH_ERROR_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readGmailJustConnected() {
  const v = sessionStorage.getItem(JUST_CONNECTED_KEY);
  if (v) sessionStorage.removeItem(JUST_CONNECTED_KEY);
  return !!v;
}

/** gapi.client rejects with { result, body, status } — not always instanceof Error. */
export function formatGmailApiError(err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  const nested =
    err.result?.error?.message ||
    (typeof err.result?.error === 'string' ? err.result.error : '') ||
    err.error?.message;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (typeof err.body === 'string' && err.body.trim()) {
    try {
      const j = JSON.parse(err.body);
      if (typeof j?.error?.message === 'string') return j.error.message;
    } catch {
      /* ignore */
    }
    return err.body.slice(0, 280);
  }
  const statusLine = [err.status, err.statusText].filter(Boolean).join(' ').trim();
  if (statusLine) return statusLine;
  try {
    const s = JSON.stringify(err);
    if (s && s !== '{}') return s.slice(0, 400);
  } catch {
    /* ignore */
  }
  return 'Unknown error';
}

function applyTokenToGapi(access_token) {
  if (window.gapi?.client) {
    window.gapi.client.setToken({ access_token });
  }
}

let libsPromise = null;

export function loadGmailLibraries() {
  if (libsPromise) return libsPromise;
  libsPromise = new Promise((resolve, reject) => {
    const tryFinish = () => {
      if (gapiLoaded && gisLoaded) {
        window.gapi.load('client', () => resolve());
      }
    };

    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.onload = () => {
      window.gapi.load('client', () => {
        gapiLoaded = true;
        tryFinish();
      });
    };
    gapiScript.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.onload = () => {
      gisLoaded = true;
      tryFinish();
    };
    gisScript.onerror = () => reject(new Error('Failed to load Google Identity script'));
    document.head.appendChild(gisScript);
  });
  return libsPromise;
}

export async function initGmailClient(clientId, apiKey, options = {}) {
  lastClientOptions = { useRedirect: !!options.useRedirect };
  await window.gapi.client.init({
    apiKey,
    discoveryDocs: [DISCOVERY_DOC],
  });

  const redirectUri = getGmailRedirectUri();

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GMAIL_SCOPES,
    callback: () => {},
    ux_mode: lastClientOptions.useRedirect ? 'redirect' : 'popup',
    ...(lastClientOptions.useRedirect ? { redirect_uri: redirectUri } : {}),
  });
}

/**
 * Authorise Gmail. Returns { access_token, redirected }.
 * In redirect mode without a saved token, resolves with redirected:true after starting navigation.
 */
export function requestGmailAccess(options = {}) {
  const useRedirect = options.useRedirect ?? lastClientOptions.useRedirect ?? prefersGmailRedirectUx();

  const stored = readStoredGmailToken();
  if (stored && stored.expires_at > Date.now()) {
    applyTokenToGapi(stored.access_token);
    return Promise.resolve({ access_token: stored.access_token, redirected: false });
  }

  if (useRedirect) {
    tokenClient.callback = (resp) => {
      if (resp.error) console.warn('Gmail token callback error', resp.error);
      if (resp.access_token) {
        applyTokenToGapi(resp.access_token);
        const exp = resp.expires_in
          ? Date.now() + (parseInt(String(resp.expires_in), 10) - 120) * 1000
          : Date.now() + 3500 * 1000;
        sessionStorage.setItem(
          TOKEN_STORAGE_KEY,
          JSON.stringify({ access_token: resp.access_token, expires_at: exp })
        );
      }
    };
    sessionStorage.setItem(NEXT_HASH_KEY, window.location.hash || '#/email');
    tokenClient.requestAccessToken({ prompt: 'consent' });
    return Promise.resolve({ access_token: null, redirected: true });
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error));
        return;
      }
      if (!resp.access_token) {
        reject(new Error('No access token'));
        return;
      }
      applyTokenToGapi(resp.access_token);
      const exp = resp.expires_in
        ? Date.now() + (parseInt(String(resp.expires_in), 10) - 120) * 1000
        : Date.now() + 3500 * 1000;
      sessionStorage.setItem(
        TOKEN_STORAGE_KEY,
        JSON.stringify({ access_token: resp.access_token, expires_at: exp })
      );
      resolve({ access_token: resp.access_token, redirected: false });
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/** Gmail search: "promotions" only misses Primary/Updates retail mail. */
export function buildGmailListQuery(daysBack, scope) {
  const after = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);
  if (scope === 'promotions') {
    return `category:promotions after:${after}`;
  }
  if (scope === 'primary') {
    return `category:primary after:${after}`;
  }
  if (scope === 'updates') {
    return `category:updates after:${after}`;
  }
  if (scope === 'social') {
    return `category:social after:${after}`;
  }
  if (scope === 'forums') {
    return `category:forums after:${after}`;
  }
  if (scope === 'all') {
    return `after:${after}`;
  }
  // broad: recent mail that often contains card / cashback copy (still capped client-side)
  return `(category:promotions OR category:updates OR category:primary OR category:forums) after:${after}`;
}

async function messageIdsToSummaries(messages) {
  const summaries = [];
  for (const msg of messages) {
    try {
      const detail = await window.gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      const headers = detail.result.payload.headers;
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find((h) => h.name === 'From')?.value || '';
      const date = headers.find((h) => h.name === 'Date')?.value || '';
      const snippet = detail.result.snippet || '';
      summaries.push({ id: msg.id, subject, from, date, snippet, source: 'gmail' });
    } catch (e) {
      console.warn('Failed to fetch message meta', msg.id, e);
    }
  }
  return summaries;
}

/**
 * One page of lightweight message rows (for inbox UI + pagination).
 * @returns {{ summaries: Array, nextPageToken: string|null }}
 */
export async function fetchEmailSummariesPage({
  maxResults = 25,
  daysBack = 7,
  scope = 'broad',
  pageToken = null,
}) {
  const q = buildGmailListQuery(daysBack, scope);
  const cap = Math.min(50, Math.max(5, maxResults));
  const listRes = await window.gapi.client.gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: cap,
    pageToken: pageToken || undefined,
  });

  const nextPageToken = listRes.result.nextPageToken || null;
  const messages = listRes.result.messages || [];
  const summaries = await messageIdsToSummaries(messages);
  return { summaries, nextPageToken };
}

export async function fetchEmailSummaries(maxResults = 30, daysBack = 7, scope = 'broad') {
  const { summaries } = await fetchEmailSummariesPage({
    maxResults,
    daysBack,
    scope,
    pageToken: null,
  });
  return summaries;
}

export async function fetchFullEmail(messageId) {
  const detail = await window.gapi.client.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = detail.result.payload.headers;
  const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
  const from = headers.find((h) => h.name === 'From')?.value || '';
  const date = headers.find((h) => h.name === 'Date')?.value || '';
  const body = extractEmailBody(detail.result.payload);
  const images = extractEmailImages(detail.result.payload);

  return { id: messageId, subject, from, date, body, images, source: 'gmail' };
}

/** @deprecated prefer fetchEmailSummaries + fetchFullEmail for UI-driven flows */
export async function fetchPromotionalEmails(maxResults = 20, daysBack = 7) {
  const summaries = await fetchEmailSummaries(maxResults, daysBack, 'promotions');
  const emails = [];
  for (const s of summaries) {
    try {
      emails.push(await fetchFullEmail(s.id));
    } catch (e) {
      console.warn('Failed full fetch', s.id, e);
    }
  }
  return emails;
}

function extractEmailBody(payload) {
  let text = '';

  function traverse(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (part.mimeType === 'text/html' && part.body?.data && !text) {
      const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      text += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }
    if (part.parts) part.parts.forEach(traverse);
  }

  traverse(payload);
  return text.slice(0, 8000);
}

function extractEmailImages(payload) {
  const images = [];

  function traverse(part) {
    if (part.mimeType?.startsWith('image/') && part.body?.attachmentId) {
      images.push({ attachmentId: part.body.attachmentId, mimeType: part.mimeType });
    }
    if (part.parts) part.parts.forEach(traverse);
  }

  traverse(payload);
  return images;
}

export async function getEmailAttachment(messageId, attachmentId) {
  const res = await window.gapi.client.gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  return res.result.data;
}
