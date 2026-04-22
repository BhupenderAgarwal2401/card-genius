import { useState, useRef, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { exportBackup, importBackup } from '../utils/storage';
import {
  Key, Download, Upload, Trash2,
  ChevronDown, ChevronUp, Eye, EyeOff, RefreshCw, Sun, Moon
} from 'lucide-react';

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card mb-3">
      <div
        className="flex items-center justify-between"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <div className="font-bold" style={{ fontSize: 15 }}>{title}</div>
        </div>
        {open
          ? <ChevronUp size={16} color="var(--text3)" />
          : <ChevronDown size={16} color="var(--text3)" />}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function ApiKeyField({ label, field, value, onChange, placeholder, helpText }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value || ''}
          onChange={e => onChange(field, e.target.value)}
          style={{ flex: 1 }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => setShow(!show)}
          style={{ flexShrink: 0 }}
          type="button"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {helpText && <div className="text-xs text-dim mt-1">{helpText}</div>}
    </div>
  );
}

export default function Settings() {
  const { apiKeys, saveApiKeys, settings, saveSettings, showToast } = useApp();
  // Re-sync localKeys when apiKeys changes (e.g. after backup restore)
  const [localKeys, setLocalKeys] = useState({ ...apiKeys });
  const [saving, setSaving] = useState(false);
  const [gmailClientId, setGmailClientId] = useState(settings.gmailClientId || '');
  const [gmailApiKey, setGmailApiKey] = useState(settings.gmailApiKey || '');
  const backupRef = useRef();

  useEffect(() => {
    setLocalKeys({ ...apiKeys });
  }, [apiKeys]);

  function handleKeyChange(field, value) {
    setLocalKeys(prev => ({ ...prev, [field]: value }));
  }

  async function handleSaveKeys() {
    setSaving(true);
    await saveApiKeys(localKeys);
    setSaving(false);
    showToast('API keys saved!', 'success');
  }

  async function handleImportBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importBackup(file);
      showToast('Backup restored! Refreshing...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      showToast('Invalid backup file', 'error');
    }
    e.target.value = '';
  }

  function handleClearAll() {
    if (!window.confirm('This will delete ALL your cards, offers, and settings. Are you sure?')) return;
    localStorage.clear();
    showToast('All data cleared. Refreshing...', 'info');
    setTimeout(() => window.location.reload(), 1500);
  }

  function handleSaveGmail() {
    if (!gmailClientId.trim() || !gmailApiKey.trim()) {
      showToast('Both Client ID and API Key are required', 'error');
      return;
    }
    saveSettings({ gmailClientId: gmailClientId.trim(), gmailApiKey: gmailApiKey.trim() });
    showToast('Gmail settings saved!', 'success');
  }

  const modelStatus = [
    { name: 'Gemini 2.5 Pro', key: localKeys.google, note: 'Best quality (Google AI Pro / paid tier)' },
    { name: 'Gemini 2.5 Flash', key: localKeys.google, note: 'Fast; same Gemini API key' },
    { name: 'Gemini 2.0 Flash', key: localKeys.google, note: 'Extra Google fallback' },
    { name: 'GPT-4o Mini', key: localKeys.openai, note: 'Very cheap fallback' },
    { name: 'Claude Haiku', key: localKeys.anthropic, note: 'Cheapest fallback' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Configure APIs, backup, and preferences</div>
      </div>

      {/* AI API Keys */}
      <Section
        title="AI API Keys"
        icon={<Key size={16} color="var(--accent)" />}
        defaultOpen={!Object.values(apiKeys).some(v => v && v.trim())}
      >
        <div className="info-box mb-3">
          Keys are stored only in your browser. They are sent directly to each AI provider — never to any intermediate server.
        </div>

        <div className="section-title">Model Priority (auto-fallback order)</div>
        <div className="card-sm mb-4">
          {modelStatus.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1"
              style={{ borderBottom: i < modelStatus.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-mono text-dim" style={{ fontSize: 11, minWidth: 18 }}>{i + 1}.</span>
                <div>
                  <div style={{ fontSize: 13 }}>{m.name}</div>
                  <div className="text-xs text-dim">{m.note}</div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: (m.key && m.key.trim()) ? 'var(--green)' : 'var(--text3)' }}>
                {(m.key && m.key.trim()) ? '✓ Set' : 'Not set'}
              </span>
            </div>
          ))}
        </div>

        <ApiKeyField
          label="Google Gemini API Key"
          field="google"
          value={localKeys.google}
          onChange={handleKeyChange}
          placeholder="AIza..."
          helpText="Get a key at aistudio.google.com → Get API Key. Used for Gemini 2.5 / 2.0 (same key for Pro-tier then Flash fallbacks)."
        />
        <ApiKeyField
          label="OpenAI API Key"
          field="openai"
          value={localKeys.openai}
          onChange={handleKeyChange}
          placeholder="sk-..."
          helpText="platform.openai.com → API Keys. GPT-4o-mini used (~$0.00015/1K tokens)."
        />
        <ApiKeyField
          label="Anthropic (Claude) API Key"
          field="anthropic"
          value={localKeys.anthropic}
          onChange={handleKeyChange}
          placeholder="sk-ant-..."
          helpText="console.anthropic.com → API Keys. Claude Haiku used as fallback."
        />

        <button
          className="btn btn-primary btn-full mt-2"
          onClick={handleSaveKeys}
          disabled={saving}
          type="button"
        >
          {saving ? 'Saving...' : '💾  Save API Keys'}
        </button>
      </Section>

      {/* Gmail OAuth Setup */}
      <Section title="Gmail OAuth Setup" icon={<span style={{ fontSize: 16 }}>📧</span>}>
        <div className="info-box mb-3">
          Enables automatic fetching of promotional emails from Gmail. Read-only — the app cannot send emails or modify anything.
        </div>

        <div className="card-sm mb-3">
          <div className="font-bold mb-2" style={{ fontSize: 13 }}>One-time Setup (≈10 min):</div>
          {[
            'Go to console.cloud.google.com → Create New Project',
            'APIs & Services → Library → search "Gmail API" → Enable',
            'Credentials → Create Credentials → OAuth 2.0 Client ID → Web Application',
            'Add your Netlify URL as Authorized JavaScript Origin (e.g. https://your-app.netlify.app)',
            'Also add http://localhost:5173 for local development',
            'Copy the Client ID shown',
            'Create another credential → API Key → restrict it to Gmail API',
            'Paste both values below and save',
          ].map((step, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <div className="text-mono text-dim" style={{ fontSize: 11, minWidth: 20 }}>{i + 1}.</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{step}</div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label className="label">Gmail OAuth Client ID</label>
          <input
            className="input"
            placeholder="xxxx.apps.googleusercontent.com"
            value={gmailClientId}
            onChange={e => setGmailClientId(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label className="label">Gmail API Key</label>
          <input
            className="input"
            type="password"
            placeholder="AIza..."
            value={gmailApiKey}
            onChange={e => setGmailApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSaveGmail} type="button">
          Save Gmail Settings
        </button>
        <div className="text-xs text-dim mt-2" style={{ textAlign: 'center' }}>
          After saving, go to Email Sync → Gmail OAuth to connect and start syncing
        </div>
      </Section>

      {/* Backup & Restore */}
      <Section title="Backup & Restore" icon={<Download size={16} color="var(--green)" />} defaultOpen>
        <div className="info-box mb-3">
          Export a JSON backup of all your cards, offers, and settings. Use it to restore on a new device or after clearing the browser.
        </div>

        <div className="flex-col gap-2">
          <button
            className="btn btn-secondary btn-full"
            onClick={() => { exportBackup(); showToast('Backup downloaded!', 'success'); }}
            type="button"
          >
            <Download size={15} /> Export Backup (.json)
          </button>

          <input
            ref={backupRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportBackup}
          />
          <button
            className="btn btn-secondary btn-full"
            onClick={() => backupRef.current.click()}
            type="button"
          >
            <Upload size={15} /> Import Backup (.json)
          </button>
        </div>

        <div className="card-sm mt-3">
          <div className="font-bold mb-1" style={{ fontSize: 12 }}>What's included in backup:</div>
          <div className="text-sm text-muted">✓ All your cards &amp; custom benefits</div>
          <div className="text-sm text-muted">✓ All saved offers (active &amp; expired)</div>
          <div className="text-sm text-muted">✓ App settings &amp; preferences</div>
          <div className="text-sm text-dim mt-1">✗ API keys — excluded for security (re-enter after restore)</div>
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences" icon={<RefreshCw size={16} color="var(--purple)" />}>
        <div className="form-group">
          <label className="label">Appearance</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn btn-sm flex-1 justify-center ${(settings.theme || 'dark') === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => saveSettings({ theme: 'dark' })}
            >
              <Moon size={15} /> Dark
            </button>
            <button
              type="button"
              className={`btn btn-sm flex-1 justify-center ${(settings.theme || 'dark') === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => saveSettings({ theme: 'light' })}
            >
              <Sun size={15} /> Light
            </button>
          </div>
          <div className="text-xs text-dim mt-1">Saved on this device only</div>
        </div>

        <div className="form-group">
          <label className="label">Email sync look-back period</label>
          <select
            className="select"
            value={settings.daysBack || 7}
            onChange={e => saveSettings({ daysBack: parseInt(e.target.value) })}
          >
            {[3, 7, 14, 30].map(d => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div>
            <div className="font-bold" style={{ fontSize: 14 }}>Auto-purge expired offers</div>
            <div className="text-sm text-muted">Remove expired offers on app open</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoPurge || false}
              onChange={e => saveSettings({ autoPurge: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" icon={<Trash2 size={16} color="var(--red)" />}>
        <div className="warning-box mb-3">
          ⚠️ These actions cannot be undone. Export a backup first!
        </div>
        <button className="btn btn-danger btn-full" onClick={handleClearAll} type="button">
          <Trash2 size={15} /> Clear All Data
        </button>
      </Section>

      {/* About */}
      <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💳</div>
        <div className="font-bold" style={{ fontSize: 16 }}>CardGenius v1.0</div>
        <div className="text-sm text-muted mt-1">Smart credit card offer manager</div>
        <div className="text-xs text-dim mt-2">React + Vite · Deployed on Netlify · PWA</div>
        <div className="text-xs text-dim mt-1">All data stored locally on your device only</div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
