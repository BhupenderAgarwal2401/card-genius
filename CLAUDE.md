# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CardGenius** is a React PWA for managing credit card offers. It extracts offers from promotional emails using AI (Gemini, OpenAI, Claude), recommends the best card for any purchase, and stores everything locally in the browser. No backend - all data in localStorage.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Build to dist/
npm run preview      # Preview production build
```

## Architecture

### Tech Stack
- React 18 + Vite + React Router v6 (HashRouter for PWA compatibility)
- vite-plugin-pwa + Workbox for offline support
- Direct API calls to Gemini/OpenAI/Anthropic (no SDK)
- localStorage with `cg_` prefix for all data

### File Structure
```
src/
├── App.jsx              # Routes, NavBar, Toast, AppShell
├── hooks/useApp.jsx     # Global state via React Context (cards, offers, apiKeys, settings)
├── data/cards.js        # Pre-loaded card data (36 cards) + CATEGORIES + REWARD_TYPES
├── utils/
│   ├── storage.js       # localStorage wrapper + AES-GCM encryption for API keys
│   ├── aiService.js     # AI model rotation logic + prompt builders
│   └── gmailService.js  # Gmail OAuth 2.0 (browser-only, no backend)
├── pages/               # Route components (Dashboard, MyCards, Offers, EmailSync, BestCard, Settings)
└── styles.css           # Global styles, CSS custom properties for theming
```

### Key Patterns

**AppContext (useApp hook)**: All global state flows through `AppProvider`. Components use `useApp()` to access cards, offers, apiKeys, and CRUD operations.

**AI Model Rotation** (`aiService.js`): Calls cascade through models on quota exhaustion or errors:
1. Gemini 2.5 Pro → 2. Gemini 2.5 Flash → 3. Gemini 2.0 Flash → 4. GPT-4o Mini → 5. Claude Haiku

**Storage Keys** (prefixed with `cg_`):
- `cards` - Array of card objects with benefits
- `offers` - Array of extracted/manual offers
- `api_keys` - Plain API keys (or `api_keys_enc` if PIN-protected)
- `settings` - User preferences (pin, autoPurge, daysBack)
- `gmail_accounts` - OAuth tokens for Gmail sync

**Offer Extraction Flow**:
1. User pastes email text or connects Gmail OAuth
2. `buildOfferExtractionPrompt()` creates structured prompt with user's card names
3. `callAI()` returns JSON array of offers
4. User reviews and accepts offers → saved via `addOffers()`

**Gmail (EmailSync)** (`gmailService.js` + `EmailSync.jsx` + `indianSenderFilter.js` + `parseAiJson.js`):
- Standalone PWA uses OAuth **redirect** (`ux_mode: 'redirect'`) because popups often fail; browser tab uses popup. `consumeGmailOAuthRedirectFromUrl()` runs in `main.jsx` before React so `#access_token=...` does not break `HashRouter`.
- `getGmailRedirectUri()` must be added to Google Cloud OAuth client **Authorized redirect URIs**.
- Flow: set **days back**, **category**, optional **India bank/shopping** filter → **Load inbox** → **Load more** (pagination via `nextPageToken`) → select rows → **Extract**. `gmailScanLog` shows per-message status.
- `fetchEmailSummariesPage` returns `{ summaries, nextPageToken }`; `buildGmailListQuery` supports `broad`, `promotions`, `primary`, `updates`, `social`, `forums`, `all`.
- `parseOfferJsonArrayFromText` tolerates markdown fences and wrapper objects; Gemini uses `responseMimeType: application/json` when supported (fallback on 400).
- **Email sync session** (`emailSyncSession.js`): inbox/Gmail UI state (draft text, extracted queue, Gmail list, filters, scan log) is restored from `sessionStorage` when returning to the Email route so navigation does not wipe in-progress work (cleared when the browser tab/session ends).
- **Offer dedupe** (`offerDedupe.js`): `offerDedupeKey` merges same merchant/card/discount/expiry/code; `addOffers` / `addOffer` skip duplicates vs existing saved offers. Email review uses checkboxes + Save selected / Save all.

### Data Models

**Card**: `{ id, name, bank, network, color, accent, benefits: [{ category, description, rate, type }] }`

**Offer**: `{ id, cardName, merchant, category, description, discount, discountType, validFrom, validUntil, promoCode, terms, confidence, addedAt, source }`

### PWA Configuration
Configured in `vite.config.js` with `vite-plugin-pwa`. Service worker auto-updates. Manifest defines standalone display mode with portrait orientation.
