import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Mail,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const schema = z.object({
  email: z.string().email('Format email tidak valid'),
});

type FormValues = z.infer<typeof schema>;

const COOLDOWN = 60;

const ForgotPassword: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmit = async (data: FormValues) => {
    // Always show success regardless of whether email exists (prevents enumeration)
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: window.location.origin + '/atur-ulang-password',
    });
    setSubmittedEmail(data.email);
    setSubmitted(true);
    setCooldown(COOLDOWN);
  };

  const handleRetry = () => {
    setSubmitted(false);
    setCooldown(0);
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
          {!submitted ? (
            <>
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
                  <Mail size={24} color="#2563EB" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 text-center mb-1">
                  Lupa Password?
                </h1>
                <p className="text-sm text-slate-500 text-center leading-relaxed">
                  Masukkan alamat email yang terdaftar. Kami akan mengirimkan tautan
                  untuk mengatur ulang password Anda.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="form-group mb-5">
                  <label className="form-label" htmlFor="email">
                    Alamat Email <span className="required-mark">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@instansi.go.id"
                    className={`form-input${errors.email ? ' is-error' : ''}`}
                    {...register('email')}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="form-error">
                      <AlertCircle size={12} />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting || cooldown > 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Mengirim...
                    </>
                  ) : cooldown > 0 ? (
                    `Kirim Ulang (${cooldown}s)`
                  ) : (
                    <>
                      <Mail size={16} />
                      Kirim Instruksi Reset
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div
                className="flex items-center justify-center rounded-full mx-auto mb-4"
                style={{
                  width: 64,
                  height: 64,
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                }}
              >
                <CheckCircle2 size={32} color="white" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Email Terkirim</h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Jika email{' '}
                <span className="font-semibold text-slate-800">{submittedEmail}</span>{' '}
                terdaftar, kami telah mengirim instruksi untuk mengatur ulang password Anda.
                Silakan cek kotak masuk dan folder <em>Spam</em>.
              </p>

              {cooldown > 0 ? (
                <p className="text-xs text-slate-400 mb-4">
                  Tidak menerima email? Kirim ulang dalam{' '}
                  <span className="font-bold text-slate-600">{cooldown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleRetry}
                  className="btn btn-secondary w-full mb-4"
                >
                  Coba Lagi
                </button>
              )}
            </motion.div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link
              to="/masuk"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          &copy; {new Date().getFullYear()} SiSPPD — Pemerintah Daerah Papua
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
