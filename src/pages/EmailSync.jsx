import { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { callAI, buildOfferExtractionPrompt } from '../utils/aiService';
import {
  loadGmailLibraries, initGmailClient, requestGmailAccess, fetchPromotionalEmails
} from '../utils/gmailService';
import { Mail, Upload, Zap, CheckCircle, X, Plus, RefreshCw } from 'lucide-react';

function LoadingOverlay({ message }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <div className="loading-text">{message}</div>
    </div>
  );
}

function ExtractedOfferPreview({ offer, onAccept, onReject }) {
  return (
    <div className="card-sm mb-2" style={{ border: '1px solid var(--border2)' }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold" style={{ fontSize: 13 }}>
              {offer.merchant || 'General Offer'}
            </span>
            <span className="badge badge-green">{offer.discount}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            {offer.cardName || offer.cardId || 'Unknown card'}
          </div>
          {offer.validUntil && (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              Till {offer.validUntil}
            </div>
          )}
          {offer.promoCode && (
            <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              Code: {offer.promoCode}
            </div>
          )}
          {offer.terms && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>
              {offer.terms}
            </div>
          )}
        </div>
        <div className="flex gap-1 ml-2" style={{ flexShrink: 0 }}>
          <button
            className="btn btn-ghost btn-icon"
            style={{ padding: 6 }}
            onClick={onAccept}
            title="Accept offer"
          >
            <CheckCircle size={18} color="var(--green)" />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            style={{ padding: 6 }}
            onClick={onReject}
            title="Discard offer"
          >
            <X size={18} color="var(--red)" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmailSync() {
  const { cards, apiKeys, hasKeys, settings, addOffers, showToast, setActiveModel } = useApp();
  const [mode, setMode] = useState('paste');
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [extracted, setExtracted] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const fileRef = useRef();

  const cardNames = cards.map(c => c.name);
  const gmailConfigured = !!(settings.gmailClientId && settings.gmailApiKey);

  async function extractFromText(text) {
    if (!text.trim()) {
      showToast('Please paste some email content first', 'error');
      return;
    }
    if (!hasKeys) {
      showToast('Please add AI API keys in Settings first', 'error');
      return;
    }

    setLoading(true);
    setLoadingMsg('Sending to AI for offer extraction...');
    setExtracted([]);

    try {
      const prompt = buildOfferExtractionPrompt(text, cardNames);
      const result = await callAI(prompt, apiKeys);
      setActiveModel(result.model);

      let parsed = [];
      try {
        const clean = result.text.replace(/```json[\s\S]*?```|```/g, '').trim();
        parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        showToast('AI returned unexpected format — try again or use a different model', 'error');
        setLoading(false);
        return;
      }

      // Match cardId from our cards list by fuzzy name comparison
      const matched = parsed.map(o => {
        const oName = (o.cardName || '').toLowerCase();
        const card = cards.find(c => {
          const cName = c.name.toLowerCase();
          return cName.includes(oName) || oName.includes(cName) || c.id === o.cardId;
        });
        return {
          ...o,
          cardId: card?.id || o.cardId || 'unknown',
          cardName: card?.name || o.cardName || 'Unknown Card',
        };
      });

      const highConf = matched.filter(o => (o.confidence ?? 0.5) >= 0.4 && o.discount);
      setExtracted(highConf);

      if (highConf.length > 0) {
        showToast(`Found ${highConf.length} offer(s) — review below`, 'success');
      } else {
        showToast('No offers found in this email. Try a different email.', 'info');
      }
    } catch (err) {
      showToast(`Extraction failed: ${err.message}`, 'error');
    }
    setLoading(false);
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoadingMsg('Reading file...');
    setLoading(true);
    const text = await file.text();
    setLoading(false);
    setEmailText(text);
    await extractFromText(text);
    e.target.value = '';
  }

  async function handleGmailSync() {
    if (!gmailConfigured) {
      showToast('Configure Gmail OAuth in Settings first', 'error');
      return;
    }
    if (!hasKeys) {
      showToast('Add AI API keys in Settings first', 'error');
      return;
    }

    setLoading(true);
    setLoadingMsg('Loading Gmail libraries...');
    try {
      await loadGmailLibraries();
      setLoadingMsg('Initialising Gmail client...');
      await initGmailClient(settings.gmailClientId, settings.gmailApiKey);
      setLoadingMsg('Requesting Gmail access...');
      await requestGmailAccess();
      setGmailConnected(true);
      setLoadingMsg(`Fetching last ${settings.daysBack || 7} days of promo emails...`);
      const emails = await fetchPromotionalEmails(20, settings.daysBack || 7);

      if (emails.length === 0) {
        showToast('No promotional emails found in the selected period', 'info');
        setLoading(false);
        return;
      }

      showToast(`Fetched ${emails.length} emails — extracting offers...`, 'info');

      const allExtracted = [];
      for (let i = 0; i < emails.length; i++) {
        setLoadingMsg(`Processing email ${i + 1} of ${emails.length}...`);
        const email = emails[i];
        try {
          const prompt = buildOfferExtractionPrompt(
            `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`,
            cardNames
          );
          const result = await callAI(prompt, apiKeys);
          const clean = result.text.replace(/```json[\s\S]*?```|```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed)) {
            parsed.forEach(o => {
              if (o.discount && (o.confidence ?? 0.5) >= 0.4) {
                const card = cards.find(c => {
                  const cName = c.name.toLowerCase();
                  const oName = (o.cardName || '').toLowerCase();
                  return cName.includes(oName) || oName.includes(cName);
                });
                allExtracted.push({
                  ...o,
                  cardId: card?.id || 'unknown',
                  cardName: card?.name || o.cardName,
                  source: `Gmail: ${email.subject?.slice(0, 50)}`,
                });
              }
            });
          }
        } catch {
          // Skip emails that fail — continue with next
        }
      }

      setExtracted(allExtracted);
      if (allExtracted.length > 0) {
        showToast(`Found ${allExtracted.length} offer(s) across ${emails.length} emails!`, 'success');
      } else {
        showToast('No offers found in recent emails', 'info');
      }
    } catch (err) {
      showToast(`Gmail sync failed: ${err.message}`, 'error');
    }
    setLoading(false);
  }

  function acceptOffer(offer) {
    addOffers([offer]);
    setExtracted(prev => prev.filter(o => o !== offer));
    showToast('Offer saved!', 'success');
  }

  function acceptAll() {
    if (extracted.length === 0) return;
    addOffers(extracted);
    showToast(`${extracted.length} offers saved!`, 'success');
    setExtracted([]);
  }

  function rejectOffer(offer) {
    setRejected(prev => [...prev, offer]);
    setExtracted(prev => prev.filter(o => o !== offer));
  }

  return (
    <div className="page">
      {loading && <LoadingOverlay message={loadingMsg} />}

      <div className="page-header">
        <div className="page-title">Email Sync</div>
        <div className="page-subtitle">Extract offers from promotional emails using AI</div>
      </div>

      {!hasKeys && (
        <div className="warning-box mb-4">
          <div className="font-bold mb-1">⚠️ AI Keys Required</div>
          Go to <strong>Settings → AI API Keys</strong> and add at least one key (Gemini recommended) to enable extraction.
        </div>
      )}

      <div className="chips-scroll mb-4">
        {[
          { id: 'paste', label: '📋 Paste Email' },
          { id: 'file', label: '📁 Upload File' },
          { id: 'gmail', label: '📧 Gmail Auto-Sync' },
        ].map(m => (
          <button
            key={m.id}
            className={`chip ${mode === m.id ? 'selected' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Paste mode */}
      {mode === 'paste' && (
        <div className="section">
          <div className="section-title">Paste Email Content</div>
          <div className="info-box mb-3">
            Open a promotional email → Select All (Ctrl+A) → Copy → Paste here. HTML emails work too.
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 160 }}
            placeholder="Paste full email content here (text or HTML)..."
            value={emailText}
            onChange={e => setEmailText(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <button
              className="btn btn-primary flex-1"
              onClick={() => extractFromText(emailText)}
              disabled={loading || !emailText.trim()}
            >
              <Zap size={16} /> Extract Offers
            </button>
            {emailText && (
              <button
                className="btn btn-secondary"
                onClick={() => { setEmailText(''); setExtracted([]); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* File upload mode */}
      {mode === 'file' && (
        <div className="section">
          <div className="section-title">Upload Email File</div>
          <div className="info-box mb-3">
            Save a promotional email as .txt, .html, or .eml and upload it here. Outlook exports .eml files directly.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.html,.eml,.htm"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-secondary btn-full"
            onClick={() => fileRef.current.click()}
            disabled={loading}
          >
            <Upload size={16} /> Choose File (.txt / .html / .eml)
          </button>
          {emailText && (
            <div className="info-box mt-2">
              ✓ File loaded ({emailText.length} chars) — extraction in progress or complete above
            </div>
          )}
        </div>
      )}

      {/* Gmail OAuth mode */}
      {mode === 'gmail' && (
        <div className="section">
          <div className="section-title">Gmail Auto-Sync</div>

          {!gmailConfigured ? (
            <div className="warning-box mb-3">
              <div className="font-bold mb-1">⚙️ Gmail not configured yet</div>
              Go to <strong>Settings → Gmail OAuth Setup</strong> and enter your Google Cloud credentials first.
              The README has a step-by-step guide.
            </div>
          ) : (
            <div className="info-box mb-3">
              ✓ Gmail credentials configured. Tapping Sync will open a Google login popup to authorise read-only access.
            </div>
          )}

          <div className="card mb-3">
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>How it works:</div>
            <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text2)', lineHeight: 2 }}>
              <li>You authorise read-only access to Gmail promotions tab</li>
              <li>App fetches last {settings.daysBack || 7} days of promo emails client-side</li>
              <li>AI scans each email and maps offers to your cards</li>
              <li>You review and approve which offers to keep</li>
            </ol>
          </div>

          <div className="info-box mb-3" style={{ fontSize: 12 }}>
            🔒 Gmail token stays in your browser only. Emails are never stored — only the extracted offer data is saved.
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleGmailSync}
            disabled={loading || !hasKeys}
          >
            {gmailConnected
              ? <><RefreshCw size={16} /> Re-sync Gmail</>
              : <><Mail size={16} /> Connect &amp; Sync Gmail</>}
          </button>

          {gmailConnected && (
            <div className="text-sm text-muted mt-2" style={{ textAlign: 'center' }}>
              Gmail connected ✓ — last synced this session
            </div>
          )}
        </div>
      )}

      {/* Extracted offers review */}
      {extracted.length > 0 && (
        <div className="section">
          <div className="flex items-center justify-between mb-2">
            <div className="section-title" style={{ margin: 0 }}>
              Review Extracted Offers ({extracted.length})
            </div>
            <button className="btn btn-primary btn-sm" onClick={acceptAll}>
              <Plus size={12} /> Accept All
            </button>
          </div>
          <div className="info-box mb-3">
            Tap ✓ to save an offer or ✗ to discard. Review carefully — AI can occasionally mis-read offers.
          </div>
          {extracted.map((offer, i) => (
            <ExtractedOfferPreview
              key={`${offer.cardId}_${i}`}
              offer={offer}
              onAccept={() => acceptOffer(offer)}
              onReject={() => rejectOffer(offer)}
            />
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="text-sm text-dim mb-3" style={{ textAlign: 'center' }}>
          {rejected.length} offer(s) discarded this session
        </div>
      )}

      <div className="section">
        <div className="section-title">Tips for Best Results</div>
        <div className="card">
          {[
            '📧 Copy the full email including subject and sender for better context',
            '🖼️ If the offer is only in an image, type it out as text before pasting',
            '📅 Include emails with dates visible for accurate expiry tracking',
            '🔁 Process one email at a time for cleanest extraction',
            '💎 Gemini 1.5 Pro gives the best results for complex offer emails',
            '🔄 If extraction looks wrong, try again — AI results can vary slightly',
          ].map((tip, i, arr) => (
            <div
              key={i}
              style={{
                fontSize: 13,
                color: 'var(--text2)',
                padding: '7px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                lineHeight: 1.5,
              }}
            >
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
