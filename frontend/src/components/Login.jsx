import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../config';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    let textCoordinates = [];
    const text = 'CODEXAA';
    const fontFamily = 'bold 100px Arial';

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        prepareTextCoordinates();
    };

    window.addEventListener('resize', resizeCanvas);

    // Mouse tracking setup
    const mouse = {
        x: null,
        y: null,
        isActive: false,
        isMoving: false
    };
    let mouseMoveTimeout;

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.isActive = true;
        mouse.isMoving = true;
        clearTimeout(mouseMoveTimeout);
        mouseMoveTimeout = setTimeout(() => {
            mouse.isMoving = false;
        }, 150); // Mouse is considered idle after 150ms
    });

    window.addEventListener('mouseleave', () => {
        mouse.isActive = false;
        mouse.isMoving = false;
    });

    // Touch support for mobile devices
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            mouse.isActive = true;
            mouse.isMoving = true;
            clearTimeout(mouseMoveTimeout);
            mouseMoveTimeout = setTimeout(() => {
                mouse.isMoving = false;
            }, 150);
        }
    });

    window.addEventListener('touchend', () => {
        mouse.isActive = false;
        mouse.isMoving = false;
    });

    // New class for background ghost scenery particles
    class GhostParticle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.1;
            this.speedY = (Math.random() - 0.5) * 0.1;
            this.color = `rgba(255, 255, 255, ${Math.random() * 0.2})`;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
    }

    function prepareTextCoordinates() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        tempCtx.fillStyle = 'white';
        tempCtx.font = fontFamily;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText(text, canvas.width / 2, canvas.height / 2);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        textCoordinates = [];

        for (let y = 0; y < tempCanvas.height; y += 6) { // Scan every 6 pixels for performance
            for (let x = 0; x < tempCanvas.width; x += 6) {
                const alpha = data[(y * tempCanvas.width + x) * 4 + 3];
                if (alpha > 128) { // If pixel is not transparent
                    textCoordinates.push({ x: x, y: y });
                }
            }
        }
    }

    // Bird (Boid) Element Construction
    class Bird {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 15 + 15; // Further increased bird size
            this.speedX = Math.random() * 4 - 2;
            this.speedY = Math.random() * 4 - 2;
            this.maxSpeed = Math.random() * 2 + 3;
            this.wingPhase = Math.random() * Math.PI; 
            this.color = `hsla(${Math.random() * 360}, 80%, 70%, ${Math.random() * 0.5 + 0.4})`;
            this.target = null;
        }

        update() {
            if (mouse.isActive && mouse.isMoving) {
                // Follow the cursor when mouse is moving
                this.target = null; // Clear text target
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 1) {
                    this.speedX += (dx / distance) * 0.2;
                    this.speedY += (dy / distance) * 0.2;
                }
                this.speedX += (Math.random() - 0.5) * 0.2;
                this.speedY += (Math.random() - 0.5) * 0.2;

            } else if (mouse.isActive && !mouse.isMoving && this.target) {
                // Go to text target when mouse is idle on canvas
                let dx = this.target.x - this.x;
                let dy = this.target.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 1) {
                    this.speedX += (dx / distance) * 0.5;
                    this.speedY += (dy / distance) * 0.5;
                }
                this.speedX += (Math.random() - 0.5) * 0.1;
                this.speedY += (Math.random() - 0.5) * 0.1;
            } else {
                // Disperse randomly when mouse is off canvas
                this.speedX += (Math.random() - 0.5) * 0.2;
                this.speedY += (Math.random() - 0.5) * 0.2;
            }

            // Enforce maximum velocity cap
            const currentSpeed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY);
            const maxSpeed = (mouse.isActive && !mouse.isMoving) ? this.maxSpeed + 4 : this.maxSpeed; // Fly faster to get into shape
            if (currentSpeed > maxSpeed) {
                this.speedX = (this.speedX / currentSpeed) * this.maxSpeed;
                this.speedY = (this.speedY / currentSpeed) * this.maxSpeed;
            }

            this.x += this.speedX;
            this.y += this.speedY;

            // Screen boundary wrapping loops
            if (this.x < -50) this.x = canvas.width + 50;
            if (this.x > canvas.width + 50) this.x = -50;
            if (this.y < -50) this.y = canvas.height + 50;
            if (this.y > canvas.height + 50) this.y = -50;

            // Wing animation cycles matching actual speed acceleration
            this.wingPhase += Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY) * 0.05 + 0.05;
        }

        draw() {
            const angle = Math.atan2(this.speedY, this.speedX);
            
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            
            // Sinewave calculations for the flight mechanics
            const wingSpread = Math.sin(this.wingPhase) * (this.size * 0.6);

            ctx.beginPath();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1.5; // Slightly thinner line for a more detailed look with higher bird counts
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Elegant vector paths representing a flying bird silhouette
            ctx.moveTo(-this.size * 0.5, -wingSpread); 
            ctx.quadraticCurveTo(0, -this.size * 0.2, 0, 0); 
            ctx.quadraticCurveTo(0, -this.size * 0.2, this.size * 0.5, -wingSpread);

            ctx.stroke();
            ctx.restore();
        }
    }

    // Initialize Flock Setup
    const flock = [];
    const scenery = [];
    const numberOfBirds = 250; // Increased bird count for a dense, massive flock effect
    const numberOfParticles = 100;
    
    let lastMouseMoveState = false;

    function init() {
        resizeCanvas(); // This will also call prepareTextCoordinates
        for (let i = 0; i < numberOfParticles; i++) {
            scenery.push(new GhostParticle());
        }
        for (let i = 0; i < numberOfBirds; i++) {
            flock.push(new Bird());
        }
    }

    // Native Render Loop running at peak hardware refresh rates
    function animate() {
        // Check if mouse has stopped moving to assign targets
        if (!mouse.isMoving && lastMouseMoveState) {
            flock.forEach((bird, i) => {
                bird.target = textCoordinates[i % textCoordinates.length];
            });
        }
        lastMouseMoveState = mouse.isMoving;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        scenery.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        flock.forEach(bird => {
            bird.update();
            bird.draw();
        });

        animationFrameId = requestAnimationFrame(animate);
    }

    init();
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', mouse.moveHandler);
      window.removeEventListener('mouseleave', mouse.leaveHandler);
      window.removeEventListener('touchmove', mouse.touchMoveHandler);
      window.removeEventListener('touchend', mouse.touchEndHandler);
      clearTimeout(mouseMoveTimeout);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
    </div>
  );
}