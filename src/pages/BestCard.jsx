import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { callAI, buildBestCardPrompt } from '../utils/aiService';
import { CATEGORIES } from '../data/cards';
import { Zap, Trophy } from 'lucide-react';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

function ResultCard({ result, rank }) {
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const colors = ['var(--yellow)', 'var(--text2)', '#cd7f32', 'var(--text3)', 'var(--text3)'];

  return (
    <div className="card mb-2" style={{ borderLeft: `3px solid ${colors[rank]}`, paddingLeft: 14 }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>{medals[rank]}</span>
            <div>
              <div className="font-bold" style={{ fontSize: 14 }}>{result.cardName}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{result.reason}</div>
            </div>
          </div>
        </div>
        <div className="text-right ml-2" style={{ flexShrink: 0 }}>
          <div className="font-bold text-mono" style={{ fontSize: 18, color: 'var(--green)' }}>
            {result.estimatedReward}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
            {result.effectiveRate}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BestCard() {
  const { cards, activeOffers, apiKeys, hasKeys, showToast, setActiveModel } = useApp();
  const [category, setCategory] = useState('Online Shopping');
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [usedModel, setUsedModel] = useState('');

  const cardNames = cards.map(c => c.name);

  function quickMatch() {
    const cat = category.toLowerCase();
    const amt = parseFloat(amount) || 1000;

    const scored = cards.map(card => {
      const relevantOffers = activeOffers.filter(o =>
        o.cardId === card.id && (
          (o.category || '').toLowerCase().includes(cat) ||
          cat.includes((o.category || '').toLowerCase()) ||
          o.category === 'All Spends'
        )
      );

      const relevantBenefits = (card.benefits || []).filter(b =>
        b.category.toLowerCase().includes(cat) ||
        cat.includes(b.category.toLowerCase()) ||
        b.category === 'All Spends' ||
        b.category === 'Others'
      );

      let bestRate = 0;
      let bestDesc = '';
      let rewardType = 'cashback';

      relevantOffers.forEach(o => {
        const pct = parseFloat(o.discount) || 0;
        if (pct > bestRate) {
          bestRate = pct;
          bestDesc = `${o.discount} on ${o.merchant || o.category} (active offer)`;
          rewardType = o.discountType || 'cashback';
        }
      });

      relevantBenefits.forEach(b => {
        const pct = parseFloat(b.rate) || 0;
        if (pct > bestRate) {
          bestRate = pct;
          bestDesc = `${b.rate} — ${b.description}`;
          rewardType = b.type;
        }
      });

      const isPoints = rewardType === 'points' || rewardType === 'neucoins';
      const reward = isPoints
        ? `${bestRate}X pts`
        : `₹${((bestRate / 100) * amt).toFixed(0)} back`;

      return {
        cardName: card.name,
        estimatedReward: reward,
        effectiveRate: `${bestRate}%`,
        reason: bestDesc || 'Standard rewards',
        rewardType,
        score: bestRate
      };
    });

    return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  async function findBestAI() {
    if (!hasKeys) { showToast('Add AI API keys in Settings first', 'error'); return; }
    setLoading(true);
    setResults([]);
    try {
      const prompt = buildBestCardPrompt(category, amount, cardNames);
      const result = await callAI(prompt, apiKeys);
      setUsedModel(result.model);
      setActiveModel(result.model);
      const clean = result.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setResults(parsed.slice(0, 5));
    } catch (err) {
      showToast(`AI failed — using local matching instead`, 'info');
      const local = quickMatch();
      setResults(local);
      setUsedModel('Local match');
    }
    setLoading(false);
  }

  function findBestLocal() {
    const r = quickMatch();
    setResults(r);
    setUsedModel('Local (no AI)');
    if (r.length === 0) {
      showToast('No specific benefits found for this category. Try "All Spends".', 'info');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Best Card Finder</div>
        <div className="page-subtitle">Find the optimal card for any spend category</div>
      </div>

      <div className="section">
        <div className="section-title">Spend Category</div>
        <div className="chips-scroll mb-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`chip ${category === cat ? 'selected' : ''}`}
              onClick={() => { setCategory(cat); setResults([]); }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="section-title">Spend Amount (₹)</div>
        <input
          className="input mb-2"
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Enter amount..."
          min="1"
        />
        <div className="chips-scroll mb-4">
          {QUICK_AMOUNTS.map(a => (
            <button
              key={a}
              className={`chip ${Number(amount) === a ? 'selected' : ''}`}
              onClick={() => setAmount(String(a))}
            >
              ₹{a >= 1000 ? `${a / 1000}k` : a}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <button className="btn btn-primary" onClick={findBestAI} disabled={loading || !hasKeys}>
            {loading
              ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              : <Zap size={16} />}
            AI Suggest
          </button>
          <button className="btn btn-secondary" onClick={findBestLocal} disabled={loading}>
            <Trophy size={16} /> Quick Match
          </button>
        </div>

        {!hasKeys && (
          <div className="info-box mt-2">
            <strong>Quick Match</strong> works without AI using your saved benefits &amp; offers.
            <strong> AI Suggest</strong> needs an API key from Settings for smarter recommendations.
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="section">
          <div className="flex items-center justify-between mb-3">
            <div className="section-title" style={{ margin: 0 }}>
              Best for "{category}"
            </div>
            {usedModel && <div className="badge badge-gray">{usedModel}</div>}
          </div>
          {results.map((result, i) => <ResultCard key={i} result={result} rank={i} />)}
          <div className="info-box mt-3">
            💡 Always verify offers are still active before spending. Active promotional offers are factored in above standard benefits.
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <Trophy size={36} className="empty-icon" />
          <div className="empty-title">Pick a category &amp; amount</div>
          <div className="empty-desc">Then tap AI Suggest or Quick Match</div>
        </div>
      )}

      <div className="section">
        <div className="section-title">Reward Redemption Guide</div>
        <div className="card">
          {[
            { card: 'Amazon ICICI', tip: 'Redeem Amazon Pay balance directly — ₹1 = ₹1 (best value)' },
            { card: 'HDFC Millenia', tip: 'CashPoints: redeem via SmartBuy — expire in 2 years' },
            { card: 'ICICI Sapphiro', tip: 'PAYBACK pts: best on Flipkart (~₹0.25–0.50/pt)' },
            { card: 'Tata Neu Infinity', tip: 'NeuCoins = ₹1 on any Tata app (BigBasket, Air India, Croma)' },
            { card: 'IDFC First Wealth', tip: 'Points never expire — worth ₹0.25 on IDFC SmartBuy' },
            { card: 'BoB Eterna', tip: 'Best value on BoB World portal for travel bookings' },
            { card: 'SBI Cashback', tip: 'Direct statement credit — no redemption needed' },
          ].map((item, i, arr) => (
            <div
              key={i}
              style={{
                padding: '9px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none'
              }}
            >
              <div className="font-bold" style={{ fontSize: 12, color: 'var(--accent)' }}>{item.card}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{item.tip}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
