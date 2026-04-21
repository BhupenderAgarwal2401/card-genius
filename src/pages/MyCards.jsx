import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { CARDS_DATA, REWARD_TYPES } from '../data/cards';
import { Plus, Search, Trash2, Edit2, X, Tag, CreditCard } from 'lucide-react';

const NETWORKS = ['Visa', 'Mastercard', 'Rupay', 'Amex'];

function CardVisual({ card, offerCount, onClick }) {
  return (
    <div
      className="cc-card"
      style={{
        background: `linear-gradient(135deg, ${card.color} 0%, ${card.accent}55 100%)`,
        border: `1px solid ${card.accent}33`,
      }}
      onClick={onClick}
    >
      <div style={{ zIndex: 1 }}>
        <div className="cc-card-name">{card.name}</div>
        <div className="cc-card-bank">{card.bank}</div>
      </div>
      <div className="flex items-center justify-between" style={{ zIndex: 1 }}>
        <div className="cc-card-network">{card.network}</div>
        {offerCount > 0 && (
          <div className="cc-card-offers">
            <Tag size={10} />
            {offerCount} offer{offerCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function BenefitRow({ benefit }) {
  const typeInfo = REWARD_TYPES[benefit.type] || REWARD_TYPES.cashback;
  return (
    <div className="card-sm mb-2">
      <div className="flex items-center justify-between">
        <div style={{ flex: 1 }}>
          <div className="font-bold" style={{ fontSize: 13 }}>{benefit.category}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{benefit.description}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div className="font-bold text-mono" style={{ fontSize: 14, color: typeInfo.color }}>
            {benefit.rate}
          </div>
          <div
            className="badge"
            style={{ background: typeInfo.color + '22', color: typeInfo.color, marginTop: 3 }}
          >
            {typeInfo.label}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardModal({ card, onClose, onSave, onDelete, offerCount }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...card });

  function handleSave() {
    onSave(form);
    setEditing(false);
    // Update local form to reflect saved state
    setForm({ ...form });
  }

  // Use `card` prop for display (updated by parent), `form` only when editing
  const display = editing ? form : card;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />

        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{card.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{card.bank} · {card.network}</div>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn btn-ghost btn-icon ${editing ? 'text-accent' : ''}`}
              onClick={() => { setEditing(!editing); setForm({ ...card }); }}
              title={editing ? 'Cancel edit' : 'Edit card'}
            >
              <Edit2 size={16} color={editing ? 'var(--accent)' : undefined} />
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {!editing ? (
          <>
            <CardVisual card={card} offerCount={offerCount} />

            {card.benefits && card.benefits.length > 0 && (
              <div className="mt-3">
                <div className="section-title">Default Benefits</div>
                {card.benefits.map((b, i) => <BenefitRow key={i} benefit={b} />)}
              </div>
            )}

            {card.benefits && card.benefits.length === 0 && (
              <div className="info-box mt-3">
                No default benefits configured. Tap Edit to add them.
              </div>
            )}

            {offerCount > 0 && (
              <div className="info-box mt-3">
                <strong>{offerCount} active promotional offer{offerCount > 1 ? 's' : ''}</strong> linked to this card — check the Offers tab.
              </div>
            )}

            <button
              className="btn btn-danger btn-full mt-4"
              onClick={() => { onDelete(card.id); onClose(); }}
            >
              <Trash2 size={14} /> Remove Card
            </button>
          </>
        ) : (
          <div>
            <div className="form-group">
              <label className="label">Card Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Card name"
              />
            </div>
            <div className="form-group">
              <label className="label">Bank *</label>
              <input
                className="input"
                value={form.bank}
                onChange={e => setForm({ ...form, bank: e.target.value })}
                placeholder="Bank name"
              />
            </div>
            <div className="form-group">
              <label className="label">Network</label>
              <select
                className="select"
                value={form.network}
                onChange={e => setForm({ ...form, network: e.target.value })}
              >
                {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => { setEditing(false); setForm({ ...card }); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleSave}
                disabled={!form.name.trim() || !form.bank.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCardModal({ onClose, onAdd, existingIds }) {
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState({ name: '', bank: '', network: 'Visa' });

  const available = CARDS_DATA.filter(c =>
    !existingIds.includes(c.id) &&
    (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.bank.toLowerCase().includes(search.toLowerCase())
    )
  );

  function handleAddCustom() {
    if (!form.name.trim() || !form.bank.trim()) return;
    onAdd({
      ...form,
      id: `custom_${Date.now()}`,
      color: '#1c2638',
      accent: '#00d4ff',
      benefits: [],
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontWeight: 800, fontSize: 17 }}>Add Card</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-3">
          <button className={`chip ${!custom ? 'selected' : ''}`} onClick={() => setCustom(false)}>
            From Library
          </button>
          <button className={`chip ${custom ? 'selected' : ''}`} onClick={() => setCustom(true)}>
            Custom Card
          </button>
        </div>

        {!custom ? (
          <>
            <div className="search-bar mb-3">
              <Search size={15} color="var(--text3)" />
              <input
                placeholder="Search cards..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <X size={14} color="var(--text3)" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />
              )}
            </div>
            <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {available.length === 0 && (
                <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 24 }}>
                  {search ? 'No cards match your search' : 'All library cards are already added'}
                </div>
              )}
              {available.map(card => (
                <div
                  key={card.id}
                  className="card-sm"
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => { onAdd(card); onClose(); }}
                >
                  <div>
                    <div className="font-bold" style={{ fontSize: 13 }}>{card.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{card.bank} · {card.network}</div>
                  </div>
                  <Plus size={16} color="var(--accent)" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div>
            <div className="form-group">
              <label className="label">Card Name *</label>
              <input
                className="input"
                placeholder="e.g. HDFC Regalia"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="label">Bank *</label>
              <input
                className="input"
                placeholder="e.g. HDFC Bank"
                value={form.bank}
                onChange={e => setForm({ ...form, bank: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="label">Network</label>
              <select
                className="select"
                value={form.network}
                onChange={e => setForm({ ...form, network: e.target.value })}
              >
                {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={handleAddCustom}
              disabled={!form.name.trim() || !form.bank.trim()}
            >
              Add Custom Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyCards() {
  const { cards, saveCards, activeOffers, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterBank, setFilterBank] = useState('All');

  const offersByCard = {};
  activeOffers.forEach(o => {
    if (o.cardId) offersByCard[o.cardId] = (offersByCard[o.cardId] || 0) + 1;
  });

  const banks = ['All', ...new Set(cards.map(c => c.bank))].sort();

  const filtered = cards.filter(c =>
    (filterBank === 'All' || c.bank === filterBank) &&
    (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.bank.toLowerCase().includes(search.toLowerCase())
    )
  );

  function handleDelete(id) {
    saveCards(cards.filter(c => c.id !== id));
    showToast('Card removed', 'info');
  }

  function handleSave(updated) {
    const newCards = cards.map(c => c.id === updated.id ? updated : c);
    saveCards(newCards);
    // Keep modal open with updated card data
    setSelectedCard(updated);
    showToast('Card updated!', 'success');
  }

  function handleAdd(card) {
    if (cards.find(c => c.id === card.id)) {
      showToast('Card already in your list', 'info');
      return;
    }
    saveCards([...cards, card]);
    showToast(`${card.name} added!`, 'success');
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="page-title">My Cards</div>
          <div className="page-subtitle">{cards.length} credit card{cards.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Card
        </button>
      </div>

      <div className="search-bar mb-3">
        <Search size={15} color="var(--text3)" />
        <input
          placeholder="Search cards or banks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <X size={14} color="var(--text3)" onClick={() => setSearch('')} style={{ cursor: 'pointer' }} />
        )}
      </div>

      <div className="chips-scroll mb-3">
        {banks.map(bank => (
          <button
            key={bank}
            className={`chip ${filterBank === bank ? 'selected' : ''}`}
            onClick={() => setFilterBank(bank)}
          >
            {bank}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={40} className="empty-icon" />
          <div className="empty-title">No cards found</div>
          <div className="empty-desc">Try a different search or bank filter</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {filtered.map(card => (
            <CardVisual
              key={card.id}
              card={card}
              offerCount={offersByCard[card.id] || 0}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          offerCount={offersByCard[selectedCard.id] || 0}
          onClose={() => setSelectedCard(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {showAdd && (
        <AddCardModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          existingIds={cards.map(c => c.id)}
        />
      )}
    </div>
  );
}
