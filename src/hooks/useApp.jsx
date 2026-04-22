import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage, encryptData, decryptData } from '../utils/storage';
import { CARDS_DATA } from '../data/cards';
import { offerDedupeKey, dedupeOffersByKey, stripOfferReviewMeta } from '../utils/offerDedupe';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [cards, setCards] = useState([]);
  const [offers, setOffers] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [settings, setSettings] = useState({
    pin: null, sessionOnly: false, daysBack: 7, autoPurge: false, theme: 'dark',
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeModel, setActiveModel] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load data on mount
  useEffect(() => {
    const savedCards = storage.get('cards');
    const savedOffers = storage.get('offers', []);
    const savedSettings = storage.get('settings', {});
    const savedGmail = storage.get('gmail_accounts', []);

    if (savedCards && savedCards.length > 0) {
      setCards(savedCards);
    } else {
      setCards(CARDS_DATA);
      storage.set('cards', CARDS_DATA);
    }

    const dedupedOffers = dedupeOffersByKey(savedOffers);
    setOffers(dedupedOffers);
    if (dedupedOffers.length !== savedOffers.length) {
      storage.set('offers', dedupedOffers);
    }
    setSettings(s => ({ ...s, ...savedSettings }));
    setGmailAccounts(savedGmail);

    const savedKeys = storage.get('api_keys', {});
    setApiKeys(savedKeys);

    if (!savedSettings.pin) setIsUnlocked(true);
    setDataLoaded(true);
  }, []);

  // Theme on <html> + PWA chrome (after settings load or when user changes)
  useEffect(() => {
    const theme = settings.theme === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');

    const themeColor = theme === 'light' ? '#f1f5f9' : '#0f172a';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    document
      .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
  }, [settings.theme]);

  // Auto-purge expired offers ONLY after data is loaded and autoPurge is on
  useEffect(() => {
    if (!dataLoaded || !settings.autoPurge) return;
    const today = new Date().toISOString().slice(0, 10);
    const valid = offers.filter(o => !o.validUntil || o.validUntil >= today);
    if (valid.length < offers.length) {
      setOffers(valid);
      storage.set('offers', valid);
    }
  }, [dataLoaded]); // eslint-disable-line

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const saveCards = useCallback((newCards) => {
    setCards(newCards);
    storage.set('cards', newCards);
  }, []);

  const saveOffers = useCallback((newOffers) => {
    setOffers(newOffers);
    storage.set('offers', newOffers);
  }, []);

  const addOffer = useCallback((offer) => {
    const clean = stripOfferReviewMeta(offer);
    let created = null;
    setOffers((prev) => {
      const k = offerDedupeKey(clean);
      if (!k || prev.some((o) => offerDedupeKey(o) === k)) {
        return prev;
      }
      const withId = {
        ...clean,
        id: `offer_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        addedAt: new Date().toISOString(),
      };
      created = withId;
      const updated = [withId, ...prev];
      storage.set('offers', updated);
      return updated;
    });
    return created;
  }, []);

  const addOffers = useCallback((newOffers) => {
    const base = Date.now();
    let addedRows = [];
    setOffers((prev) => {
      const existing = new Set(prev.map(offerDedupeKey));
      const cleanList = (newOffers || []).map(stripOfferReviewMeta).filter((o) => {
        const k = offerDedupeKey(o);
        if (!k || existing.has(k)) return false;
        existing.add(k);
        return true;
      });
      const withIds = cleanList.map((o, i) => ({
        ...o,
        id: `offer_${base}_${i}_${Math.random().toString(36).slice(2)}`,
        addedAt: new Date().toISOString(),
      }));
      addedRows = withIds;
      if (withIds.length === 0) return prev;
      const updated = [...withIds, ...prev];
      storage.set('offers', updated);
      return updated;
    });
    return addedRows;
  }, []);

  const deleteOffer = useCallback((id) => {
    setOffers(prev => {
      const updated = prev.filter(o => o.id !== id);
      storage.set('offers', updated);
      return updated;
    });
  }, []);

  const saveApiKeys = useCallback(async (keys, pin = null) => {
    setApiKeys(keys);
    if (pin) {
      const encrypted = await encryptData(keys, pin);
      storage.set('api_keys_enc', encrypted);
    } else {
      storage.set('api_keys', keys);
    }
  }, []);

  const unlockWithPin = useCallback(async (pin) => {
    const encrypted = storage.get('api_keys_enc');
    if (encrypted) {
      const decrypted = await decryptData(encrypted, pin);
      if (decrypted) {
        setApiKeys(decrypted);
        setIsUnlocked(true);
        return true;
      }
      return false;
    }
    setIsUnlocked(true);
    return true;
  }, []);

  const saveSettings = useCallback((newSettings) => {
    setSettings(s => {
      const updated = { ...s, ...newSettings };
      storage.set('settings', updated);
      return updated;
    });
  }, []);

  const saveGmailAccounts = useCallback((accounts) => {
    setGmailAccounts(accounts);
    storage.set('gmail_accounts', accounts);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const activeOffers = offers.filter(o => !o.validUntil || o.validUntil >= today);
  const expiredOffers = offers.filter(o => o.validUntil && o.validUntil < today);

  // hasKeys: true only if at least one key has a non-empty value
  const hasKeys = Object.values(apiKeys).some(v => v && v.trim() !== '');

  return (
    <AppContext.Provider value={{
      cards, saveCards,
      offers, activeOffers, expiredOffers, saveOffers, addOffer, addOffers, deleteOffer,
      apiKeys, saveApiKeys, hasKeys,
      gmailAccounts, saveGmailAccounts,
      settings, saveSettings,
      isUnlocked, unlockWithPin,
      toast, showToast,
      activeModel, setActiveModel,
      dataLoaded,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
