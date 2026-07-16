import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../config';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState('');
  const [cartSuccess, setCartSuccess] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;    

    // --- New Particle Constellation Effect ---

    let particlesArray;

    const mouse = {
        x: null,
        y: null,
        radius: (canvas.height / 110) * (canvas.width / 110)
    };

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
        }
    }, { passive: true });
    window.addEventListener('touchend', () => {
        mouse.x = null;
        mouse.y = null;
    });

    class Particle {
        constructor(x, y, directionX, directionY, size, color) {
            this.x = x;
            this.y = y;
            this.directionX = directionX;
            this.directionY = directionY;
            this.size = size;
            this.color = color;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = 'rgba(165, 180, 252, 0.6)'; // Indigo-300 with opacity
            ctx.fill();
        }

        update() {
            if (this.x > canvas.width || this.x < 0) {
                this.directionX = -this.directionX;
            }
            if (this.y > canvas.height || this.y < 0) {
                this.directionY = -this.directionY;
            }

            this.x += this.directionX;
            this.y += this.directionY;
            this.draw();
        }
    }

    function init() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        mouse.radius = (canvas.height / 110) * (canvas.width / 110);

        particlesArray = [];
        let numberOfParticles = (canvas.height * canvas.width) / 9000;
        for (let i = 0; i < numberOfParticles; i++) {
            let size = (Math.random() * 2) + 1;
            let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
            let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
            let directionX = (Math.random() * .4) - 0.2;
            let directionY = (Math.random() * .4) - 0.2;
            let color = 'rgba(199, 210, 254, 0.8)';

            particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
        }
    }

    function connect() {
        let opacityValue = 1;
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x))
                    + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
                if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                    opacityValue = 1 - (distance / 20000);
                    ctx.strokeStyle = `rgba(140, 158, 255, ${opacityValue})`; // Indigo-300
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
        }
        connect();
    }

    window.addEventListener('resize', () => {
        init();
    });

    init();
    animate();

    return () => {
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
      window.removeEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });
      window.removeEventListener('touchmove', (e) => { if (e.touches.length > 0) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } });
      window.removeEventListener('touchend', () => { mouse.x = null; mouse.y = null; });
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Fetch subscription plans on component mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Fetch subscription plans when modal opens (to refresh)
  useEffect(() => {
    if (showSubscriptionModal) {
      fetchPlans();
    }
  }, [showSubscriptionModal]);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/subscription-plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  };

  const addToCart = (plan) => {
    if (cart.some(item => item.id === plan.id)) {
      setCartError('This plan is already in your cart');
      return;
    }
    setCart([...cart, plan]);
    setCartError('');
  };

  const removeFromCart = (planId) => {
    setCart(cart.filter(item => item.id !== planId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, plan) => total + parseFloat(plan.price), 0);
  };

  const handleCartSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setCartError('Your cart is empty');
      return;
    }

    if (!customerName || !customerEmail || !customerPhone) {
      setCartError('Please fill in all contact information');
      return;
    }

    setCartLoading(true);
    setCartError('');
    setCartSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/subscription-cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          plans: cart.map(plan => plan.id),
          total_amount: getCartTotal(),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Cart submission failed');
      }

      setCartSuccess('Cart submitted successfully! The superadmin will review your subscription request.');
      setCart([]);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setTimeout(() => {
        setShowSubscriptionModal(false);
        setCartSuccess('');
      }, 3000);
    } catch (err) {
      setCartError(err.message);
    } finally {
      setCartLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // CRUCIAL FIX FOR INFINITYFREE: Bypasses the security firewall
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user);
    } catch (err) {
      setError('Cannot connect to server. Make sure the backend is running.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-800 to-slate-950 p-12 relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />
        <div className="relative w-full h-full">
          {/* Logo top-left */}
          <div className="absolute top-0 left-0 z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-600 shadow-2xl shadow-indigo-600/40">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          {/* Text top-center */}
          <h1 className="absolute top-0 left-1/2 -translate-x-1/2 text-4xl font-bold text-white tracking-tight">Codexaa-POS++</h1>
          <p className="absolute top-12 left-1/2 -translate-x-1/2 text-slate-400 max-w-sm text-center">A full-stack, web-based Multi-Tenant POS System built with React, PHP, and MySQL.</p>
          
          {/* Subscription Plans Display - Bottom Left */}
          <div className="absolute bottom-12 left-12 z-10 w-80">
            <h3 className="text-lg font-bold text-white mb-3">Subscription Plans</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {plans.length === 0 ? (
                <p className="text-slate-400 text-sm">Loading plans...</p>
              ) : (
                plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-3 transition-all cursor-pointer ${cart.some(item => item.id === plan.id) ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-600 bg-slate-800/50 hover:bg-slate-700/50'}`}
                    onClick={() => addToCart(plan)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-white text-sm">{plan.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{plan.billing_cycle}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-400 text-sm">৳{parseFloat(plan.price).toFixed(0)}</p>
                        {cart.some(item => item.id === plan.id) && (
                          <p className="text-xs text-emerald-400">Added</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {cart.length > 0 && (
              <div className="mt-3 bg-indigo-600/30 border border-indigo-400/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white text-sm font-semibold">Cart ({cart.length})</span>
                  <span className="text-indigo-300 font-bold">৳{getCartTotal().toFixed(0)}</span>
                </div>
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  View Cart & Checkout
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-slate-600/20 rounded-full blur-3xl" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-600 shadow-2xl shadow-indigo-600/40 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Codexaa-POS++</h1>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Account Login</h2>
          <p className="text-sm text-slate-400">Sign in to your account to continue</p>

          <div className="mt-8">
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
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Signing in...</>
                ) : (
                  <>Sign In<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500 text-center mb-4 font-medium uppercase tracking-wider">Demo Credentials</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => { setEmail('mk.rabbani.cse@gmail.com'); setPassword('*********'); }} className="flex items-center gap-3 w-full text-left bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                  <span className="text-xs font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full shrink-0">SUPER ADMIN</span>
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">Restricted!!!</span>
                </button>
                <button type="button" onClick={() => { setEmail('alice@boutique.com'); setPassword('alice123'); }} className="flex items-center gap-3 w-full text-left bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                  <span className="text-xs font-bold bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full shrink-0">SHOP ADMIN</span>
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">alice@boutique.com</span>
                </button>
                <button type="button" onClick={() => { setEmail('admin@lakeside.com'); setPassword('lakeside123'); }} className="flex items-center gap-3 w-full text-left bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                  <span className="text-xs font-bold bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full shrink-0">SHOP ADMIN</span>
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">admin@lakeside.com</span>
                </button>
                <button type="button" onClick={() => { setEmail('staff1@boutique.com'); setPassword('staff123'); }} className="flex items-center gap-3 w-full text-left bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 rounded-xl px-3 py-2.5 transition-colors group">
                  <span className="text-xs font-bold bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full shrink-0">SHOP STAFF</span>
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">staff1@boutique.com</span>
                </button>
              </div>
            </div>

            <p className="text-center text-slate-600 text-xs mt-8">
              Multi-Tenant Point of Sale System &copy; {new Date().getFullYear()}
              developed by <a href="https://its-mk.netlify.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 transition-colors">MK</a>
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Subscription Plans</h3>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {cartSuccess && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-700 font-medium">{cartSuccess}</p>
              </div>
            )}

            {cartError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-rose-700 font-medium">{cartError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Plans Section */}
              <div className="lg:col-span-2">
                <h4 className="font-semibold text-slate-800 mb-4">Available Plans</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`border-2 rounded-xl p-4 transition-all ${cart.some(item => item.id === plan.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-800">{plan.name}</h4>
                          <p className="text-2xl font-extrabold text-indigo-600 mt-1">৳{parseFloat(plan.price).toFixed(0)}</p>
                          <p className="text-xs text-slate-500 capitalize">{plan.billing_cycle}</p>
                        </div>
                        <button
                          onClick={() => addToCart(plan)}
                          disabled={cart.some(item => item.id === plan.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${cart.some(item => item.id === plan.id) ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-gray-600 hover:bg-gray-700 text-white'}`}
                        >
                          {cart.some(item => item.id === plan.id) ? 'Added' : 'Add to Cart'}
                        </button>
                      </div>
                      {(plan.features || []).length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {plan.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="text-xs text-slate-600 flex items-center gap-1">
                              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart Section */}
              <div className="lg:col-span-1">
                <h4 className="font-semibold text-slate-800 mb-4">Your Cart ({cart.length})</h4>
                <div className="bg-slate-50 rounded-xl p-4">
                  {cart.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">Your cart is empty</p>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg">
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                              <p className="text-xs text-slate-500 capitalize">{item.billing_cycle}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-indigo-600 text-sm">৳{parseFloat(item.price).toFixed(0)}</p>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-rose-500 hover:text-rose-700 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-200 mt-4 pt-4">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-800">Total</span>
                          <span className="font-bold text-xl text-indigo-600">৳{getCartTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Contact Information */}
                {cart.length > 0 && (
                  <form onSubmit={handleCartSubmit} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your Name *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        placeholder="Full Name"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                        placeholder="your@email.com"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        required
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubscriptionModal(false);
                          setCartError('');
                          setCartSuccess('');
                          setCart([]);
                          setCustomerName('');
                          setCustomerEmail('');
                          setCustomerPhone('');
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={cartLoading}
                        className="flex-1 py-2.5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                      >
                        {cartLoading ? 'Submitting...' : 'Submit Cart'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}