import { useState, useMemo } from 'react';
import { useApp } from '../hooks/useApp';
import { REWARD_TYPES, CATEGORIES } from '../data/cards';
import { Plus, Search, Trash2, X, Tag, Download } from 'lucide-react';
import { exportOffersCSV } from '../utils/storage';

function OfferDetailSheet({ offer, onClose }) {
  if (!offer) return null;
  const typeInfo = REWARD_TYPES[offer.discountType] || REWARD_TYPES.cashback;
  const row = (label, value) =>
    value != null && String(value).trim() !== '' ? (
      <div className="offer-detail-row">
        <div className="offer-detail-label">{label}</div>
        <div className="offer-detail-value">{String(value)}</div>
      </div>
    ) : null;

  return (
    <div
      className="modal-overlay offer-detail-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal offer-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="offer-detail-title">
        <div className="modal-handle" />
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div id="offer-detail-title" className="offer-detail-sheet-title">
              {offer.merchant || 'Offer'}
            </div>
            <div className="offer-detail-sheet-sub mt-1">
              <span className="badge" style={{ background: typeInfo.color + '22', color: typeInfo.color }}>
                {typeInfo.label}
              </span>
              {offer.category && (
                <span className="badge badge-gray" style={{ marginLeft: 6 }}>
                  {offer.category}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon offer-detail-close" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        <div className="offer-detail-discount-big">{offer.discount}</div>
        <p className="offer-detail-cardline">{offer.cardName}</p>

        <div className="offer-detail-body">
          {row('Description', offer.description)}
          {row('Promo code', offer.promoCode)}
          {row('Valid from', offer.validFrom)}
          {row('Valid until', offer.validUntil)}
          {offer.minSpend != null && row('Min spend', `₹${offer.minSpend}`)}
          {offer.maxCashback != null && row('Max cashback / cap', `₹${offer.maxCashback}`)}
          {offer.confidence != null && row('AI confidence', `${Math.round(Number(offer.confidence) * 100)}%`)}
          {row('Source', offer.source)}
          {row('Added', offer.addedAt?.slice(0, 10))}
          {offer.terms ? (
            <div className="offer-detail-terms-block">
              <div className="offer-detail-label">Terms &amp; conditions</div>
              <div className="offer-detail-terms-scroll">{offer.terms}</div>
            </div>
          ) : null}
        </div>

        <button type="button" className="btn btn-primary btn-full mt-3" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function OfferCard({ offer, onDelete }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const typeInfo = REWARD_TYPES[offer.discountType] || REWARD_TYPES.cashback;
  const isExpiring = offer.validUntil && (new Date(offer.validUntil) - new Date()) / (1000 * 60 * 60 * 24) <= 3;

  return (
    <div className="offer-card mb-2" style={{ borderColor: isExpiring ? 'var(--red)33' : undefined }}>
      <div className="offer-card-accent" style={{ background: isExpiring ? 'var(--red)' : typeInfo.color }} />
      <div className="offer-card-inner">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="offer-merchant">{offer.merchant || 'General Offer'}</span>
              <span className="badge" style={{ background: typeInfo.color + '22', color: typeInfo.color }}>
                {typeInfo.label}
              </span>
              {isExpiring && <span className="badge badge-red">Expiring!</span>}
            </div>
            <div className="offer-card-name mt-1">{offer.cardName}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="offer-discount">{offer.discount}</div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 mt-2">
          {offer.category && <span className="badge badge-gray">{offer.category}</span>}
          {offer.promoCode && <span className="badge badge-blue text-mono">{offer.promoCode}</span>}
          {offer.validUntil && <span className="offer-expiry">Till {offer.validUntil}</span>}
        </div>

        {offer.description && (
          <p className="offer-card-preview">{offer.description}</p>
        )}

        <div className="offer-card-actions">
          <button
            type="button"
            className="btn btn-secondary offer-card-details-btn"
            onClick={() => setSheetOpen(true)}
          >
            View full offer
          </button>
          <button
            type="button"
            className="btn btn-ghost offer-card-delete-btn"
            onClick={() => onDelete(offer.id)}
            aria-label="Delete offer"
          >
            <Trash2 size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {sheetOpen && <OfferDetailSheet offer={offer} onClose={() => setSheetOpen(false)} />}
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

      {showAdd && (
        <AddOfferModal
          cards={cards}
          onClose={() => setShowAdd(false)}
          onAdd={(offer) => {
            const created = addOffer(offer);
            if (created) showToast('Offer added!', 'success');
            else showToast('This offer already exists in your list', 'info');
          }}
        />
      )}
    </div>
  );
}
