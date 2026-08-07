import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (mode: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias') => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Por favor ingrese su correo electrónico y contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      let validUsers: any[] = [];
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          validUsers = await res.json();
        }
      } catch (err) {
        console.warn('Fallback checking local users storage', err);
      }

      if (!validUsers.length) {
        const cached = localStorage.getItem('credsj_users');
        if (cached) validUsers = JSON.parse(cached);
      }

      const cleanEmail = email.trim().toLowerCase();
      const matchedUser = validUsers.find(
        (u: any) => u.email && u.email.trim().toLowerCase() === cleanEmail && String(u.password || '').trim() === password.trim()
      );

      if (matchedUser) {
        setIsSubmitting(false);
        const effectiveRole = matchedUser.role || 'admin';
        onLoginSuccess(effectiveRole);
      } else {
        setIsSubmitting(false);
        setErrorMsg('Acceso denegado: El correo electrónico o la contraseña son incorrectos.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('Error al conectar con la base de datos para autenticación.');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-body text-slate-900 w-full overflow-hidden">
      {/* Left Panel - Visual & Stats (Hidden on mobile) */}
      <section className="hidden lg:flex lg:w-7/12 relative items-center justify-center bg-primary overflow-hidden min-h-screen">
        {/* Background Overlay with Gradient Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#af101a] via-[#80000a] to-[#0f3d1b] opacity-90 z-10" />
        <img
          alt="Tecnología Médica"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30 grayscale"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjm1fEj-5CEbS4SqVDeJRGWT1Itn2WgYEbM9FqsbiPTDtBQTsZ4H-6CNjl7iBThl0aHXyFOYQv4ELH2h4vXWhxHavs9sW7AaJ0zDX9bcMLaNmRkVfmSbQagXkLy9rSDCkPeNR_5gBmdhWjAC9a_VKhkTVbi5oBPb2fPfloKjKukhITe6u6suKs68dUhL7gbaENPOaponfqIzRneojxLVbwJIQCuALeT4TFxajUISsdyPrklFXZLfoRhzbWlQ-k8QD6zJZEzbqCfQ"
          referrerPolicy="no-referrer"
        />

        <div className="relative z-20 px-16 max-w-2xl text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <span className="inline-flex items-center gap-2 bg-white/10 text-[#ffdad6] backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-white/10">
              <span className="material-symbols-outlined text-sm font-semibold">verified_user</span>
              Seguridad de Grado Empresarial
            </span>
            <h1 className="font-headline text-5xl xl:text-6xl font-extrabold tracking-tighter leading-tight mb-6">
              Supervisión de Precisión para Personal de Credencialización.
            </h1>
            <p className="text-white/80 text-lg xl:text-xl leading-relaxed font-light">
              El estándar de oro en el control normativo de credenciales de salud. Verifique, rastree y gestione de forma segura la excelencia clínica y de recursos humanos.
            </p>
          </motion.div>

          {/* Stats Bento Cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm col-span-2 md:col-span-1">
              <div className="text-[#a3f69c] text-3xl font-extrabold font-headline">99.9%</div>
              <div className="text-white/60 text-sm font-medium">Precisión de Verificación</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm col-span-2 md:col-span-1">
              <div className="text-[#a3f69c] text-3xl font-extrabold font-headline">100%</div>
              <div className="text-white/60 text-sm font-medium">Cifrado de Extremo a Extremo</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Right Panel - Login Card */}
      <section className="w-full lg:w-5/12 flex items-center justify-center p-8 lg:p-16 bg-white relative min-h-screen">
        {/* Decorative ambient blurred backgrounds */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="w-full max-w-md relative z-10">
          {/* Logo & Heading */}
          <div className="mb-10 text-left">
            <h2 className="font-headline text-4xl font-extrabold tracking-tighter text-primary flex items-center gap-1">
              <span className="text-primary font-bold tracking-tight text-3xl font-headline" style={{ letterSpacing: '-1.5px' }}>
                CredSJ
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 border border-slate-200 px-2 py-0.5 rounded ml-2">PRO</span>
            </h2>
            <p className="text-slate-500 font-medium mt-2">Inicie sesión en su Centro de Comando</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-red-50 text-red-800 border-l-4 border-red-600 rounded text-sm font-medium">
                {errorMsg}
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Email Address */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  Correo Institucional
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-primary transition-colors">
                    <Mail className="w-5 h-5 stroke-[2]" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm"
                    placeholder="ejemplo@hospital.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Clave de Acceso Segura
                  </label>
                  <a href="#" onClick={(e) => { e.preventDefault(); alert('Por favor contacte al administrador de TI para restablecer su password.'); }} className="text-xs font-bold text-primary hover:text-primary-hover transition-colors">
                    ¿Olvidó su clave?
                  </a>
                </div>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-primary transition-colors">
                    <Lock className="w-5 h-5 stroke-[2]" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember me option */}
            <div className="flex items-center gap-3 px-1 select-none">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 font-medium cursor-pointer">
                Mantener mi sesión activa por 8 horas
              </label>
            </div>

            {/* Access CTA Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-5 rounded-full font-headline font-extrabold text-lg shadow-lg hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-3 relative overflow-hidden group cursor-pointer disabled:opacity-50"
              >
                <span className="relative z-10">
                  {isSubmitting ? 'Procediendo...' : 'Autorizar Acceso'}
                </span>
                {!isSubmitting && <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </form>

          {/* Footer compliance & support */}
          <div className="mt-16 text-center lg:text-left border-t border-slate-200 pt-8">
            <p className="text-xs text-slate-500 flex items-center justify-center lg:justify-start gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-50" />
              Estándar de Cumplimiento: Certificación HIPAA y SOC2 Tipo II
            </p>
            <div className="flex gap-6 mt-4 justify-center lg:justify-start font-bold">
              <a href="#" onClick={(e) => {e.preventDefault(); alert('Soporte Técnico: soporte@medverify.pro');}} className="text-xs text-slate-500 hover:text-primary transition-colors">
                Soporte Técnico
              </a>
              <a href="#" onClick={(e) => {e.preventDefault(); alert('Estatutos de Privacidad: Todo proceso está cifrado AES-256.');}} className="text-xs text-slate-500 hover:text-primary transition-colors">
                Estatutos de Privacidad
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Floating System Status (Visual Anchor) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => alert('Sistema operacional: Todos los nodos de verificación de CredSJ están activos.')}
          className="flex items-center gap-2 bg-white text-slate-800 px-4 py-3 rounded-full shadow-xl border border-slate-200 hover:bg-slate-50 transition-all group cursor-pointer"
        >
          <span className="material-symbols-outlined text-emerald-600 font-bold">contact_support</span>
          <span className="text-xs font-bold uppercase tracking-wider">Estado del Sistema</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        </button>
      </div>
    </div>
  );
}
