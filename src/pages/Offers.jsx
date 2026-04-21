import { useState, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { REWARD_TYPES, CATEGORIES } from '../data/cards';
import { Plus, Search, Trash2, X, Tag, Info, Download } from 'lucide-react';
import { exportOffersCSV } from '../utils/storage';

function OfferCard({ offer, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = REWARD_TYPES[offer.discountType] || REWARD_TYPES.cashback;
  const isExpiring = offer.validUntil && (new Date(offer.validUntil) - new Date()) / (1000 * 60 * 60 * 24) <= 3;

  return (
    <div className="offer-card mb-2" style={{ borderColor: isExpiring ? 'var(--red)33' : undefined }}>
      <div className="offer-card-accent" style={{ background: isExpiring ? 'var(--red)' : typeInfo.color }} />
      <div style={{ paddingLeft: 12 }}>
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="offer-merchant">{offer.merchant || 'General Offer'}</span>
              <span className="badge" style={{ background: typeInfo.color + '22', color: typeInfo.color }}>
                {typeInfo.label}
              </span>
              {isExpiring && <span className="badge badge-red">Expiring!</span>}
            </div>
            <div className="offer-card-name mt-1">{offer.cardName}</div>
          </div>
          <div className="text-right ml-3" style={{ flexShrink: 0 }}>
            <div className="offer-discount">{offer.discount}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2 flex-wrap">
            {offer.category && <span className="badge badge-gray">{offer.category}</span>}
            {offer.promoCode && (
              <span className="badge badge-blue text-mono">{offer.promoCode}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {offer.validUntil && (
              <span className="offer-expiry">Till {offer.validUntil}</span>
            )}
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => setExpanded(!expanded)}>
              <Info size={13} color="var(--text3)" />
            </button>
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => onDelete(offer.id)}>
              <Trash2 size={13} color="var(--red)" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            {offer.description && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{offer.description}</div>}
            {offer.minSpend && <div className="text-sm text-muted mt-1">Min spend: ₹{offer.minSpend}</div>}
            {offer.maxCashback && <div className="text-sm text-muted mt-1">Max cashback: ₹{offer.maxCashback}</div>}
            {offer.terms && <div className="text-xs text-dim mt-1">{offer.terms}</div>}
            {offer.source && <div className="text-xs text-dim mt-1">Source: {offer.source}</div>}
            {offer.addedAt && <div className="text-xs text-dim mt-1">Added: {offer.addedAt?.slice(0, 10)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function AddOfferModal({ cards, onClose, onAdd }) {
  const [form, setForm] = useState({
    cardId: '', cardName: '', merchant: '', category: 'Online Shopping',
    description: '', discount: '', discountType: 'cashback',
    minSpend: '', maxCashback: '', validFrom: '', validUntil: '',
    promoCode: '', terms: ''
  });

  function handleSubmit() {
    if (!form.cardId || !form.discount) { return; }
    onAdd(form);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontWeight: 800, fontSize: 17 }}>Add Offer</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="form-group">
            <label className="label">Card *</label>
            <select className="select" value={form.cardId} onChange={e => {
              const card = cards.find(c => c.id === e.target.value);
              setForm({ ...form, cardId: e.target.value, cardName: card?.name || '' });
            }}>
              <option value="">Select card...</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Merchant / Brand *</label>
            <input className="input" placeholder="e.g. Amazon, Swiggy" value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Discount / Offer *</label>
            <input className="input" placeholder="e.g. 10%, ₹500 off, 5X points" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Offer Type</label>
            <select className="select" value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}>
              {Object.entries(REWARD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" placeholder="Brief offer description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Min Spend (₹)</label>
              <input className="input" type="number" placeholder="0" value={form.minSpend} onChange={e => setForm({ ...form, minSpend: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Max Cashback (₹)</label>
              <input className="input" type="number" placeholder="No limit" value={form.maxCashback} onChange={e => setForm({ ...form, maxCashback: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Valid From</label>
              <input className="input" type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Valid Until</label>
              <input className="input" type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Promo Code</label>
            <input className="input" placeholder="Optional" value={form.promoCode} onChange={e => setForm({ ...form, promoCode: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Terms & Conditions</label>
            <textarea className="textarea" placeholder="Key T&Cs" value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary btn-full mt-3" onClick={handleSubmit}>Add Offer</button>
      </div>
    </div>
  );
}

export default function Offers() {
  const { cards, activeOffers, expiredOffers, addOffer, deleteOffer, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterCard, setFilterCard] = useState('All');
  const [showExpired, setShowExpired] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const allOffers = showExpired ? expiredOffers : activeOffers;

  const filtered = useMemo(() => allOffers.filter(o =>
    (filterCat === 'All' || o.category === filterCat) &&
    (filterCard === 'All' || o.cardName === filterCard) &&
    (search === '' || o.merchant?.toLowerCase().includes(search.toLowerCase()) ||
      o.cardName?.toLowerCase().includes(search.toLowerCase()) ||
      o.description?.toLowerCase().includes(search.toLowerCase()))
  ), [allOffers, filterCat, filterCard, search]);

  const usedCategories = ['All', ...new Set(activeOffers.map(o => o.category).filter(Boolean))];
  const usedCards = ['All', ...new Set(activeOffers.map(o => o.cardName).filter(Boolean))];

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="page-title">Offers</div>
          <div className="page-subtitle">{activeOffers.length} active · {expiredOffers.length} expired</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => exportOffersCSV(activeOffers)} title="Export CSV">
            <Download size={15} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className="search-bar mb-3">
        <Search size={15} color="var(--text3)" />
        <input placeholder="Search merchant, card..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <X size={14} color="var(--text3)" onClick={() => setSearch('')} style={{ cursor: 'pointer' }} />}
      </div>

      <div className="chips-scroll mb-2">
        {usedCategories.map(cat => (
          <button key={cat} className={`chip ${filterCat === cat ? 'selected' : ''}`} onClick={() => setFilterCat(cat)}>{cat}</button>
        ))}
      </div>

      <div className="chips-scroll mb-3">
        {usedCards.slice(0, 15).map(name => (
          <button key={name} className={`chip ${filterCard === name ? 'selected' : ''}`} onClick={() => setFilterCard(name)}>
            {name === 'All' ? 'All Cards' : name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <button className={`chip ${!showExpired ? 'selected' : ''}`} onClick={() => setShowExpired(false)}>
          Active ({activeOffers.length})
        </button>
        <button className={`chip ${showExpired ? 'selected' : ''}`} onClick={() => setShowExpired(true)}>
          Expired ({expiredOffers.length})
        </button>
      </div>

      {filtered.map(offer => (
        <OfferCard key={offer.id} offer={offer} onDelete={(id) => { deleteOffer(id); showToast('Offer deleted', 'info'); }} />
      ))}

      {filtered.length === 0 && (
        <div className="empty-state">
          <Tag size={40} className="empty-icon" />
          <div className="empty-title">{showExpired ? 'No expired offers' : 'No active offers'}</div>
          <div className="empty-desc">
            {showExpired ? 'Expired offers will appear here' : 'Sync your email or add offers manually'}
          </div>
        </div>
      )}

      {showAdd && <AddOfferModal cards={cards} onClose={() => setShowAdd(false)} onAdd={(offer) => { addOffer(offer); showToast('Offer added!', 'success'); }} />}
    </div>
  );
}
