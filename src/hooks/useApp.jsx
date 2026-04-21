import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage, encryptData, decryptData } from '../utils/storage';
import { CARDS_DATA } from '../data/cards';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [cards, setCards] = useState([]);
  const [offers, setOffers] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [settings, setSettings] = useState({ pin: null, sessionOnly: false, daysBack: 7, autoPurge: false });
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

    setOffers(savedOffers);
    setSettings(s => ({ ...s, ...savedSettings }));
    setGmailAccounts(savedGmail);

    const savedKeys = storage.get('api_keys', {});
    setApiKeys(savedKeys);

    if (!savedSettings.pin) setIsUnlocked(true);
    setDataLoaded(true);
  }, []);

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
    const withId = {
      ...offer,
      id: `offer_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      addedAt: new Date().toISOString()
    };
    setOffers(prev => {
      const updated = [withId, ...prev];
      storage.set('offers', updated);
      return updated;
    });
    return withId;
  }, []);

  const addOffers = useCallback((newOffers) => {
    const withIds = newOffers.map(o => ({
      ...o,
      id: `offer_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      addedAt: new Date().toISOString()
    }));
    setOffers(prev => {
      const updated = [...withIds, ...prev];
      storage.set('offers', updated);
      return updated;
    });
    return withIds;
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
