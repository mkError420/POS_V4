import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../config';

// Payment method config
const PAYMENT_METHODS = [
  { id: 'bkash',   label: 'bKash',         color: 'rose',   number: '017XXXXXXXX' },
  { id: 'nagad',   label: 'Nagad',          color: 'orange', number: '018XXXXXXXX' },
  { id: 'rocket',  label: 'Rocket',         color: 'violet', number: '019XXXXXXXX' },
  { id: 'banking', label: 'Bank Transfer',  color: 'blue',   number: 'ACC: XXXX-XXXX' },
];

const CYCLE_LABEL = { monthly: '/mo', quarterly: '/qtr', yearly: '/yr' };
const CYCLE_BADGE = {
  monthly:   'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  quarterly: 'bg-amber-500/20  text-amber-300  border-amber-500/30',
  yearly:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // Subscription state
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Checkout modal (3 steps: info → payment → confirm)
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1=contact 2=payment 3=success
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Step 1 – Contact info
  const [customerName, setCustomerName]   = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Step 2 – Payment
  const [paymentMethod, setPaymentMethod]   = useState('');
  const [transactionId, setTransactionId]   = useState('');
  const [amountPaid, setAmountPaid]         = useState('');

  // ── Canvas particle animation ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];
    const mouse = { x: null, y: null };

    const onMove  = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onOut   = ()  => { mouse.x = null; mouse.y = null; };
    const onTouch = (e) => { if (e.touches.length) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onOut);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onOut);

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.dx = (Math.random() * 0.4) - 0.2;
        this.dy = (Math.random() * 0.4) - 0.2;
        this.size = Math.random() * 2 + 1;
      }
      update() {
        if (this.x > canvas.width || this.x < 0) this.dx = -this.dx;
        if (this.y > canvas.height || this.y < 0) this.dy = -this.dy;
        this.x += this.dx; this.y += this.dy;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165,180,252,0.6)';
        ctx.fill();
      }
    }

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const n = Math.floor((canvas.width * canvas.height) / 9000);
      particles = Array.from({ length: n }, () => new Particle());
    };

    const connect = () => {
      const limit = (canvas.width / 7) * (canvas.height / 7);
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const d = (particles[a].x - particles[b].x) ** 2 + (particles[a].y - particles[b].y) ** 2;
          if (d < limit) {
            ctx.strokeStyle = `rgba(140,158,255,${1 - d / 20000})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      animId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => p.update());
      connect();
    };

    const onResize = () => init();
    window.addEventListener('resize', onResize);
    init(); animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onOut);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onOut);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // ── Fetch plans ────────────────────────────────────────────────────────────
  useEffect(() => { fetchPlans(); }, []);
  const fetchPlans = async () => {
    setPlansLoading(true);
    setPlansError(false);
    try {
      const r = await fetch(`${API_BASE_URL}/subscription-plans`);
      if (r.ok) {
        const data = await r.json();
        setPlans(data);
      } else {
        setPlansError(true);
      }
    } catch {
      setPlansError(true);
    } finally {
      setPlansLoading(false);
    }
  };

  // ── Open checkout for a plan ───────────────────────────────────────────────
  const openCheckout = (plan) => {
    setSelectedPlan(plan);
    setCheckoutStep(1);
    setCheckoutError('');
    setCustomerName(''); setCustomerEmail(''); setCustomerPhone('');
    setPaymentMethod(''); setTransactionId(''); setAmountPaid(String(parseFloat(plan.price).toFixed(0)));
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
    setCheckoutError('');
  };

  // ── Step 1 → Step 2 ───────────────────────────────────────────────────────
  const handleContactNext = (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setCheckoutError('All contact fields are required.'); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(customerEmail)) {
      setCheckoutError('Enter a valid email address.'); return;
    }
    setCheckoutError('');
    setCheckoutStep(2);
  };

  // ── Step 2 → Submit ───────────────────────────────────────────────────────
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentMethod) { setCheckoutError('Please select a payment method.'); return; }
    if (!transactionId.trim()) { setCheckoutError('Transaction ID / reference is required.'); return; }
    if (!amountPaid || parseFloat(amountPaid) <= 0) { setCheckoutError('Enter the amount you paid.'); return; }

    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const res = await fetch(`${API_BASE_URL}/subscription-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          plans: [selectedPlan.id],
          total_amount: parseFloat(selectedPlan.price),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          amount_paid: parseFloat(amountPaid),
        }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
      if (!res.ok) throw new Error(data.error || `Submission failed (HTTP ${res.status}).`);
      setCheckoutStep(3);
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ── Login form submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
      if (!res.ok) {
        setError(data.error || `Login failed (HTTP ${res.status}).`);
        setLoading(false);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.');
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col lg:flex-row">

      {/* ═══ LEFT PANEL ══════════════════════════════════════════════════════ */}
      <div className="flex w-full lg:w-1/2 bg-gradient-to-br from-slate-800 to-slate-950 p-8 sm:p-10 lg:p-12 relative overflow-hidden min-h-[300px] sm:min-h-[340px] lg:min-h-screen">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Glow orbs */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-slate-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full flex flex-col gap-8 lg:gap-0 lg:justify-between">

          {/* ── Brand header ────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 shadow-xl shrink-0">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Codexaa‑POS++</h1>
              <p className="text-slate-400 text-sm mt-1 max-w-xs leading-relaxed"> Incrementing your business potential</p>
            </div>
          </div>

          {/* ── Subscription plans section ───────────────────────────────── */}
          <div className="w-full">
            {/* Section label */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/40 to-transparent" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap">Choose a Plan</span>
              <div className="flex-1 h-px bg-gradient-to-l from-indigo-500/40 to-transparent" />
            </div>

            {/* Plan cards */}
            <div className="space-y-2.5 max-h-44 sm:max-h-56 lg:max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {plansLoading ? (
                <div className="flex items-center gap-2.5 py-5 px-1">
                  <div className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full shrink-0" />
                  <span className="text-slate-400 text-sm">Loading plans…</span>
                </div>
              ) : plansError ? (
                <div className="py-4 px-1 space-y-2">
                  <p className="text-slate-500 text-sm">Could not load plans right now.</p>
                  <button
                    type="button"
                    onClick={fetchPlans}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : plans.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 px-1">No plans available yet.</p>
              ) : (
                plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => openCheckout(plan)}
                    className="w-full text-left group relative border border-slate-600/60 hover:border-indigo-500/70 bg-slate-800/50 hover:bg-slate-700/60 rounded-xl p-3.5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-900/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon dot */}
                        <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 group-hover:scale-125 transition-transform" />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{plan.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${CYCLE_BADGE[plan.billing_cycle] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                              {plan.billing_cycle}
                            </span>
                            {(plan.features || []).slice(0, 1).map((f, i) => (
                              <span key={i} className="text-[10px] text-slate-400 truncate">{f}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-indigo-300 text-base leading-none">
                          ৳{parseFloat(plan.price).toFixed(0)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{CYCLE_LABEL[plan.billing_cycle]}</p>
                      </div>
                    </div>
                    {/* Subscribe arrow */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* CTA hint */}
            {!plansLoading && !plansError && plans.length > 0 && (
              <p className="text-center text-[10px] text-slate-500 mt-3">
                Click any plan to subscribe with manual payment
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-white mb-1">Account Login</h2>
          <p className="text-sm text-slate-400 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
                <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-rose-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input id="email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword
                    ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0">
              {loading
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</>
                : <>Sign In<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></>
              }
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center mb-4 font-medium uppercase tracking-wider">Demo Credentials</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => { setEmail('mk.rabbani.cse@gmail.com'); setPassword('*********'); }}
                className="flex items-center gap-2 w-full text-left bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full shrink-0">SUPER ADMIN</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 truncate">Restricted!!!</span>
              </button>
              <button type="button" onClick={() => { setEmail('alice@boutique.com'); setPassword('alice123'); }}
                className="flex items-center gap-2 w-full text-left bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                <span className="text-[10px] font-bold bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full shrink-0">SHOP ADMIN</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 truncate">alice@boutique.com</span>
              </button>
              <button type="button" onClick={() => { setEmail('admin@lakeside.com'); setPassword('lakeside123'); }}
                className="flex items-center gap-2 w-full text-left bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                <span className="text-[10px] font-bold bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full shrink-0">SHOP ADMIN</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 truncate">admin@lakeside.com</span>
              </button>
              <button type="button" onClick={() => { setEmail('staff1@boutique.com'); setPassword('staff123'); }}
                className="flex items-center gap-2 w-full text-left bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                <span className="text-[10px] font-bold bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full shrink-0">SHOP STAFF</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 truncate">staff1@boutique.com</span>
              </button>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-8">
            Multi-Tenant POS &copy; {new Date().getFullYear()} by{' '}
            <a href="https://its-mk.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-400 transition-colors">MK</a>
          </p>
        </div>
      </div>

      {/* ═══ CHECKOUT MODAL ══════════════════════════════════════════════════ */}
      {showCheckout && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-xs font-semibold uppercase tracking-wider mb-0.5">
                  {checkoutStep === 1 ? 'Step 1 of 2 — Contact Info' : checkoutStep === 2 ? 'Step 2 of 2 — Payment' : 'Order Confirmed'}
                </p>
                <h3 className="text-white font-extrabold text-lg">Subscribe to {selectedPlan.name}</h3>
              </div>
              {checkoutStep !== 3 && (
                <button onClick={closeCheckout} className="text-white/60 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Step indicator */}
            {checkoutStep < 3 && (
              <div className="flex px-6 pt-4 gap-2">
                {[1, 2].map(s => (
                  <div key={s} className={`flex-1 h-1 rounded-full transition-all ${checkoutStep >= s ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                ))}
              </div>
            )}

            {/* Plan summary pill */}
            {checkoutStep < 3 && (
              <div className="mx-6 mt-4 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Selected Plan</p>
                  <p className="font-bold text-slate-800 text-sm">{selectedPlan.name}
                    <span className="ml-2 text-[10px] font-bold uppercase text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded">
                      {selectedPlan.billing_cycle}
                    </span>
                  </p>
                </div>
                <p className="font-extrabold text-indigo-600 text-xl">৳{parseFloat(selectedPlan.price).toFixed(0)}</p>
              </div>
            )}

            {/* Error alert */}
            {checkoutError && (
              <div className="mx-6 mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-rose-700 text-sm">{checkoutError}</p>
              </div>
            )}

            {/* ── STEP 1: Contact Info ─────────────────────────────────── */}
            {checkoutStep === 1 && (
              <form onSubmit={handleContactNext} className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required
                      placeholder="Your full name"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address *</label>
                    <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} required
                      placeholder="you@example.com"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number *</label>
                    <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required
                      placeholder="01XXXXXXXXX"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeCheckout}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow transition-colors flex items-center justify-center gap-2">
                    Continue <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2: Payment ──────────────────────────────────────── */}
            {checkoutStep === 2 && (
              <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">

                {/* Payment method buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Payment Method *</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                        className={`relative flex items-center gap-2.5 border-2 rounded-xl px-3 py-2.5 text-left transition-all ${
                          paymentMethod === m.id
                            ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}>
                        {paymentMethod === m.id && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                            </svg>
                          </div>
                        )}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0
                          ${m.id === 'bkash'   ? 'bg-rose-100 text-rose-600'   :
                            m.id === 'nagad'   ? 'bg-orange-100 text-orange-600' :
                            m.id === 'rocket'  ? 'bg-violet-100 text-violet-600' :
                            'bg-blue-100 text-blue-600'}`}>
                          {m.label.slice(0, 1)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{m.label}</p>
                          <p className="text-[10px] text-slate-400">{m.number}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment instructions */}
                {paymentMethod && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">Payment Instructions</p>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      Send <strong>৳{parseFloat(selectedPlan.price).toFixed(0)}</strong> to the{' '}
                      <strong>{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</strong> number above,
                      then fill in your transaction details below.
                    </p>
                  </div>
                )}

                {/* Transaction ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Transaction ID / Reference *
                  </label>
                  <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} required
                    placeholder="e.g. 8N3KX7AB2D"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  <p className="text-[10px] text-slate-400 mt-1">Copy the transaction ID from your payment confirmation.</p>
                </div>

                {/* Amount paid */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount Paid (৳) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
                    <input type="number" min="1" step="0.01" value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)} required
                      className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setCheckoutStep(1); setCheckoutError(''); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg> Back
                  </button>
                  <button type="submit" disabled={checkoutLoading}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl text-sm shadow transition-colors flex items-center justify-center gap-2">
                    {checkoutLoading
                      ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>
                      : <>Submit Request <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg></>
                    }
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 3: Success ──────────────────────────────────────── */}
            {checkoutStep === 3 && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-extrabold text-slate-800">Request Submitted!</h4>
                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Your subscription request for <strong>{selectedPlan.name}</strong> has been sent.
                  The super admin will review your payment and activate your account within 24 hours.
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Name</span>
                    <span className="font-semibold text-slate-700">{customerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Email</span>
                    <span className="font-semibold text-slate-700">{customerEmail}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Payment via</span>
                    <span className="font-semibold text-slate-700 capitalize">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Txn ID</span>
                    <span className="font-mono font-bold text-indigo-600">{transactionId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-bold text-emerald-600">৳{parseFloat(amountPaid).toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={closeCheckout}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow transition-colors mt-2">
                  Done
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
