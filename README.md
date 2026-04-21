# 💳 CardGenius — Smart Credit Card Offer Manager

A Progressive Web App (PWA) to track all your credit cards, extract offers from promotional emails using AI, and always know which card gives maximum rewards for any purchase.

---

## ✨ Features

| Feature | Description |
|---|---|
| 36 Pre-loaded Cards | All your cards with default benefits already configured |
| AI Email Extraction | Paste promo emails → AI extracts & maps offers to your cards |
| Best Card Finder | Find the optimal card for any category + spend amount |
| AI Model Rotation | Gemini Pro → Flash → GPT-4o-mini → Claude Haiku (auto-fallback) |
| Offer Management | Add, filter, search, export offers with expiry tracking |
| Backup & Restore | Export JSON backup, restore on new device |
| PWA | Installable as Android/iOS app from browser |
| 100% Private | All data stays in your browser. No server, no tracking |

---

## 🚀 Deployment to Netlify

### Option A: Manual Deploy (Easiest, 5 minutes)

1. **Build the app** on your computer:
   ```bash
   # Install Node.js from nodejs.org if not installed
   npm install
   npm run build
   # This creates a "dist" folder
   ```

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com) → Sign up free
   - Click **"Add new site"** → **"Deploy manually"**
   - Drag and drop the entire `dist/` folder onto the Netlify page
   - Your app is live in ~30 seconds! 🎉
   - Note your URL: `https://random-name.netlify.app`

3. **Custom domain (optional):**
   - In Netlify → Site settings → Domain management → Add custom domain

### Option B: GitHub + Auto-Deploy (Recommended for updates)

1. Push this folder to a GitHub repository
2. In Netlify → **"Add new site"** → **"Import from Git"**
3. Connect GitHub → Select your repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click Deploy — every git push auto-deploys!

---

## 📱 Install as Android App

1. Open Chrome on your Android phone
2. Navigate to your Netlify URL
3. Tap the **⋮ (three dots)** menu
4. Select **"Add to Home Screen"**
5. Tap "Add" — the app icon appears on your home screen!

It behaves exactly like a native app:
- Works offline (cached)
- Full screen, no browser bar
- Fast launch from home screen

### For iOS (iPhone/iPad):
1. Open Safari (must be Safari, not Chrome)
2. Go to your Netlify URL
3. Tap the **Share button** (box with arrow)
4. Scroll down → **"Add to Home Screen"**
5. Tap Add

---

## 🔑 First-Time Setup in the App

### Step 1: Add AI API Keys (Required for email extraction)

Go to **Settings → AI API Keys** and add at least one key:

#### Google Gemini (Recommended — Best quality, free tier available)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **"Get API Key"** → Create API Key
3. Copy the key (starts with `AIza...`)
4. Paste into CardGenius Settings → Google Gemini API Key

> **Note:** If you have Gemini Pro subscription, the same API key automatically uses Gemini 1.5 Pro (better results). It falls back to Gemini 1.5 Flash (free tier) when Pro quota is hit.

#### OpenAI (Optional fallback)
1. Go to [platform.openai.com](https://platform.openai.com) → API Keys
2. Create new key (starts with `sk-...`)
3. GPT-4o-mini is used (~$0.00015 per email, extremely cheap)

#### Anthropic Claude (Optional fallback)
1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Create new key (starts with `sk-ant-...`)
3. Claude Haiku 3 is used (cheapest Claude model)

### Step 2: Verify your cards
- Go to **My Cards** — all 36 of your cards are pre-loaded
- Tap any card to see its default benefits
- Add custom cards or edit existing ones as needed

### Step 3: Add your first offers
- Go to **Email Sync** → **Paste Email**
- Open a promotional email on your phone/computer
- Select All → Copy → Paste into the text area
- Tap **"Extract Offers with AI"**
- Review the extracted offers → Accept the ones that look correct

---

## 📧 Gmail Auto-Sync Setup (Advanced)

For automatic email syncing without manual copy-paste:

### Step 1: Create Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name it `CardGenius` → Create

### Step 2: Enable Gmail API
1. In your project → **APIs & Services** → **Library**
2. Search for "Gmail API" → Click it → **Enable**

### Step 3: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Application type: **Web application**
4. Name: `CardGenius`
5. Under **Authorized JavaScript origins**, add:
   - `https://your-app.netlify.app` (your actual Netlify URL)
   - `http://localhost:5173` (for local development)
6. Click Create → Copy the **Client ID**

### Step 4: Create API Key
1. Back at Credentials → **"+ Create Credentials"** → **"API key"**
2. Click **"Restrict key"**
3. Under API restrictions → select **Gmail API**
4. Copy the API key

### Step 5: Configure in CardGenius
1. Open Settings → Gmail OAuth Setup
2. Paste your Client ID and API Key
3. Tap Save
4. Go to Email Sync → Gmail OAuth tab → Connect Gmail

> **Security note:** Gmail access is read-only. The app only reads your Promotions tab. Tokens are stored in your browser only and never sent to any server.

---

## 🔄 AI Model Rotation Logic

The app automatically rotates through AI models to maximize free usage:

```
1. Gemini 1.5 Pro     (if Google key set + Pro subscription)
   ↓ quota exceeded or not available
2. Gemini 1.5 Flash   (free tier, same Google key)
   ↓ quota exceeded
3. GPT-4o Mini        (if OpenAI key set)
   ↓ quota exceeded
4. Claude Haiku       (if Anthropic key set)
   ↓ all failed
5. Error shown to user
```

**Cost estimate per email extraction:**
- Gemini Flash: **Free** (within daily limits)
- GPT-4o-mini: **~₹0.01** per email
- Claude Haiku: **~₹0.02** per email

---

## 📦 Backup & Restore

### Taking a Backup
1. Go to **Settings → Backup & Restore**
2. Tap **"Export Backup (.json)"**
3. File downloads as `cardgenius_backup_YYYY-MM-DD.json`
4. Store in Google Drive / local storage

### Restoring on New Device
1. Open CardGenius on your new device
2. Go to **Settings → Backup & Restore**
3. Tap **"Import Backup (.json)"**
4. Select your backup file
5. App refreshes with all your data restored

> **Note:** API keys are NOT included in backups for security. You'll need to re-enter them after restore.

---

## 📊 Best Card Finder

### AI Mode
- Requires at least one API key
- Analyzes your card benefits + active offers together
- Returns top 5 cards with estimated rewards and reasons

### Quick Match Mode (No AI needed)
- Works offline
- Matches your stored card benefits and active offers
- Instant results based on category patterns

---

## 🛠️ Local Development

```bash
# Clone/download the project
cd card-genius

# Install dependencies
npm install

# Start dev server
npm run dev
# Opens at http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | Custom CSS (no UI library — fast & lightweight) |
| PWA | vite-plugin-pwa + Workbox |
| AI Integration | Direct API calls (Gemini, OpenAI, Anthropic) |
| Storage | Browser localStorage (encrypted for keys) |
| Deployment | Netlify |
| Fonts | Syne + Space Mono (Google Fonts) |

---

## 📋 CSV Export Format

Offers can be exported to CSV via the Offers page (download icon). Columns:
`Card, Category, Merchant, Offer, Discount, Valid Until, Min Spend, Source`

---

## 🔒 Privacy & Security

- **Zero backend** — no server, no database, no analytics
- **All data local** — stored in your browser's localStorage
- **API keys** — sent only directly to respective AI providers
- **Gmail** — read-only access, tokens in browser only
- **Backup files** — exclude API keys intentionally
- **HTTPS** — Netlify provides free SSL

---

## 🆘 Troubleshooting

| Issue | Solution |
|---|---|
| "All AI models failed" | Check API keys in Settings. Gemini key is most important. |
| Offers not matching cards | Make sure card names in extracted offer match your card list |
| Gmail OAuth not working | Ensure your Netlify URL is added as authorized origin in Google Console |
| App not installing on Android | Must use Chrome browser. Clear cache and try again. |
| Lost data | Restore from backup. Going forward, backup regularly! |
| Blank page after deploy | Check Netlify build logs. Ensure build command is `npm run build` and publish dir is `dist` |

---

## 📈 Roadmap (Future Versions)

- [ ] Zoho Mail IMAP integration
- [ ] PIN-lock screen for app security
- [ ] Notification reminders for expiring offers
- [ ] Offer categories auto-tagging improvements
- [ ] Multiple Gmail account cycling
- [ ] Share an offer with family member
- [ ] Spend tracker to see which card you used for what

---

*Built with ❤️ as a personal finance tool. All data stays on your device.*
