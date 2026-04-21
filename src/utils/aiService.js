// AI Model rotation: Gemini Pro → Gemini Flash → GPT-4o-mini → Claude Haiku
// Falls back automatically when quota is exceeded

const MODEL_QUEUE = [
  {
    id: 'gemini-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    endpoint: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`,
    free: false, // paid subscription
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    endpoint: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    free: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    endpoint: () => 'https://api.openai.com/v1/chat/completions',
    free: true,
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    provider: 'anthropic',
    endpoint: () => 'https://api.anthropic.com/v1/messages',
    free: true,
  }
];

async function callGemini(endpoint, prompt, imageBase64 = null) {
  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: 2048 } })
  });
  if (res.status === 429 || res.status === 503) throw new Error('QUOTA_EXCEEDED');
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 2048 })
  });
  if (res.status === 429) throw new Error('QUOTA_EXCEEDED');
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callClaude(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] })
  });
  if (res.status === 429) throw new Error('QUOTA_EXCEEDED');
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

export async function callAI(prompt, apiKeys = {}, imageBase64 = null) {
  const errors = [];

  for (const model of MODEL_QUEUE) {
    const key = apiKeys[model.provider];
    if (!key) continue;

    try {
      if (model.provider === 'google') {
        const endpoint = model.endpoint(key);
        return { text: await callGemini(endpoint, prompt, imageBase64), model: model.name };
      } else if (model.provider === 'openai') {
        return { text: await callOpenAI(key, prompt), model: model.name };
      } else if (model.provider === 'anthropic') {
        return { text: await callClaude(key, prompt), model: model.name };
      }
    } catch (err) {
      errors.push(`${model.name}: ${err.message}`);
      if (err.message !== 'QUOTA_EXCEEDED') {
        // Non-quota errors (wrong key etc) — still try next
      }
      continue;
    }
  }

  throw new Error(`All AI models failed. Errors: ${errors.join('; ')}`);
}

// Specialized prompt for extracting offers from email content
export function buildOfferExtractionPrompt(emailContent, cardNames) {
  return `You are a credit card offer extraction assistant. Analyze this email content and extract credit card offers.

CREDIT CARDS THE USER HAS:
${cardNames.join(', ')}

EMAIL CONTENT:
${emailContent}

Extract ALL offers mentioned. For each offer return a JSON array with objects having these fields:
- cardId: match to the closest card name from the user's list (or "unknown" if not matching)
- cardName: the card name as mentioned in email
- merchant: merchant/brand name
- category: one of [Online Shopping, Fuel, Dining, Grocery, Travel, Movies & Entertainment, OTT Subscriptions, Food Delivery, Utilities, UPI, International, All Spends]
- description: short description of offer
- discount: the discount/cashback/points value (e.g., "10%", "₹500 off", "5X points")
- discountType: one of [cashback, discount, points, voucher, freebie]
- minSpend: minimum spend required (or null)
- maxCashback: maximum cashback cap (or null)
- validFrom: date (YYYY-MM-DD format, or null)
- validUntil: date (YYYY-MM-DD format, or null)
- promoCode: promo code if mentioned (or null)
- terms: key terms and conditions (brief)
- confidence: 0-1 confidence score that this is a real offer

Return ONLY a valid JSON array, no markdown, no explanation. If no offers found return [].`;
}

export function buildBestCardPrompt(category, amount, cardNames) {
  return `You are a credit card rewards expert for India. Given these credit cards: ${cardNames.join(', ')}

For a spend of ₹${amount} on category: "${category}"

Rank the top 5 cards with the best rewards/cashback. Return a JSON array with:
- cardName: exact card name
- estimatedReward: calculated reward in ₹ or points
- rewardType: cashback/points/neucoins etc
- reason: one line explanation
- effectiveRate: percentage effective rate

Return ONLY valid JSON array, no markdown.`;
}
