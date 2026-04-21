// Gmail API OAuth 2.0 helper
// Uses Google Identity Services (browser-based, no backend needed)

const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';

let tokenClient = null;
let gapiLoaded = false;
let gisLoaded = false;

export function loadGmailLibraries() {
  return new Promise((resolve) => {
    // Load GAPI
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        gapiLoaded = true;
        if (gisLoaded) resolve();
      });
    };
    document.head.appendChild(gapiScript);

    // Load GIS
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => {
      gisLoaded = true;
      if (gapiLoaded) resolve();
    };
    document.head.appendChild(gisScript);
  });
}

export async function initGmailClient(clientId, apiKey) {
  await window.gapi.client.init({
    apiKey,
    discoveryDocs: [DISCOVERY_DOC],
  });
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GMAIL_SCOPES,
    callback: '',
  });
}

export function requestGmailAccess() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) reject(resp);
      else resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function fetchPromotionalEmails(maxResults = 20, daysBack = 7) {
  const after = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);
  const query = `category:promotions after:${after}`;

  const listRes = await window.gapi.client.gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = listRes.result.messages || [];
  const emails = [];

  for (const msg of messages.slice(0, maxResults)) {
    try {
      const detail = await window.gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = detail.result.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const body = extractEmailBody(detail.result.payload);
      const images = extractEmailImages(detail.result.payload);

      emails.push({ id: msg.id, subject, from, date, body, images, source: 'gmail' });
    } catch (e) {
      console.warn('Failed to fetch email', msg.id, e);
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
      // Strip HTML tags for text extraction
      text += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }
    if (part.parts) part.parts.forEach(traverse);
  }

  traverse(payload);
  return text.slice(0, 5000); // Limit for AI processing
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
  return res.result.data; // Base64 encoded
}
