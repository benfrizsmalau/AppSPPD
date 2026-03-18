import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Building2,
  User,
  FileCheck,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    // Section 1 – Data Instansi
    nama_instansi: z.string().min(1, 'Nama instansi wajib diisi'),
    nama_singkat: z
      .string()
      .min(1, 'Nama singkat wajib diisi')
      .max(10, 'Maksimal 10 karakter')
      .regex(/^[a-z0-9-]+$/, 'Hanya huruf kecil, angka, dan tanda hubung'),
    kabupaten_kota: z.string().min(1, 'Kabupaten/Kota wajib diisi'),
    provinsi: z.string().min(1, 'Provinsi wajib diisi'),
    alamat: z.string().optional(),

    // Section 2 – Data Admin
    nama_lengkap: z.string().min(1, 'Nama lengkap wajib diisi'),
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    konfirmasi_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
    telepon: z.string().optional(),
    referral_code: z.string().optional(),

    // Section 3 – Terms
    setuju: z.literal(true, 'Anda harus menyetujui syarat & ketentuan'),
  })
  .refine((d) => d.password === d.konfirmasi_password, {
    message: 'Password tidak cocok',
    path: ['konfirmasi_password'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

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

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Data Instansi', icon: Building2 },
  { label: 'Data Admin', icon: User },
  { label: 'Konfirmasi', icon: FileCheck },
];

// ─── Component ───────────────────────────────────────────────────────────────

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const passwordValue = watch('password', '');
  const namaSingkatValue = watch('nama_singkat', '');
  const strength = getPasswordStrength(passwordValue);

  // Debounced slug availability check
  useEffect(() => {
    if (!namaSingkatValue || namaSingkatValue.length < 2) {
      setSlugStatus('idle');
      return;
    }
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    setSlugStatus('checking');
    slugDebounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('nama_singkat', namaSingkatValue)
        .maybeSingle();
      if (error) {
        setSlugStatus('idle');
        return;
      }
      setSlugStatus(data ? 'taken' : 'available');
    }, 500);
    return () => {
      if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    };
  }, [namaSingkatValue]);

  const goNext = async () => {
    let fieldsToValidate: (keyof RegisterFormValues)[] = [];
    if (step === 0) {
      fieldsToValidate = ['nama_instansi', 'nama_singkat', 'kabupaten_kota', 'provinsi'];
    } else if (step === 1) {
      fieldsToValidate = ['nama_lengkap', 'email', 'password', 'konfirmasi_password'];
    }
    const valid = await trigger(fieldsToValidate);
    if (!valid) return;
    if (step === 0 && slugStatus === 'taken') return;
    setStep((s) => s + 1);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setSubmitError(null);
    try {
      // 1. Insert tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          nama_instansi: data.nama_instansi,
          nama_singkat: data.nama_singkat,
          kabupaten_kota: data.kabupaten_kota,
          provinsi: data.provinsi,
          alamat: data.alamat || null,
          setup_completed: false,
        })
        .select('id')
        .single();

      if (tenantError) throw new Error(tenantError.message);

      // 2. Sign up user
      const { error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            nama_lengkap: data.nama_lengkap,
            telepon: data.telepon || null,
            referral_code: data.referral_code || null,
            tenant_id: tenantData.id,
            role: 'Admin',
          },
        },
      });

      if (authError) {
        // Rollback tenant if possible (best effort)
        await supabase.from('tenants').delete().eq('id', tenantData.id);
        throw new Error(authError.message);
      }

      navigate('/daftar/sukses', {
        state: { email: data.email },
        replace: true,
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <Link to="/masuk" className="inline-flex items-center gap-2 mb-6">
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
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Daftar Instansi Baru</h1>
        <p className="text-sm text-slate-500">
          Sudah punya akun?{' '}
          <Link to="/masuk" className="font-semibold text-blue-600 hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>

      {/* Stepper */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <React.Fragment key={s.label}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex items-center justify-center rounded-full transition-all duration-300"
                    style={{
                      width: 40,
                      height: 40,
                      background: isDone
                        ? '#10B981'
                        : isActive
                        ? '#2563EB'
                        : '#E2E8F0',
                      color: isDone || isActive ? 'white' : '#94A3B8',
                    }}
                  >
                    {isDone ? <CheckCircle2 size={20} /> : <Icon size={18} />}
                  </div>
                  <span
                    className="text-xs font-semibold hidden sm:block"
                    style={{
                      color: isDone ? '#10B981' : isActive ? '#2563EB' : '#94A3B8',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-2 transition-all duration-300"
                    style={{ background: i < step ? '#10B981' : '#E2E8F0' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Card */}
      <div className="card w-full max-w-2xl p-8">
        {submitError && (
          <div className="alert alert-danger mb-6">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AnimatePresence mode="wait">
            {/* ── Step 0: Data Instansi ── */}
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <Building2 size={20} className="text-blue-600" />
                  Data Instansi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 form-group">
                    <label className="form-label" htmlFor="nama_instansi">
                      Nama Instansi <span className="required-mark">*</span>
                    </label>
                    <input
                      id="nama_instansi"
                      type="text"
                      placeholder="Dinas Keuangan Kabupaten ..."
                      className={`form-input${errors.nama_instansi ? ' is-error' : ''}`}
                      {...register('nama_instansi')}
                    />
                    {errors.nama_instansi && (
                      <p className="form-error"><AlertCircle size={12} />{errors.nama_instansi.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="nama_singkat">
                      Nama Singkat <span className="required-mark">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="nama_singkat"
                        type="text"
                        placeholder="dinkeu-jpr"
                        className={`form-input pr-8${errors.nama_singkat ? ' is-error' : ''}`}
                        {...register('nama_singkat')}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugStatus === 'checking' && <Loader2 size={14} className="animate-spin text-slate-400" />}
                        {slugStatus === 'available' && <CheckCircle2 size={14} className="text-emerald-500" />}
                        {slugStatus === 'taken' && <XCircle size={14} className="text-rose-500" />}
                      </span>
                    </div>
                    {errors.nama_singkat && (
                      <p className="form-error"><AlertCircle size={12} />{errors.nama_singkat.message}</p>
                    )}
                    {!errors.nama_singkat && slugStatus === 'available' && (
                      <p className="form-hint text-emerald-600">Nama singkat tersedia</p>
                    )}
                    {!errors.nama_singkat && slugStatus === 'taken' && (
                      <p className="form-error"><XCircle size={12} />Nama singkat sudah digunakan</p>
                    )}
                    {!errors.nama_singkat && slugStatus === 'idle' && (
                      <p className="form-hint">Huruf kecil, angka, tanda hubung. Maks 10 karakter.</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="kabupaten_kota">
                      Kabupaten / Kota <span className="required-mark">*</span>
                    </label>
                    <input
                      id="kabupaten_kota"
                      type="text"
                      placeholder="Kab. Jayapura"
                      className={`form-input${errors.kabupaten_kota ? ' is-error' : ''}`}
                      {...register('kabupaten_kota')}
                    />
                    {errors.kabupaten_kota && (
                      <p className="form-error"><AlertCircle size={12} />{errors.kabupaten_kota.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="provinsi">
                      Provinsi <span className="required-mark">*</span>
                    </label>
                    <input
                      id="provinsi"
                      type="text"
                      placeholder="Papua"
                      className={`form-input${errors.provinsi ? ' is-error' : ''}`}
                      {...register('provinsi')}
                    />
                    {errors.provinsi && (
                      <p className="form-error"><AlertCircle size={12} />{errors.provinsi.message}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2 form-group">
                    <label className="form-label" htmlFor="alamat">Alamat</label>
                    <textarea
                      id="alamat"
                      placeholder="Jl. Raya No. 1, ..."
                      className="form-textarea"
                      rows={2}
                      {...register('alamat')}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Data Admin ── */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <User size={20} className="text-blue-600" />
                  Data Administrator
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 form-group">
                    <label className="form-label" htmlFor="nama_lengkap">
                      Nama Lengkap <span className="required-mark">*</span>
                    </label>
                    <input
                      id="nama_lengkap"
                      type="text"
                      placeholder="Nama sesuai KTP"
                      className={`form-input${errors.nama_lengkap ? ' is-error' : ''}`}
                      {...register('nama_lengkap')}
                    />
                    {errors.nama_lengkap && (
                      <p className="form-error"><AlertCircle size={12} />{errors.nama_lengkap.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="email">
                      Email <span className="required-mark">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@instansi.go.id"
                      className={`form-input${errors.email ? ' is-error' : ''}`}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="form-error"><AlertCircle size={12} />{errors.email.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="telepon">Nomor Telepon</label>
                    <input
                      id="telepon"
                      type="tel"
                      placeholder="08xxxxxxxxxx"
                      className="form-input"
                      {...register('telepon')}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="password">
                      Password <span className="required-mark">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min. 8 karakter"
                        className={`form-input pr-10${errors.password ? ' is-error' : ''}`}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="form-error"><AlertCircle size={12} />{errors.password.message}</p>
                    )}
                    {/* Strength bar */}
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

                  <div className="form-group">
                    <label className="form-label" htmlFor="konfirmasi_password">
                      Konfirmasi Password <span className="required-mark">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="konfirmasi_password"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Ulangi password"
                        className={`form-input pr-10${errors.konfirmasi_password ? ' is-error' : ''}`}
                        {...register('konfirmasi_password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                        aria-label={showConfirm ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.konfirmasi_password && (
                      <p className="form-error"><AlertCircle size={12} />{errors.konfirmasi_password.message}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2 form-group">
                    <label className="form-label" htmlFor="referral_code">Kode Referral (opsional)</label>
                    <input
                      id="referral_code"
                      type="text"
                      placeholder="Masukkan kode referral jika ada"
                      className="form-input"
                      {...register('referral_code')}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Konfirmasi & Terms ── */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <FileCheck size={20} className="text-blue-600" />
                  Konfirmasi & Persetujuan
                </h3>

                <div className="alert alert-info mb-6">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    Pastikan data yang Anda masukkan sudah benar sebelum menyelesaikan pendaftaran.
                    Email verifikasi akan dikirimkan ke alamat yang Anda daftarkan.
                  </div>
                </div>

                <div className="form-group">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      {...register('setuju')}
                    />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      Saya menyetujui{' '}
                      <a
                        href="#"
                        className="font-semibold text-blue-600 hover:underline"
                        onClick={(e) => e.preventDefault()}
                      >
                        Syarat & Ketentuan
                      </a>{' '}
                      dan{' '}
                      <a
                        href="#"
                        className="font-semibold text-blue-600 hover:underline"
                        onClick={(e) => e.preventDefault()}
                      >
                        Kebijakan Privasi
                      </a>{' '}
                      SiSPPD, serta menjamin kebenaran data instansi yang didaftarkan.
                    </span>
                  </label>
                  {errors.setuju && (
                    <p className="form-error mt-1"><AlertCircle size={12} />{errors.setuju.message}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            {step > 0 ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep((s) => s - 1)}
                disabled={isSubmitting}
              >
                <ChevronLeft size={16} />
                Sebelumnya
              </button>
            ) : (
              <Link to="/masuk" className="btn btn-ghost text-slate-500">
                Batalkan
              </Link>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={goNext}
              >
                Selanjutnya
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Mendaftarkan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Selesaikan Pendaftaran
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      <p className="text-xs text-slate-400 mt-6">
        &copy; {new Date().getFullYear()} SiSPPD — Pemerintah Daerah Papua
      </p>
    </div>
  );
};

export default Register;
