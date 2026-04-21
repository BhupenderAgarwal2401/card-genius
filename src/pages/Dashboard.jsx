import { useApp } from '../hooks/useApp';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Tag, TrendingUp, Clock, Zap, ChevronRight, AlertCircle } from 'lucide-react';
import { REWARD_TYPES } from '../data/cards';

function expiringIn(offer, days) {
  if (!offer.validUntil) return false;
  const diff = (new Date(offer.validUntil) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

export default function Dashboard() {
  const { cards, activeOffers, hasKeys } = useApp();
  const navigate = useNavigate();

  const expiringSoon = activeOffers.filter(o => expiringIn(o, 3));
  const recentOffers = [...activeOffers]
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 5);

  const byCategory = {};
  activeOffers.forEach(o => {
    const cat = o.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="page-title">CardGenius</div>
          <div className="page-subtitle">Your smart credit card companion</div>
        </div>
        <div className="icon-circle icon-circle-accent">
          <CreditCard size={20} color="var(--accent)" />
        </div>
      </div>

      {!hasKeys && (
        <div
          className="warning-box flex items-center gap-3 mb-4"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/settings')}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div className="flex-1">
            <div className="font-bold" style={{ fontSize: 13 }}>Setup Required</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              Add AI API keys in Settings to enable email extraction
            </div>
          </div>
          <ChevronRight size={14} style={{ flexShrink: 0 }} />
        </div>
      )}

      <div className="grid-3 mb-4">
        <div className="stat-card" onClick={() => navigate('/cards')} style={{ cursor: 'pointer' }}>
          <div className="stat-value text-accent">{cards.length}</div>
          <div className="stat-label">Cards</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/offers')} style={{ cursor: 'pointer' }}>
          <div className="stat-value text-green">{activeOffers.length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/offers')} style={{ cursor: 'pointer' }}>
          <div className="stat-value text-orange">{expiringSoon.length}</div>
          <div className="stat-label">Expiring</div>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="section">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} color="var(--red)" />
            <div className="section-title" style={{ margin: 0, color: 'var(--red)' }}>
              Expiring within 3 days
            </div>
          </div>
          <div className="flex-col gap-2">
            {expiringSoon.slice(0, 3).map(offer => (
              <OfferRow key={offer.id} offer={offer} urgent />
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">Quick Actions</div>
        <div className="grid-2 gap-2">
          <button
            className="card"
            style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border2)' }}
            onClick={() => navigate('/bestcard')}
          >
            <Zap size={18} color="var(--yellow)" />
            <div className="font-bold mt-2" style={{ fontSize: 14 }}>Best Card</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Find optimal card</div>
          </button>
          <button
            className="card"
            style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border2)' }}
            onClick={() => navigate('/email')}
          >
            <TrendingUp size={18} color="var(--green)" />
            <div className="font-bold mt-2" style={{ fontSize: 14 }}>Sync Email</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Extract new offers</div>
          </button>
        </div>
      </div>

      {topCategories.length > 0 && (
        <div className="section">
          <div className="section-title">Offers by Category</div>
          <div className="card">
            {topCategories.map(([cat, count], i) => (
              <div
                key={cat}
                className="flex items-center justify-between"
                style={{ marginBottom: i < topCategories.length - 1 ? 10 : 0 }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cat}</div>
                <div className="flex items-center gap-2">
                  <div className="progress" style={{ width: 80 }}>
                    <div
                      className="progress-bar"
                      style={{ width: `${Math.min(100, (count / activeOffers.length) * 300)}%` }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text2)', minWidth: 20 }}>
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentOffers.length > 0 && (
        <div className="section">
          <div className="flex items-center justify-between mb-2">
            <div className="section-title" style={{ margin: 0 }}>Recent Offers</div>
            <button className="btn btn-ghost text-sm" onClick={() => navigate('/offers')}>View all</button>
          </div>
          <div className="flex-col gap-2">
            {recentOffers.map(offer => <OfferRow key={offer.id} offer={offer} />)}
          </div>
        </div>
      )}

      {activeOffers.length === 0 && (
        <div className="empty-state">
          <Tag size={40} className="empty-icon" />
          <div className="empty-title">No active offers yet</div>
          <div className="empty-desc">Sync your email or add offers manually to get started</div>
          <button className="btn btn-primary mt-2" onClick={() => navigate('/email')}>
            Sync Email
          </button>
        </div>
      )}
    </div>
  );
}

function OfferRow({ offer, urgent }) {
  const navigate = useNavigate();
  const typeInfo = REWARD_TYPES[offer.discountType] || REWARD_TYPES.cashback;

  return (
    <div
      className="offer-card"
      onClick={() => navigate('/offers')}
      style={{ cursor: 'pointer' }}
    >
      <div
        className="offer-card-accent"
        style={{ background: urgent ? 'var(--red)' : typeInfo.color }}
      />
      <div className="flex items-center justify-between" style={{ paddingLeft: 10 }}>
        <div className="flex-1 truncate">
          <span className="offer-merchant truncate">
            {offer.merchant || offer.description?.slice(0, 30) || 'General Offer'}
          </span>
          <div className="offer-card-name mt-1 truncate">{offer.cardName}</div>
        </div>
        <div className="text-right" style={{ flexShrink: 0, marginLeft: 10 }}>
          <div
            className="offer-discount"
            style={{ fontSize: 16, color: urgent ? 'var(--red)' : 'var(--green)' }}
          >
            {offer.discount}
          </div>
          {offer.validUntil && (
            <div className="offer-expiry">{offer.validUntil}</div>
          )}
        </div>
      </div>
    </div>
  );
}
