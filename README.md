# ⚡ KaziLink Mtaani — Complete Deployment Guide

## Project Structure

```
kazilink/
├── public/
│   ├── index.html       ← User app: buy coins + subscriptions (STK Push)
│   ├── admin.html       ← Admin dashboard: users, revenue, withdrawals, fraud
│   ├── script.js        ← Shared utilities (phone formatter, plan info, etc.)
│   ├── style.css        ← Global CSS variables and base styles
│   ├── manifest.json    ← PWA manifest
│   └── sw.js            ← Service Worker (offline + push notifications)
├── functions/
│   └── index.js         ← Cloud Functions: STK Push, M-Pesa callback, payouts
│   └── package.json     ← Node 18 dependencies (axios, express, cors, firebase)
├── firestore.rules      ← Database security rules
└── README.md            ← This file
```

---

## Payment Details

| | |
|---|---|
| **Till Number** | `5725479` |
| **Business Name** | KAZILINK MTAANI |
| **Transaction Type** | CustomerBuyGoodsOnline (Buy Goods) |
| **Environment** | 🟢 Production (api.safaricom.co.ke) |

### Pricing

**Coins**
| Package | Price |
|---------|-------|
| 50 coins | KES 50 |
| 100 coins | KES 100 |
| 250 coins | KES 250 |
| 500 coins | KES 500 |

**Subscriptions (per month)**
| Plan | Normal | Premium |
|------|--------|---------|
| Schoolership | KES 299 | KES 599 |
| Network | KES 299 | KES 599 |

---

## STEP 1 — Create Firebase Project

1. Go to https://console.firebase.google.com → **Add project** → name it `kazilink-mtaani`
2. Enable these services:
   - **Authentication** → Sign-in methods → **Anonymous** → Enable
   - **Authentication** → Sign-in methods → **Email/Password** → Enable (for admin)
   - **Firestore** → Create database → Start in **Production mode** → Region: `europe-west1`
   - **Cloud Functions** → Upgrade project to **Blaze plan** (required for external APIs)
   - **Hosting** → Get started

---

## STEP 2 — Add Firebase Config to HTML Files

Go to **Project Settings → Your apps → Web app → Config** and paste the config into:

### `public/index.html` — around line 205:
```javascript
const firebaseConfig = {
  apiKey:            "YOUR_REAL_apiKey",
  authDomain:        "YOUR_REAL_authDomain",
  projectId:         "YOUR_REAL_projectId",
  storageBucket:     "YOUR_REAL_storageBucket",
  messagingSenderId: "YOUR_REAL_messagingSenderId",
  appId:             "YOUR_REAL_appId",
};
```

Also update the API URL (your Functions URL):
```javascript
const API_URL = "https://us-central1-kazilink-mtaani.cloudfunctions.net/api";
```

### `public/admin.html` — around line 555:
Same Firebase config object. The admin email is already set:
```javascript
const ADMIN_EMAILS = ['admin@kazilink.com', 'pitahwambuajr@gmail.com'];
```
Add or change admin emails here as needed.

---

## STEP 3 — Set M-Pesa Credentials

Get your credentials from https://developer.safaricom.co.ke (Production app):

```bash
firebase functions:config:set \
  mpesa.key="YOUR_CONSUMER_KEY" \
  mpesa.secret="YOUR_CONSUMER_SECRET" \
  mpesa.passkey="YOUR_PASSKEY" \
  mpesa.callback_url="https://us-central1-kazilink-mtaani.cloudfunctions.net"
```

> ⚠️ The `callback_url` must be publicly reachable — Firebase Functions URL works perfectly.

---

## STEP 4 — Deploy

```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login
firebase login

# In the kazilink/ folder — select existing project or create
firebase use kazilink-mtaani

# Install function dependencies
cd functions && npm install && cd ..

# Deploy everything at once
firebase deploy
```

Your app will be live at: `https://kazilink-mtaani.web.app`
Admin panel at: `https://kazilink-mtaani.web.app/admin.html`

---

## STEP 5 — Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## STEP 6 — Create Admin Account

1. Go to Firebase Console → **Authentication → Users → Add user**
2. Create: `pitahwambuajr@gmail.com` with a strong password
3. This account can now log in to `admin.html`

---

## API Reference

### POST `/api/stkpush`
Initiates an M-Pesa STK Push to till **5725479**.

**Body:**
```json
{
  "phone": "0712345678",
  "type":  "coins:100",
  "uid":   "firebase-anonymous-uid"
}
```

**`type` values:**
```
coins:50 | coins:100 | coins:250 | coins:500
subscription:schoolership:normal
subscription:schoolership:premium
subscription:network:normal
subscription:network:premium
```

**Success response:**
```json
{
  "success": true,
  "message": "STK Push sent to 254712345678. Enter your M-Pesa PIN.",
  "checkoutId": "ws_CO_..."
}
```

---

### POST `/api/mpesa/callback`
Called automatically by Safaricom after payment completes or fails.
- On success: credits coins or activates subscription in Firestore
- On failure: marks transaction as `failed`

---

## Firestore Collections

| Collection | Description |
|---|---|
| `users/{uid}` | User profile, coins, balance, subscription info |
| `transactions/{id}` | Every STK Push (pending → confirmed/failed) |
| `withdrawals/{id}` | Creator payout requests |
| `products/{id}` | Marketplace listings |
| `jobs/{id}` | Job board listings |
| `fraudAlerts/{id}` | Fraud detection events |
| `stats/global` | Platform-wide counters (coins sold, etc.) |
| `admin/main` | Admin-only revenue summary |

---

## Admin Dashboard Features

| Feature | Description |
|---|---|
| **Dashboard** | Revenue KPIs, pending withdrawals, fraud alerts, live chart |
| **Withdrawals** | Queue with fraud scores, approve/reject, auto-process via M-Pesa |
| **Revenue** | 30-day breakdown by type + subscription plan breakdown |
| **Users** | Search, block/unblock, freeze/unfreeze, view plan |
| **Products** | Marketplace moderation, flag & delete XSS attempts |
| **Fraud Detection** | High/medium risk accounts, one-click freeze |
| **Security Log** | Live event log for all admin actions |
| **Settings** | Till config, revenue split, subscription pricing display |

---

## Go to Google Play (TWA)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://kazilink-mtaani.web.app/manifest.json
# Package: com.kazilink.mtaani
bubblewrap build
```
Upload `app-release-signed.apk` to Google Play ($25 one-time).

---

## Pre-Launch Checklist

- [ ] Firebase config pasted into `index.html` AND `admin.html`
- [ ] `API_URL` set correctly in `index.html`
- [ ] M-Pesa credentials set via `firebase functions:config:set`
- [ ] Admin account created in Firebase Auth
- [ ] Firestore rules deployed
- [ ] Anonymous Auth enabled
- [ ] Email/Password Auth enabled
- [ ] Test one live payment (KES 1 coin purchase)
- [ ] Confirm callback hits `/api/mpesa/callback` and credits coins

---

**Support:** pitahwambuajr@gmail.com
