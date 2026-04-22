// Heuristic: likely Indian bank / card / UPI / e-commerce promotional senders (reduces newsletter noise).

const BANK_AND_FINTECH = [
  'hdfc', 'icici', 'sbi', 'axis bank', 'axisbank', 'kotak', 'indusind', 'yes bank', 'yesbank',
  'idfc', 'idfcfirst', 'federal bank', 'federalbank', 'rblbank', 'rbl bank', 'bob ', 'bank of baroda',
  'pnb', 'punjab national', 'union bank', 'canara', 'indian bank', 'indianbank', 'bankofindia',
  'central bank', 'uco bank', 'au small', 'aubank', 'slice', 'onecard', 'cred.club', 'cred ',
  'paytm', 'phonepe', 'google pay', 'gpay', 'amazon pay', 'mobikwik', 'freecharge', 'navi',
  'bajaj finserv', 'bajajfinserv', 'tata capital', 'hsbc', 'citi', 'citibank', 'sc.com', 'standardchartered',
  'dbs', 'dbs.com', 'amex', 'american express', 'mastercard', 'visa', 'rupay', 'npci', 'upi',
  'sbicard', 'hdfcbank', 'icicibank', 'axisbank', 'kotak', 'indusind.com', 'yesbank.in',
];

const ECOMMERCE_AND_RETAIL = [
  'flipkart', 'amazon.in', 'amazon.', 'myntra', 'nykaa', 'bigbasket', 'grofers', 'blinkit',
  'swiggy', 'zomato', 'eazydiner', 'bookmyshow', 'makemytrip', 'goibibo', 'cleartrip', 'irctc',
  'reliance', 'jiomart', 'tatacliq', 'croma', 'vijaysales', 'poorvika', 'firstcry', 'meesho',
  'snapdeal', 'paytm mall', 'starbucks', 'dominos', 'pizzahut', 'uber ', 'ola ', 'rapido',
];

const CURRENCY_HINTS = ['₹', 'rs.', 'rs ', 'inr', 'rupee'];

function haystack(row) {
  const f = (row.from || '').toLowerCase();
  const s = (row.subject || '').toLowerCase();
  const n = (row.snippet || '').toLowerCase();
  return `${f} ${s} ${n}`;
}

export function matchesIndianOffersHeuristic(row) {
  const h = haystack(row);
  const lists = [...BANK_AND_FINTECH, ...ECOMMERCE_AND_RETAIL];
  if (lists.some((k) => h.includes(k))) return true;
  if (CURRENCY_HINTS.some((k) => h.includes(k)) && /bank|card|cashback|reward|upi|emi|offer/i.test(h)) {
    return true;
  }
  return false;
}

export function filterSummariesIndianFocus(rows) {
  return rows.filter(matchesIndianOffersHeuristic);
}
