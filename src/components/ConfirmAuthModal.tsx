import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Lock, AlertTriangle, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';

export interface ConfirmAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (passwordInput?: string) => void;
  title: string;
  description: string;
  badgeText?: string;
  confirmText?: string;
  cancelText?: string;
  isPasswordRequired?: boolean;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export default function ConfirmAuthModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  badgeText = "AUTORIZACIÓN REQUERIDA",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isPasswordRequired = true,
  variant = 'danger'
}: ConfirmAuthModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordRequired) {
      if (password.trim() === 'sanjose2026$') {
        setError('');
        setPassword('');
        onConfirm(password.trim());
      } else {
        setError('Contraseña de autorización incorrecta. Verifique sus credenciales.');
      }
    } else {
      onConfirm();
    }
  };

  const variantStyles = {
    danger: {
      border: 'border-red-300',
      badge: 'bg-red-100 text-red-800 border-red-200',
      iconBg: 'bg-red-50 text-red-600 border-red-200',
      btn: 'bg-red-700 hover:bg-red-800 text-white shadow-md shadow-red-900/20'
    },
    warning: {
      border: 'border-amber-300',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-900/20'
    },
    info: {
      border: 'border-blue-300',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      btn: 'bg-[#af101a] hover:bg-[#85040d] text-white shadow-md'
    },
    success: {
      border: 'border-emerald-300',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      btn: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md'
    }
  }[variant];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`w-full max-w-lg bg-white rounded-2xl border ${variantStyles.border} shadow-2xl overflow-hidden font-body`}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${variantStyles.iconBg} shadow-xs`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className={`text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase border ${variantStyles.badge}`}>
                  {badgeText}
                </span>
                <h3 className="text-base font-bold text-slate-900 font-headline mt-1 tracking-tight">
                  {title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {description}
            </p>

            {isPasswordRequired && (
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Contraseña de Autorización Institucional:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#af101a]/30 focus:border-[#af101a] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${variantStyles.btn}`}
              >
                <Lock className="w-3.5 h-3.5" />
                {confirmText}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
