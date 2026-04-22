// AI Model rotation: Gemini 2.5 Pro → 2.5 Flash → 2.0 Flash → GPT-4o-mini → Claude Haiku
// Falls back automatically when quota is exceeded or a model is unavailable

const MODEL_QUEUE = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    endpoint: (key) =>
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
    free: false,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    endpoint: (key) =>
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    free: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    endpoint: (key) =>
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
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

async function callGemini(endpoint, prompt, imageBase64 = null, preferJsonMime = true) {
  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
  }
  const baseGen = { maxOutputTokens: 4096, temperature: 0.15 };
  const bodyWithJson = {
    contents: [{ parts }],
    generationConfig: { ...baseGen, responseMimeType: 'application/json' },
  };
  const bodyPlain = {
    contents: [{ parts }],
    generationConfig: baseGen,
  };

  let res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferJsonMime ? bodyWithJson : bodyPlain),
  });
  if (preferJsonMime && res.status === 400) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPlain),
    });
  }

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {};
  }

  const errMsg = (data?.error?.message || data?.error?.status || rawText || '').toString().toLowerCase();
  const errCode = data?.error?.code;
  const errStatus = (data?.error?.status || '').toString().toUpperCase();

  if (data?.error) {
    if (
      errCode === 429 ||
      errStatus === 'RESOURCE_EXHAUSTED' ||
      /quota|rate limit|resource_exhausted|too many requests|exhausted\b/.test(errMsg)
    ) {
      throw new Error('QUOTA_EXCEEDED');
    }
  }

  if (!res.ok) {
    if (res.status === 429 || res.status === 503 || res.status === 408) throw new Error('QUOTA_EXCEEDED');
    if (res.status === 403 && /quota|billing|limit|exhausted/.test(errMsg)) throw new Error('QUOTA_EXCEEDED');
    if (/resource_exhausted|quota exceeded|rate limit|too many requests/.test(errMsg)) {
      throw new Error('QUOTA_EXCEEDED');
    }
    throw new Error(`Gemini error: ${res.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 2048 })
  });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const em = (data?.error?.message || raw || '').toString().toLowerCase();
  if (res.status === 429 || res.status === 503 || /rate limit|quota/.test(em)) throw new Error('QUOTA_EXCEEDED');
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
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
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const em = (data?.error?.message || raw || '').toString().toLowerCase();
  if (res.status === 429 || res.status === 503 || /rate limit|overloaded|quota/.test(em)) {
    throw new Error('QUOTA_EXCEEDED');
  }
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  return data.content?.[0]?.text || '';
}

export async function callAI(prompt, apiKeys = {}, imageBase64 = null, options = {}) {
  const errors = [];
  const preferJsonMime = options.preferJsonMime !== false;

  for (const model of MODEL_QUEUE) {
    const key = apiKeys[model.provider];
    if (!key) continue;

    try {
      if (model.provider === 'google') {
        const endpoint = model.endpoint(key);
        return {
          text: await callGemini(endpoint, prompt, imageBase64, preferJsonMime),
          model: model.name,
        };
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

CREDIT CARDS THE USER HAS (match offers to these when the email names a bank or card product; also extract bank-issued card offers even if the card name is abbreviated):
${cardNames.join(', ')}

EMAIL CONTENT:
${emailContent}

Extract ALL offers that relate to credit/debit cards, bank cashback, reward points, EMI deals from issuers, or spending milestones on payment cards. Include retail co-branded card deals if they clearly name a bank or one of the user's cards. For each offer return a JSON array with objects having these fields:
- cardId: match to the closest card name from the user's list (or "unknown" if not matching)
- cardName: the card name as mentioned in email
- merchant: merchant/brand name
- category: one of [Online Shopping, Fuel, Dining, Grocery, Travel, Movies & Entertainment, OTT Subscriptions, Food Delivery, Utilities, UPI, International, All Spends]
- description: short description of offer
- discount: the discount/cashback/points value (required string, e.g., "10%", "₹500 off", "5X points", "Flat ₹250 cashback") — use a short label even if details are in description
- discountType: one of [cashback, discount, points, voucher, freebie]
- minSpend: minimum spend required (or null)
- maxCashback: maximum cashback cap (or null)
- validFrom: date (YYYY-MM-DD format, or null)
- validUntil: date (YYYY-MM-DD format, or null)
- promoCode: promo code if mentioned (or null)
- terms: key terms and conditions (brief)
- confidence: 0-1 confidence score that this is a real offer

Return ONLY a valid JSON array (not wrapped in an object, no markdown code fences, no commentary before or after). If no offers found return [].`;
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
