const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const express   = require("express");
const cors      = require("cors");
const axios     = require("axios");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TILL = "5725479";   // KaziLink Mtaani Buy-Goods Till

const COIN_PACKAGES = { 50: 50, 100: 100, 250: 250, 500: 500 };

const SUBSCRIPTION_PRICES = {
  "schoolership:normal":  299,
  "schoolership:premium": 599,
  "network:normal":       299,
  "network:premium":      599,
};

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

async function getMpesaToken() {
  const cfg  = functions.config().mpesa;
  const cred = Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
  const { data } = await axios.get(
    "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${cred}` } }
  );
  return data.access_token;
}

async function stkPush(phone, amount, ref, desc) {
  const cfg       = functions.config().mpesa;
  const token     = await getMpesaToken();
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const password  = Buffer.from(`${TILL}${cfg.passkey}${timestamp}`).toString("base64");

  const { data } = await axios.post(
    "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    {
      BusinessShortCode: TILL,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerBuyGoodsOnline",
      Amount:            Math.round(amount),
      PartyA:            phone,
      PartyB:            TILL,
      PhoneNumber:       phone,
      CallBackURL:       `${cfg.callback_url}/api/mpesa/callback`,
      AccountReference:  ref.slice(0, 12),
      TransactionDesc:   desc.slice(0, 13),
    },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return data;
}

function normalisePhone(raw = "") {
  const p = raw.replace(/\s+/g, "").replace(/^0/, "254").replace(/^\+/, "");
  if (!/^254\d{9}$/.test(p)) throw new Error("Invalid phone — use format 07XXXXXXXX");
  return p;
}

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════

app.get("/", (_req, res) => res.send("⚡ KaziLink API — Live"));

// ── POST /api/stkpush ─────────────────────────────────────────
//  Body: { phone, type, uid }
//
//  type values:
//    "coins:50" | "coins:100" | "coins:250" | "coins:500"
//    "subscription:schoolership:normal"
//    "subscription:schoolership:premium"
//    "subscription:network:normal"
//    "subscription:network:premium"
// ─────────────────────────────────────────────────────────────
app.post("/stkpush", async (req, res) => {
  try {
    const { phone, type, uid } = req.body;
    if (!phone || !type || !uid)
      return res.status(400).json({ success: false, error: "Missing phone, type or uid" });

    const normalised = normalisePhone(phone);
    let amount, ref, desc, txType, txMeta;

    if (type.startsWith("coins:")) {
      const coins = parseInt(type.split(":")[1], 10);
      if (!COIN_PACKAGES[coins])
        return res.status(400).json({ success: false, error: "Invalid package. Choose 50, 100, 250 or 500." });
      amount = COIN_PACKAGES[coins];
      ref    = "KZLCoins";
      desc   = `${coins} KaziCoins`;
      txType = "coins";
      txMeta = { coins };

    } else if (type.startsWith("subscription:")) {
      const parts   = type.split(":");               // ["subscription","schoolership","normal"]
      const planKey = `${parts[1]}:${parts[2]}`;     // "schoolership:normal"
      if (!SUBSCRIPTION_PRICES[planKey])
        return res.status(400).json({ success: false, error: `Unknown plan: ${planKey}` });
      amount = SUBSCRIPTION_PRICES[planKey];
      ref    = `KZL${parts[1].slice(0,5)}${parts[2].slice(0,3)}`;
      desc   = `${parts[1]} ${parts[2]}`;
      txType = "subscription";
      txMeta = { section: parts[1], tier: parts[2], planKey };

    } else {
      return res.status(400).json({ success: false, error: "Unknown payment type" });
    }

    const mpesa = await stkPush(normalised, amount, ref, desc);
    if (mpesa.ResponseCode !== "0")
      return res.status(502).json({ success: false, error: mpesa.ResponseDescription });

    await db.collection("transactions").add({
      uid,
      phone:      normalised,
      amount,
      type:       txType,
      meta:       txMeta,
      checkoutId: mpesa.CheckoutRequestID,
      merchantId: mpesa.MerchantRequestID,
      till:       TILL,
      status:     "pending",
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success:    true,
      message:    `STK Push sent to ${normalised}. Enter your M-Pesa PIN.`,
      checkoutId: mpesa.CheckoutRequestID,
    });

  } catch (err) {
    console.error("[stkpush]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/mpesa/callback ──────────────────────────────────
//  Safaricom calls this after user pays or cancels
// ─────────────────────────────────────────────────────────────
app.post("/mpesa/callback", async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return res.sendStatus(200);

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

    const snap = await db.collection("transactions")
      .where("checkoutId", "==", CheckoutRequestID).limit(1).get();
    if (snap.empty) return res.sendStatus(200);

    const docRef = snap.docs[0].ref;
    const tx     = snap.docs[0].data();

    if (ResultCode !== 0) {
      await docRef.update({ status: "failed", failReason: ResultDesc });
      return res.sendStatus(200);
    }

    const items   = CallbackMetadata?.Item || [];
    const receipt = items.find(i => i.Name === "MpesaReceiptNumber")?.Value || "";
    const paidAmt = items.find(i => i.Name === "Amount")?.Value || tx.amount;

    await docRef.update({ status: "confirmed", receipt, paidAmt,
      confirmedAt: admin.firestore.FieldValue.serverTimestamp() });

    const userRef = db.collection("users").doc(tx.uid);

    if (tx.type === "coins") {
      await userRef.set(
        { coins: admin.firestore.FieldValue.increment(tx.meta.coins) }, { merge: true });
      await db.collection("stats").doc("global").set(
        { totalCoinsSold: admin.firestore.FieldValue.increment(tx.meta.coins) }, { merge: true });

    } else if (tx.type === "subscription") {
      const { section, tier, planKey } = tx.meta;
      const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
      await userRef.set({
        subscribed: true, subscriptionPlan: planKey,
        subscriptionSection: section, subscriptionTier: tier,
        subscriptionExp: exp.toISOString(),
      }, { merge: true });
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("[callback]", err.message);
    return res.sendStatus(200); // always ACK Safaricom
  }
});

app.post("/pay", (_req, res) =>
  res.json({ success: true, message: "Use /stkpush for live payments." }));

exports.api = functions.https.onRequest(app);
