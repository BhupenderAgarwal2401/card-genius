import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { callAI, buildOfferExtractionPrompt } from '../utils/aiService';
import {
  loadGmailLibraries,
  initGmailClient,
  requestGmailAccess,
  fetchEmailSummariesPage,
  fetchFullEmail,
  prefersGmailRedirectUx,
  readGmailOAuthError,
  readGmailJustConnected,
  clearStoredGmailToken,
  getGmailRedirectUri,
  formatGmailApiError,
} from '../utils/gmailService';
import { parseOfferJsonArrayFromText } from '../utils/parseAiJson';
import {
  matchesIndianOffersHeuristic,
  filterSummariesIndianFocus,
} from '../utils/indianSenderFilter';
import { loadEmailSyncSession, saveEmailSyncSession } from '../utils/emailSyncSession';
import { dedupeOffersByKey, stripOfferReviewMeta, withReviewIds, offerDedupeKey } from '../utils/offerDedupe';
import {
  Mail, Upload, Zap, CheckCircle, X, Plus, LogOut, Inbox, Shield, Sparkles, ChevronDown,
} from 'lucide-react';

function dedupeSummariesById(rows) {
  const m = new Map();
  (rows || []).forEach((r) => {
    if (r?.id) m.set(r.id, r);
  });
  return [...m.values()];
}

function LoadingOverlay({ message }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <div className="loading-text">{message}</div>
    </div>
  );
}

function ExtractedOfferPreview({ offer, selected, onToggleSelect, onAccept, onReject }) {
  return (
    <div className="card-sm mb-2 email-sync-extract-row" style={{ border: '1px solid var(--border2)' }}>
      <div className="flex gap-3 items-start">
        <input
          type="checkbox"
          className="email-sync-extract-check"
          checked={selected}
          onChange={() => onToggleSelect(offer._rid)}
          aria-label="Select to save with batch"
        />
        <div className="flex-1 min-w-0">
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
        <div className="flex gap-1 flex-shrink-0" style={{ marginTop: 2 }}>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            style={{ padding: 8 }}
            onClick={onAccept}
            title="Save this offer now"
          >
            <CheckCircle size={20} color="var(--green)" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            style={{ padding: 8 }}
            onClick={onReject}
            title="Discard"
          >
            <X size={20} color="var(--red)" />
          </button>
        </div>
      </div>
    </div>
  );
}

function offerPassesFilter(o) {
  const d = (o.discount || '').toString().trim();
  if (!d) return false;
  const c = o.confidence ?? 0.5;
  return c >= 0.35;
}

export default function EmailSync() {
  const { cards, apiKeys, hasKeys, settings, addOffers, showToast, setActiveModel } = useApp();
  const [mode, setMode] = useState('paste');
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [extracted, setExtracted] = useState([]);
  const [reviewPick, setReviewPick] = useState(() => new Set());
  const [rejected, setRejected] = useState([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailSummariesAll, setGmailSummariesAll] = useState([]);
  const [gmailNextPageToken, setGmailNextPageToken] = useState(null);
  const [gmailSelectedIds, setGmailSelectedIds] = useState(() => new Set());
  const [gmailInboxScope, setGmailInboxScope] = useState('broad');
  const [gmailDaysBack, setGmailDaysBack] = useState(() => settings.daysBack || 7);
  const [gmailPageSize, setGmailPageSize] = useState(25);
  const [indianOffersFocus, setIndianOffersFocus] = useState(true);
  const [gmailScanLog, setGmailScanLog] = useState([]);
  const [sessionReady, setSessionReady] = useState(false);
  const fileRef = useRef();

  const gmailSelectedKey = useMemo(
    () => [...gmailSelectedIds].sort().join(','),
    [gmailSelectedIds]
  );
  const reviewPickKey = useMemo(() => [...reviewPick].sort().join(','), [reviewPick]);

  const cardNames = cards.map(c => c.name);

  function commitExtractedReview(rows) {
    const stamped = withReviewIds(dedupeOffersByKey(rows || []));
    setExtracted(stamped);
    setReviewPick(new Set(stamped.map((o) => o._rid)));
  }
  const gmailConfigured = !!(settings.gmailClientId && settings.gmailApiKey);

  const gmailVisibleRows = useMemo(() => {
    if (!gmailSummariesAll.length) return [];
    return indianOffersFocus
      ? filterSummariesIndianFocus(gmailSummariesAll)
      : gmailSummariesAll;
  }, [gmailSummariesAll, indianOffersFocus]);

  useEffect(() => {
    const oauthErr = readGmailOAuthError();
    if (oauthErr?.error) {
      showToast(`Google sign-in was cancelled or failed (${oauthErr.error})`, 'error');
    }
    if (readGmailJustConnected()) {
      showToast('Gmail sign-in completed. Tap “Load inbox” to list messages.', 'success');
    }
  }, [showToast]);

  useEffect(() => {
    const d = loadEmailSyncSession();
    if (d) {
      if (d.mode === 'paste' || d.mode === 'file' || d.mode === 'gmail') setMode(d.mode);
      if (typeof d.emailText === 'string') setEmailText(d.emailText);
      if (Array.isArray(d.extracted)) {
        const stamped = withReviewIds(dedupeOffersByKey(d.extracted));
        setExtracted(stamped);
        const savedPick = Array.isArray(d.reviewPick) ? d.reviewPick : [];
        const validPick = savedPick.filter((id) => stamped.some((o) => o._rid === id));
        setReviewPick(new Set(validPick.length > 0 ? validPick : stamped.map((o) => o._rid)));
      }
      if (Array.isArray(d.rejected)) setRejected(d.rejected);
      if (typeof d.gmailConnected === 'boolean') setGmailConnected(d.gmailConnected);
      if (Array.isArray(d.gmailSummariesAll)) setGmailSummariesAll(d.gmailSummariesAll);
      setGmailNextPageToken(d.gmailNextPageToken ?? null);
      if (Array.isArray(d.gmailSelectedIds)) setGmailSelectedIds(new Set(d.gmailSelectedIds));
      if (typeof d.gmailInboxScope === 'string') setGmailInboxScope(d.gmailInboxScope);
      if (typeof d.gmailDaysBack === 'number' && d.gmailDaysBack >= 1 && d.gmailDaysBack <= 90) {
        setGmailDaysBack(d.gmailDaysBack);
      }
      if (typeof d.gmailPageSize === 'number') setGmailPageSize(d.gmailPageSize);
      if (typeof d.indianOffersFocus === 'boolean') setIndianOffersFocus(d.indianOffersFocus);
      if (Array.isArray(d.gmailScanLog)) setGmailScanLog(d.gmailScanLog);
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const t = setTimeout(() => {
      saveEmailSyncSession({
        mode,
        emailText,
        extracted,
        rejected,
        gmailConnected,
        gmailSummariesAll,
        gmailNextPageToken,
        gmailSelectedIds: [...gmailSelectedIds],
        gmailInboxScope,
        gmailDaysBack,
        gmailPageSize,
        indianOffersFocus,
        gmailScanLog,
        reviewPick: [...reviewPick],
      });
    }, 450);
    return () => clearTimeout(t);
  }, [
    sessionReady,
    mode,
    emailText,
    extracted,
    rejected,
    gmailConnected,
    gmailSummariesAll,
    gmailNextPageToken,
    gmailSelectedKey,
    gmailInboxScope,
    gmailDaysBack,
    gmailPageSize,
    indianOffersFocus,
    gmailScanLog,
    reviewPickKey,
  ]);

  useEffect(() => {
    if (!gmailSummariesAll.length) return;
    const vis = indianOffersFocus
      ? filterSummariesIndianFocus(gmailSummariesAll)
      : gmailSummariesAll;
    const vset = new Set(vis.map((s) => s.id));
    setGmailSelectedIds((prev) => {
      const kept = [...prev].filter((id) => vset.has(id));
      if (kept.length > 0) return new Set(kept);
      return vset;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when India filter toggles; loads set selection in handlers
  }, [indianOffersFocus]);

  function setGmailSelectionForAll(checked) {
    if (checked) setGmailSelectedIds(new Set(gmailVisibleRows.map((s) => s.id)));
    else setGmailSelectedIds(new Set());
  }

  function toggleGmailSelection(id) {
    setGmailSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function ensureGmailSession() {
    await loadGmailLibraries();
    const useRedirect = prefersGmailRedirectUx();
    await initGmailClient(settings.gmailClientId, settings.gmailApiKey, { useRedirect });
    const auth = await requestGmailAccess({ useRedirect });
    if (auth.redirected) {
      showToast(
        'Opening Google sign-in… If the app reloads, open Email again and tap Load inbox.',
        'info'
      );
      return false;
    }
    return true;
  }

  function handleGmailSignOut() {
    clearStoredGmailToken();
    setGmailConnected(false);
    setGmailSummariesAll([]);
    setGmailNextPageToken(null);
    setGmailSelectedIds(new Set());
    setGmailScanLog([]);
    showToast('Gmail session cleared from this device', 'info');
  }

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
    commitExtractedReview([]);

    try {
      const prompt = buildOfferExtractionPrompt(text, cardNames);
      const result = await callAI(prompt, apiKeys, null, { preferJsonMime: true });
      setActiveModel(result.model);

      const parsedRes = parseOfferJsonArrayFromText(result.text);
      if (!parsedRes.ok) {
        showToast('AI returned unexpected format — try again or use a different model', 'error');
        setLoading(false);
        return;
      }
      let parsed = Array.isArray(parsedRes.parsed)
        ? parsedRes.parsed.filter((o) => o && typeof o === 'object')
        : [];

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

      const highConf = matched.filter(offerPassesFilter);
      commitExtractedReview(highConf);

      if (highConf.length > 0) {
        showToast(`Found ${dedupeOffersByKey(highConf).length} unique offer(s) — review below`, 'success');
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

  async function handleGmailLoadInbox() {
    if (!gmailConfigured) {
      showToast('Configure Gmail OAuth in Settings first', 'error');
      return;
    }

    setLoading(true);
    setLoadingMsg('Connecting to Gmail…');
    setGmailScanLog([]);
    try {
      const ok = await ensureGmailSession();
      if (!ok) {
        setLoading(false);
        return;
      }

      setLoadingMsg(`Loading messages (last ${gmailDaysBack} days)…`);
      const { summaries, nextPageToken } = await fetchEmailSummariesPage({
        maxResults: gmailPageSize,
        daysBack: gmailDaysBack,
        scope: gmailInboxScope,
        pageToken: null,
      });
      setGmailSummariesAll(summaries);
      setGmailNextPageToken(nextPageToken);
      const visible = indianOffersFocus
        ? filterSummariesIndianFocus(summaries)
        : summaries;
      setGmailSelectedIds(new Set(visible.map((s) => s.id)));
      setGmailConnected(true);

      if (summaries.length === 0) {
        showToast('No messages matched this search. Try another category, more days, or “All mail”.', 'info');
      } else {
        showToast(
          `Loaded ${summaries.length} message(s)${indianOffersFocus ? ` — ${visible.length} match India bank/shopping filter` : ''}.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Gmail load inbox failed', err);
      showToast(`Gmail failed: ${formatGmailApiError(err)}`, 'error');
    }
    setLoading(false);
  }

  async function handleGmailLoadMore() {
    if (!gmailConfigured || !gmailNextPageToken) {
      if (!gmailNextPageToken) showToast('No more results for this search.', 'info');
      return;
    }
    setLoading(true);
    setLoadingMsg('Loading more messages…');
    try {
      const ok = await ensureGmailSession();
      if (!ok) {
        setLoading(false);
        return;
      }
      const { summaries, nextPageToken } = await fetchEmailSummariesPage({
        maxResults: gmailPageSize,
        daysBack: gmailDaysBack,
        scope: gmailInboxScope,
        pageToken: gmailNextPageToken,
      });
      const merged = dedupeSummariesById([...gmailSummariesAll, ...summaries]);
      setGmailSummariesAll(merged);
      setGmailNextPageToken(nextPageToken);
      setGmailSelectedIds((prev) => {
        const next = new Set(prev);
        summaries.forEach((s) => {
          if (!indianOffersFocus || matchesIndianOffersHeuristic(s)) next.add(s.id);
        });
        return next;
      });
      showToast(`Added ${summaries.length} more (total ${merged.length}).`, 'success');
    } catch (err) {
      console.error('Gmail load more failed', err);
      showToast(`Could not load more: ${formatGmailApiError(err)}`, 'error');
    }
    setLoading(false);
  }

  async function handleGmailExtractSelected() {
    if (!gmailConfigured || !hasKeys) {
      showToast('Configure Gmail and add AI API keys in Settings first', 'error');
      return;
    }
    const ids = [...gmailSelectedIds];
    if (ids.length === 0) {
      showToast('Select at least one email to scan', 'error');
      return;
    }

    setLoading(true);
    commitExtractedReview([]);
    const initialLog = ids.map((id) => {
      const s = gmailSummariesAll.find((x) => x.id === id);
      return {
        id,
        subject: s?.subject || '(unknown)',
        from: s?.from || '',
        status: 'pending',
        offersFound: 0,
        note: '',
      };
    });
    setGmailScanLog(initialLog);

    try {
      const ok = await ensureGmailSession();
      if (!ok) {
        setLoading(false);
        return;
      }

      const allExtracted = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        setLoadingMsg(`AI scan ${i + 1} of ${ids.length}…`);

        const updateLog = (patch) => {
          setGmailScanLog((prev) =>
            prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
          );
        };

        try {
          const email = await fetchFullEmail(id);
          const prompt = buildOfferExtractionPrompt(
            `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`,
            cardNames
          );
          const result = await callAI(prompt, apiKeys, null, { preferJsonMime: true });
          setActiveModel(result.model);
          const parsedRes = parseOfferJsonArrayFromText(result.text);
          if (!parsedRes.ok) {
            const clip = (result.text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
            updateLog({
              status: 'parse_error',
              note: clip ? `Unparseable output: ${clip}…` : 'AI output was not valid JSON',
              offersFound: 0,
            });
            continue;
          }
          let parsed = Array.isArray(parsedRes.parsed)
            ? parsedRes.parsed.filter((o) => o && typeof o === 'object')
            : [];

          let count = 0;
          parsed.forEach((o) => {
            if (!offerPassesFilter(o)) return;
            const card = cards.find((c) => {
              const cName = c.name.toLowerCase();
              const oName = (o.cardName || '').toLowerCase();
              return cName.includes(oName) || oName.includes(cName) || c.id === o.cardId;
            });
            allExtracted.push({
              ...o,
              cardId: card?.id || o.cardId || 'unknown',
              cardName: card?.name || o.cardName || 'Unknown Card',
              source: `Gmail: ${email.subject?.slice(0, 60)}`,
            });
            count += 1;
          });

          updateLog({
            status: count > 0 ? 'ok' : 'empty',
            offersFound: count,
            note: count > 0 ? `${count} offer(s)` : 'No card-related offers detected',
          });
        } catch (err) {
          updateLog({
            status: 'error',
            offersFound: 0,
            note: formatGmailApiError(err).slice(0, 220),
          });
        }
      }

      commitExtractedReview(allExtracted);
      const uniq = dedupeOffersByKey(allExtracted).length;
      if (allExtracted.length > 0) {
        showToast(
          uniq < allExtracted.length
            ? `Found ${uniq} unique offer(s) (${allExtracted.length - uniq} duplicate rows merged) — review below`
            : `Found ${uniq} offer(s) — review below`,
          'success'
        );
      } else {
        showToast('No offers matched your cards in the selected messages.', 'info');
      }
    } catch (err) {
      showToast(`Extraction failed: ${err.message}`, 'error');
    }
    setLoading(false);
  }

  function acceptOffer(offer) {
    const added = addOffers([stripOfferReviewMeta(offer)]);
    if (!added.length) {
      showToast('This offer is already in your list', 'info');
      return;
    }
    setExtracted((prev) => prev.filter((o) => o._rid !== offer._rid));
    setReviewPick((prev) => {
      const next = new Set(prev);
      next.delete(offer._rid);
      return next;
    });
    showToast('Offer saved!', 'success');
  }

  function saveSelectedExtracted() {
    const selected = extracted.filter((o) => reviewPick.has(o._rid));
    if (!selected.length) {
      showToast('Tick at least one offer to save, or use Save all', 'info');
      return;
    }
    const added = addOffers(selected.map(stripOfferReviewMeta));
    const addedKeys = new Set(added.map(offerDedupeKey));
    setExtracted((prev) =>
      prev.filter((o) => {
        if (!reviewPick.has(o._rid)) return true;
        return !addedKeys.has(offerDedupeKey(stripOfferReviewMeta(o)));
      })
    );
    setReviewPick((prev) => {
      const next = new Set(prev);
      prev.forEach((rid) => {
        const o = extracted.find((x) => x._rid === rid);
        if (o && addedKeys.has(offerDedupeKey(stripOfferReviewMeta(o)))) next.delete(rid);
      });
      return next;
    });
    const skipped = selected.length - added.length;
    showToast(
      skipped > 0
        ? `Saved ${added.length} offer(s). ${skipped} were already in your list.`
        : `Saved ${added.length} offer(s)!`,
      'success'
    );
  }

  function saveAllExtracted() {
    if (extracted.length === 0) return;
    const added = addOffers(extracted.map(stripOfferReviewMeta));
    const skipped = extracted.length - added.length;
    commitExtractedReview([]);
    showToast(
      skipped > 0
        ? `Saved ${added.length} offer(s). ${skipped} duplicate(s) skipped (already saved).`
        : `${added.length} offer(s) saved!`,
      'success'
    );
  }

  function toggleReviewPick(rid) {
    setReviewPick((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  }

  function selectAllReviewPick() {
    setReviewPick(new Set(extracted.map((o) => o._rid)));
  }

  function clearReviewPick() {
    setReviewPick(new Set());
  }

  function rejectOffer(offer) {
    setRejected((prev) => [...prev, offer]);
    setExtracted((prev) => prev.filter((o) => o._rid !== offer._rid));
    setReviewPick((prev) => {
      const next = new Set(prev);
      next.delete(offer._rid);
      return next;
    });
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

      <div className="email-sync-tabs chips-scroll mb-4">
        {[
          { id: 'paste', label: 'Paste', sub: 'Manual' },
          { id: 'file', label: 'File', sub: '.eml / .html' },
          { id: 'gmail', label: 'Gmail', sub: 'Inbox' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            className={`email-sync-tab ${mode === m.id ? 'selected' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span className="email-sync-tab-label">{m.label}</span>
            <span className="email-sync-tab-sub">{m.sub}</span>
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
                onClick={() => {
                  setEmailText('');
                  commitExtractedReview([]);
                }}
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
        <div className="section email-sync-gmail">
          <div className="email-sync-hero mb-4">
            <div className="email-sync-hero-icon">
              <Inbox size={22} strokeWidth={2} />
            </div>
            <div>
              <div className="email-sync-hero-title">Gmail inbox</div>
              <p className="email-sync-hero-text">
                Pick a date range and Gmail category, load threads, then run AI only on the messages you select.
              </p>
            </div>
          </div>

          {!gmailConfigured ? (
            <div className="warning-box mb-3">
              <div className="font-bold mb-1">Gmail not configured</div>
              Go to <strong>Settings → Gmail OAuth Setup</strong> and add your Google Cloud credentials.
            </div>
          ) : (
            <div className="email-sync-status-ok mb-3">
              <Sparkles size={16} className="text-accent" />
              <span>Gmail is ready — adjust filters below, then <strong>Load inbox</strong>.</span>
            </div>
          )}

          {prefersGmailRedirectUx() && (
            <div className="email-sync-pwa-note mb-3">
              <strong>Installed app:</strong> Google sign-in uses a redirect (not a popup). Add this exact redirect URI
              in Google Cloud → OAuth client:{' '}
              <code className="email-sync-code">{getGmailRedirectUri()}</code>
            </div>
          )}

          <div className="email-sync-privacy mb-4">
            <Shield size={14} />
            <span>
              Token stays in this browser. Only selected message text is sent to your AI provider; saved offers stay in
              CardGenius.
            </span>
          </div>

          {gmailConfigured && (
            <>
              <div className="email-sync-panel mb-4">
                <div className="email-sync-panel-title">Search &amp; filters</div>
                <div className="email-sync-grid">
                  <div className="email-sync-field">
                    <label className="label" htmlFor="cg-days-back">Days to look back</label>
                    <input
                      id="cg-days-back"
                      className="input"
                      type="number"
                      min={1}
                      max={90}
                      value={gmailDaysBack}
                      onChange={(e) => setGmailDaysBack(Math.min(90, Math.max(1, Number(e.target.value) || 7)))}
                    />
                    <p className="email-sync-field-hint">Gmail search window (older mail is ignored).</p>
                  </div>
                  <div className="email-sync-field">
                    <label className="label" htmlFor="cg-page-size">Max threads per fetch</label>
                    <select
                      id="cg-page-size"
                      className="input select"
                      value={gmailPageSize}
                      onChange={(e) => setGmailPageSize(Number(e.target.value))}
                    >
                      {[15, 25, 40, 50].map((n) => (
                        <option key={n} value={n}>
                          Up to {n}
                        </option>
                      ))}
                    </select>
                    <p className="email-sync-field-hint">
                      Upper cap each time you tap Load inbox / Load more. Gmail may return fewer if not enough
                      matches. This is <em>not</em> how many lines you always see below.
                    </p>
                  </div>
                </div>

                <label className="label mt-3">Gmail category</label>
                <div className="email-sync-chip-grid">
                  {[
                    { id: 'broad', label: 'Smart mix', hint: 'Promo + updates + primary + forums' },
                    { id: 'promotions', label: 'Promotions', hint: 'Offers tab' },
                    { id: 'primary', label: 'Primary', hint: 'Main inbox' },
                    { id: 'updates', label: 'Updates', hint: 'Receipts & alerts' },
                    { id: 'social', label: 'Social', hint: 'Social networks' },
                    { id: 'forums', label: 'Forums', hint: 'Lists & groups' },
                    { id: 'all', label: 'All mail', hint: 'No category filter (noisier)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`email-sync-scope-chip ${gmailInboxScope === opt.id ? 'active' : ''}`}
                      onClick={() => setGmailInboxScope(opt.id)}
                      title={opt.hint}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <label className="email-sync-toggle mt-3">
                  <input
                    type="checkbox"
                    checked={indianOffersFocus}
                    onChange={(e) => setIndianOffersFocus(e.target.checked)}
                  />
                  <span>
                    <strong>India bank &amp; shopping focus</strong>
                    <span className="email-sync-toggle-hint">
                      When on, the list below only shows threads that look like Indian banks or shopping — so you can
                      load 50 from Gmail but see far fewer rows. Turn off to see every fetched message.
                    </span>
                  </span>
                </label>
              </div>

              <div className="email-sync-actions mb-3">
                <button
                  className="btn btn-primary email-sync-btn-primary"
                  type="button"
                  onClick={handleGmailLoadInbox}
                  disabled={loading}
                >
                  <Mail size={18} />
                  <span>Load inbox</span>
                </button>
                <button
                  className="btn btn-secondary email-sync-btn-secondary"
                  type="button"
                  onClick={handleGmailLoadMore}
                  disabled={loading || !gmailNextPageToken || !gmailSummariesAll.length}
                >
                  <ChevronDown size={18} />
                  <span>Load more</span>
                </button>
                <button
                  className="btn btn-ghost email-sync-btn-ghost"
                  type="button"
                  onClick={handleGmailSignOut}
                  disabled={loading}
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>

              {gmailSummariesAll.length > 0 && (
                <div className="email-sync-inbox-card mb-3">
                  <div className="email-sync-inbox-head">
                    <div>
                      <div className="email-sync-inbox-title">Messages</div>
                      <div className="email-sync-inbox-meta">
                        <strong className="text-accent">{gmailVisibleRows.length}</strong> in list
                        {indianOffersFocus && gmailSummariesAll.length > gmailVisibleRows.length ? (
                          <span>
                            {' '}
                            (India filter) · <strong>{gmailSummariesAll.length}</strong> fetched from Gmail
                          </span>
                        ) : (
                          <span>
                            {' '}
                            · <strong>{gmailSummariesAll.length}</strong> fetched from Gmail
                          </span>
                        )}
                        {gmailNextPageToken ? ' · more available' : ''} · {gmailSelectedIds.size} selected
                      </div>
                    </div>
                    <div className="email-sync-inbox-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGmailSelectionForAll(true)}>
                        All visible
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGmailSelectionForAll(false)}>
                        None
                      </button>
                    </div>
                  </div>
                  {indianOffersFocus &&
                    gmailSummariesAll.length > 0 &&
                    gmailVisibleRows.length < gmailSummariesAll.length && (
                      <div className="email-sync-filter-banner" role="status">
                        <strong>{gmailVisibleRows.length}</strong> of <strong>{gmailSummariesAll.length}</strong>{' '}
                        fetched threads match the India filter. The rest stay loaded but hidden — turn off{' '}
                        <strong>India bank {'&'} shopping focus</strong> above to list them all.
                      </div>
                    )}
                  <div className="email-sync-inbox-scroll">
                    {gmailVisibleRows.map((row) => (
                      <label key={row.id} className="email-sync-row">
                        <input
                          type="checkbox"
                          className="email-sync-row-check"
                          checked={gmailSelectedIds.has(row.id)}
                          onChange={() => toggleGmailSelection(row.id)}
                        />
                        <span className="email-sync-row-body">
                          <span className="email-sync-row-top">
                            <span className="email-sync-row-subject">{row.subject}</span>
                            {!indianOffersFocus && matchesIndianOffersHeuristic(row) && (
                              <span className="email-sync-badge-india">India match</span>
                            )}
                          </span>
                          <span className="email-sync-row-from">{row.from}</span>
                          {row.snippet && <span className="email-sync-row-snippet">{row.snippet}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-full email-sync-extract-btn"
                type="button"
                onClick={handleGmailExtractSelected}
                disabled={loading || !hasKeys || gmailSelectedIds.size === 0}
              >
                <Zap size={18} />
                Extract from {gmailSelectedIds.size || '0'} selected
              </button>

              {!hasKeys && (
                <p className="text-sm text-muted mt-2" style={{ textAlign: 'center' }}>
                  Add an AI key in Settings to run extraction.
                </p>
              )}

              {gmailScanLog.length > 0 && (
                <div className="email-sync-scan-section mt-4">
                  <div className="email-sync-scan-title">Last scan — per message</div>
                  <div className="email-sync-scan-list">
                    {gmailScanLog.map((row) => (
                      <div key={row.id} className="email-sync-scan-row">
                        <span className={`email-sync-scan-pill email-sync-scan-pill--${row.status}`}>
                          {row.status}
                        </span>
                        <div className="email-sync-scan-body">
                          <div className="email-sync-scan-subject">{row.subject}</div>
                          <div className="email-sync-scan-note">
                            {row.note || (row.status === 'pending' ? '…' : '')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gmailConnected && gmailSummariesAll.length === 0 && (
                <p className="email-sync-empty-hint">Inbox not loaded yet — tap <strong>Load inbox</strong>.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Extracted offers review */}
      {extracted.length > 0 && (
        <div className="section">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="section-title" style={{ margin: 0 }}>
              Review extracted ({extracted.length})
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllReviewPick}>
                Select all
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearReviewPick}>
                Clear selection
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" className="btn btn-primary" onClick={saveSelectedExtracted}>
              <Plus size={14} /> Save selected ({reviewPick.size})
            </button>
            <button type="button" className="btn btn-secondary" onClick={saveAllExtracted}>
              Save all offers
            </button>
          </div>
          <div className="info-box mb-3">
            Tick offers to save in batch, or tap ✓ on one row to save immediately. ✗ discards. Duplicates are skipped
            when saving if the same offer is already in Offers.
          </div>
          {extracted.map((offer) => (
            <ExtractedOfferPreview
              key={offer._rid}
              offer={offer}
              selected={reviewPick.has(offer._rid)}
              onToggleSelect={toggleReviewPick}
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
            '💎 Gemini 2.5 Pro (when your key has access) gives the strongest results for messy offer emails',
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
