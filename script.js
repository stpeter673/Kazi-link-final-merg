// ══════════════════════════════════════════════════════════════════════════════
//  KaziLink Mtaani — Shared Utilities  (loaded by index.html)
// ══════════════════════════════════════════════════════════════════════════════

// ── PWA: Register Service Worker ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg  => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// ── Phone formatter ───────────────────────────────────────────────────────────
// Auto-formats 07XXXXXXXX input as user types
function formatPhoneInput(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.startsWith('254')) v = '0' + v.slice(3);
  if (v.length > 10) v = v.slice(0, 10);
  input.value = v;
}

// ── Normalise phone for API ───────────────────────────────────────────────────
function normalisePhone(raw) {
  const p = (raw || '').replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!/^254\d{9}$/.test(p)) throw new Error('Invalid phone. Use format 07XXXXXXXX');
  return p;
}

// ── Debounce helper ───────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ── Format KES amount ─────────────────────────────────────────────────────────
function formatKES(n) {
  return 'KES ' + Number(n || 0).toLocaleString('en-KE');
}

// ── Time ago ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ── Coin package info ─────────────────────────────────────────────────────────
const COIN_PACKAGES = [
  { coins: 50,  price: 50,  icon: '🪙',  label: 'Starter' },
  { coins: 100, price: 100, icon: '💰',  label: 'Popular' },
  { coins: 250, price: 250, icon: '💎',  label: 'Value'   },
  { coins: 500, price: 500, icon: '🏆',  label: 'Power'   },
];

// ── Subscription plan info ────────────────────────────────────────────────────
const PLANS = {
  'schoolership:normal':  { section:'schoolership', tier:'normal',  price:299, label:'Schoolership Normal',  icon:'🎓' },
  'schoolership:premium': { section:'schoolership', tier:'premium', price:599, label:'Schoolership Premium', icon:'🎓' },
  'network:normal':       { section:'network',      tier:'normal',  price:299, label:'Network Normal',       icon:'🌐' },
  'network:premium':      { section:'network',      tier:'premium', price:599, label:'Network Premium',      icon:'🌐' },
};

// ── Toast (global fallback) ───────────────────────────────────────────────────
function showToast(msg, duration = 4000) {
  let el = document.getElementById('globalToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalToast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:#1a2040;border:1px solid #2a3060;border-radius:10px;padding:11px 20px;' +
      'font-size:13px;font-family:"Space Grotesk",sans-serif;color:#e2e8f8;z-index:9999;' +
      'opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, duration);
}

console.log('✅ KaziLink Mtaani — scripts loaded');
