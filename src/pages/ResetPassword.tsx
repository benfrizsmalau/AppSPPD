import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// ─── Schema ──────────────────────────────────────────────────────────────────

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password minimal 8 karakter'),
    konfirmasi_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.password === d.konfirmasi_password, {
    message: 'Password tidak cocok',
    path: ['konfirmasi_password'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

// ─── Password strength ───────────────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Sangat Lemah', color: '#F43F5E' };
  if (score === 2) return { score: 2, label: 'Lemah', color: '#F59E0B' };
  if (score === 3) return { score: 3, label: 'Sedang', color: '#06B6D4' };
  return { score: 4, label: 'Kuat', color: '#10B981' };
}

// ─── Component ───────────────────────────────────────────────────────────────

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
  });

  const passwordValue = watch('password', '');
  const strength = getPasswordStrength(passwordValue);

  const onSubmit = async (data: ResetFormValues) => {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setSubmitError(error.message || 'Gagal mengatur ulang password. Silakan coba lagi.');
      return;
    }
    toast.success('Password berhasil diubah! Silakan masuk dengan password baru Anda.');
    setTimeout(() => {
      navigate('/masuk', { replace: true });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/masuk" className="inline-flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 40,
                height: 40,
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
              }}
            >
              <ShieldCheck size={20} color="white" />
            </div>
            <span className="text-xl font-bold text-slate-900">SiSPPD</span>
          </Link>
        </div>

        <div className="card p-8">
          {/* Header */}
          <div className="mb-6">
            <div
              className="flex items-center justify-center rounded-2xl mx-auto mb-4"
              style={{
                width: 56,
                height: 56,
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.15)',
              }}
            >
              <KeyRound size={24} color="#2563EB" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 text-center mb-1">
              Atur Ulang Password
            </h1>
            <p className="text-sm text-slate-500 text-center leading-relaxed">
              Masukkan password baru Anda di bawah ini.
            </p>
          </div>

          {submitError && (
            <div className="alert alert-danger mb-5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-5">
              {/* New password */}
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password Baru <span className="required-mark">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 karakter"
                    className={`form-input pr-10${errors.password ? ' is-error' : ''}`}
                    {...register('password')}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="form-error">
                    <AlertCircle size={12} />
                    {errors.password.message}
                  </p>
                )}
                {/* Strength indicator */}
                {passwordValue.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className="flex-1 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            background:
                              strength.score >= level ? strength.color : '#E2E8F0',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-semibold" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="form-group">
                <label className="form-label" htmlFor="konfirmasi_password">
                  Konfirmasi Password Baru <span className="required-mark">*</span>
                </label>
                <div className="relative">
                  <input
                    id="konfirmasi_password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Ulangi password baru"
                    className={`form-input pr-10${errors.konfirmasi_password ? ' is-error' : ''}`}
                    {...register('konfirmasi_password')}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.konfirmasi_password && (
                  <p className="form-error">
                    <AlertCircle size={12} />
                    {errors.konfirmasi_password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    Simpan Password Baru
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link
              to="/masuk"
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          &copy; {new Date().getFullYear()} SiSPPD — BPPKAD Mamberamo Raya
        </p>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
