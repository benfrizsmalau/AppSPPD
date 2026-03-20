import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Users,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const features = [
  { icon: FileText, label: 'Penerbitan SPT & SPPD digital terintegrasi' },
  { icon: Users, label: 'Manajemen pegawai & jabatan terpusat' },
  { icon: BarChart3, label: 'Laporan & rekap perjalanan dinas otomatis' },
  { icon: CheckCircle2, label: 'Alur persetujuan & verifikasi berjenjang' },
];

const Login: React.FC = () => {
  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitError(null);
    const result = await signIn(data.email, data.password);
    if (result.error) {
      setSubmitError('Email atau password tidak sesuai');
      return;
    }
    // After sign-in, profile will be loaded by useAuth; check setup_completed
    // We navigate and let ProtectedRoute / App handle redirect
    // The profile may not be available immediately; navigate to / and let the app decide
    navigate('/');
  };

  // If user just logged in and profile is available, redirect based on setup_completed
  useEffect(() => {
    if (user && profile) {
      if (profile.tenant && !(profile.tenant as any).setup_completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  // Redirect if already logged in
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ 
          background: 'linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.7)), url("https://www.flickr.com/photo_download.gne?size=z&id=55157560124&secret=8c8ef61066")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Background glow effects */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="absolute"
            style={{
              top: '-10%',
              left: '-10%',
              width: '60%',
              height: '60%',
              background:
                'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: '-10%',
              right: '-10%',
              width: '60%',
              height: '60%',
              background:
                'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
        </div>

        {/* Top logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{
                width: 56,
                height: 56,
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
              }}
            >
              <ShieldCheck size={28} color="white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">SiSPPD</p>
              <p className="text-xs font-medium" style={{ color: '#CBD5E1' }}>
                v2.1 — Mamberamo Raya
              </p>
            </div>
          </div>

          <h1
            className="text-4xl font-bold leading-tight mb-4"
            style={{ color: '#F8FAFC' }}
          >
            Sistem Informasi<br />
            <span style={{ color: '#06B6D4' }}>SPT & SPPD</span><br />
            Terintegrasi
          </h1>
          <p className="text-base leading-relaxed mb-10" style={{ color: '#94A3B8' }}>
            Platform digital terpadu untuk pengelolaan Surat Perintah Tugas
            dan Surat Perintah Perjalanan Dinas di lingkungan Pemerintah Daerah.
          </p>

          <div className="space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <Icon size={16} color="white" />
                </div>
                <span className="text-sm font-medium" style={{ color: '#F1F5F9' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div
            className="border-t pt-6"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>
              Dikembangkan Oleh
            </p>
            <p className="text-sm font-bold" style={{ color: '#CBD5E1' }}>
              Bidang Pendapatan BPPKAD Mamberamo Raya
            </p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
              &copy; {new Date().getFullYear()} SiSPPD. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 44,
                height: 44,
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
              }}
            >
              <ShieldCheck size={22} color="white" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">SiSPPD</p>
              <p className="text-xs text-slate-500">BPPKAD Mamberamo Raya</p>
            </div>
          </div>

          <div className="card p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Selamat Datang</h2>
              <p className="text-sm text-slate-500">
                Masuk ke akun instansi Anda untuk melanjutkan.
              </p>
            </div>

            {submitError && (
              <div className="alert alert-danger mb-6">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-5">
                {/* Email */}
                <div className="form-group">
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

                {/* Password */}
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label className="form-label" htmlFor="password">
                      Kata Sandi <span className="required-mark">*</span>
                    </label>
                    <Link
                      to="/lupa-password"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      Lupa Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
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
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full py-3 text-base mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Masuk ke Sistem'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                <ShieldCheck size={13} />
                Secure Authentication
              </div>
              <p className="text-xs text-slate-400 text-center">
                Belum memiliki akun instansi?{' '}
                <Link
                  to="/daftar"
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Daftar Sekarang
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
