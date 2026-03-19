import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, RotateCcw, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const RESEND_COOLDOWN = 60;

const RegisterSukses: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email: string = (location.state as any)?.email || '';

  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // If arrived without email state, redirect to /daftar
  useEffect(() => {
    if (!email) {
      navigate('/daftar', { replace: true });
    }
  }, [email, navigate]);

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        toast.error('Gagal mengirim ulang email: ' + error.message);
      } else {
        toast.success('Email verifikasi telah dikirim ulang.');
        setCooldown(RESEND_COOLDOWN);
      }
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setResending(false);
    }
  };

  const handleOpenEmail = () => {
    const domain = email.split('@')[1] || '';
    const webmailMap: Record<string, string> = {
      'gmail.com': 'https://mail.google.com',
      'yahoo.com': 'https://mail.yahoo.com',
      'outlook.com': 'https://outlook.live.com',
      'hotmail.com': 'https://outlook.live.com',
    };
    const url = webmailMap[domain] || `https://mail.${domain}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!email) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md text-center">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
          className="flex items-center justify-center mb-6"
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 96,
              height: 96,
              background: 'linear-gradient(135deg, #10B981, #059669)',
              boxShadow: '0 12px 32px rgba(16,185,129,0.35)',
            }}
          >
            <CheckCircle2 size={48} color="white" strokeWidth={2} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="card p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Pendaftaran Berhasil!
            </h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Kami telah mengirim email verifikasi ke{' '}
              <span className="font-semibold text-slate-700">{email}</span>.
            </p>

            <div className="alert alert-info mb-6 text-left">
              <Mail size={16} className="flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed space-y-1">
                <p className="font-semibold">Langkah selanjutnya:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                  <li>Buka kotak masuk email Anda</li>
                  <li>Cari email dari <strong>SiSPPD</strong></li>
                  <li>Klik tautan verifikasi di dalam email</li>
                  <li>Setelah terverifikasi, Anda dapat masuk ke sistem</li>
                </ol>
                <p className="text-slate-500 mt-2">
                  Tidak menemukan email? Cek folder <em>Spam</em> atau <em>Promosi</em>.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenEmail}
                className="btn btn-primary w-full"
              >
                <Mail size={16} />
                Buka Email
              </button>

              <button
                onClick={handleResend}
                className="btn btn-secondary w-full"
                disabled={cooldown > 0 || resending}
              >
                {resending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Mengirim...
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <RotateCcw size={16} />
                    Kirim Ulang ({cooldown}s)
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Kirim Ulang Email
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft size={14} />
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </motion.div>

        <p className="text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} SiSPPD — BPPKAD Mamberamo Raya
        </p>
      </div>
    </div>
  );
};

export default RegisterSukses;
