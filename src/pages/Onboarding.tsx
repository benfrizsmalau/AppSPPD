import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2, Hash, UserRound, CheckCircle2, ChevronRight, ChevronLeft,
  Upload, Plus, Trash2, AlertTriangle, Loader2, PartyPopper,
  Globe, Phone, MapPin, Mail, FileText, Eye, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Instansi, Penandatangan, SettingPenomoran } from '../types';
import { previewDocumentNumber } from '../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// STEP DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, icon: Building2, label: 'Profil Instansi', desc: 'Logo, alamat, dan kontak' },
  { id: 2, icon: UserRound, label: 'Penandatangan', desc: 'Pejabat berwenang' },
  { id: 3, icon: Hash, label: 'Penomoran', desc: 'Format nomor SPT & SPPD' },
  { id: 4, icon: CheckCircle2, label: 'Selesai', desc: 'Mulai gunakan SiSPPD' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const instansiSchema = z.object({
  alamat: z.string().min(5, 'Alamat minimal 5 karakter'),
  kabupaten_kota: z.string().min(3, 'Wajib diisi'),
  provinsi: z.string().min(3, 'Wajib diisi'),
  telepon: z.string().optional(),
  website: z.string().url('URL tidak valid').optional().or(z.literal('')),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
});

const penandatanganSchema = z.object({
  nama_lengkap: z.string().min(3, 'Nama minimal 3 karakter'),
  nip: z.string().length(18, 'NIP harus 18 digit').regex(/^\d+$/, 'NIP hanya angka'),
  jabatan: z.string().min(3, 'Jabatan minimal 3 karakter'),
  periode_mulai: z.string().min(1, 'Wajib diisi'),
  periode_selesai: z.string().min(1, 'Wajib diisi'),
  jenis_dokumen: z.array(z.string()).min(1, 'Pilih minimal 1 jenis dokumen'),
});

const penomoranSchema = z.object({
  spt_pattern: z.string().min(3, 'Format wajib diisi'),
  spt_digits: z.number().min(3).max(6),
  spt_kode_org: z.string().optional(),
  sppd_pattern: z.string().min(3, 'Format wajib diisi'),
  sppd_digits: z.number().min(3).max(6),
  sppd_kode_org: z.string().optional(),
  reset_annually: z.boolean(),
});

type InstansiForm = z.infer<typeof instansiSchema>;
type PenandatanganForm = z.infer<typeof penandatanganSchema>;
type PenomoranForm = z.infer<typeof penomoranSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PRESET PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
const PATTERN_PRESETS = [
  { label: '{num}/{jenis}/{org}/{month_roman}/{year}', example: '001/SPT/DINAS/I/2026' },
  { label: '{num}/{org}/{year}', example: '001/DINAS/2026' },
  { label: '{jenis}-{num}/{org}/{year}', example: 'SPT-001/DINAS/2026' },
];

// ─────────────────────────────────────────────────────────────────────────────
// VERTICAL STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col gap-0">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        return (
          <div key={step.id} className="flex flex-col">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-blue-50' : ''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'
              }`}>
                {done ? <CheckCircle2 size={16} /> : <step.icon size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${active ? 'text-blue-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>
                  {step.label}
                </p>
                <p className={`text-xs ${active ? 'text-blue-500' : 'text-slate-400'}`}>{step.desc}</p>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`ml-8 w-0.5 h-4 mx-auto transition-colors duration-300 ${done ? 'bg-emerald-300' : 'bg-slate-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step - 1) / (total - 1)) * 100);
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'linear-gradient(90deg, #2563EB, #06B6D4)' }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, tenantId, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [penandatanganList, setPenandatanganList] = useState<Partial<Penandatangan>[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);

  // Guard: redirect if setup already completed
  useEffect(() => {
    if (profile?.tenant?.setup_completed === true) {
      navigate('/', { replace: true });
    }
  }, [profile, navigate]);

  // Load existing instansi data
  const { data: instansi } = useQuery<Instansi | null>({
    queryKey: ['onboarding-instansi', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('instansi')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_primary', true)
        .maybeSingle();
      return data as Instansi | null;
    },
    enabled: !!tenantId,
  });

  // Load existing setting_penomoran
  const { data: existingPenomoran } = useQuery<SettingPenomoran[]>({
    queryKey: ['onboarding-penomoran', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('setting_penomoran')
        .select('*')
        .eq('tenant_id', tenantId);
      return (data || []) as SettingPenomoran[];
    },
    enabled: !!tenantId,
  });

  // ── Step 1 form ─────────────────────────────────────────────────────────────
  const instansiForm = useForm<InstansiForm>({
    resolver: zodResolver(instansiSchema),
    defaultValues: {
      alamat: instansi?.alamat || '',
      kabupaten_kota: instansi?.kabupaten_kota || '',
      provinsi: instansi?.provinsi || '',
      telepon: instansi?.telepon || '',
      website: instansi?.website || '',
      email: instansi?.email || '',
    },
  });

  // Re-populate form when instansi loads
  useEffect(() => {
    if (instansi) {
      instansiForm.reset({
        alamat: instansi.alamat || '',
        kabupaten_kota: instansi.kabupaten_kota || '',
        provinsi: instansi.provinsi || '',
        telepon: instansi.telepon || '',
        website: instansi.website || '',
        email: instansi.email || '',
      });
      if (instansi.logo_path) setLogoPreview(instansi.logo_path);
    }
  }, [instansi]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 3 form ─────────────────────────────────────────────────────────────
  const sptDefault = existingPenomoran?.find(p => p.jenis_dokumen === 'SPT');
  const sppdDefault = existingPenomoran?.find(p => p.jenis_dokumen === 'SPPD');

  const penomoranForm = useForm<PenomoranForm>({
    resolver: zodResolver(penomoranSchema),
    defaultValues: {
      spt_pattern: sptDefault?.format_pattern || '{num}/{jenis}/{org}/{month_roman}/{year}',
      spt_digits: sptDefault?.digit_count || 3,
      spt_kode_org: sptDefault?.kode_organisasi || '',
      sppd_pattern: sppdDefault?.format_pattern || '{num}/{jenis}/{org}/{month_roman}/{year}',
      sppd_digits: sppdDefault?.digit_count || 3,
      sppd_kode_org: sppdDefault?.kode_organisasi || '',
      reset_annually: sptDefault?.reset_annually ?? true,
    },
  });

  // Re-populate penomoran form when data loads
  useEffect(() => {
    if (existingPenomoran && existingPenomoran.length > 0) {
      const spt = existingPenomoran.find(p => p.jenis_dokumen === 'SPT');
      const sppd = existingPenomoran.find(p => p.jenis_dokumen === 'SPPD');
      penomoranForm.reset({
        spt_pattern: spt?.format_pattern || '{num}/{jenis}/{org}/{month_roman}/{year}',
        spt_digits: spt?.digit_count || 3,
        spt_kode_org: spt?.kode_organisasi || '',
        sppd_pattern: sppd?.format_pattern || '{num}/{jenis}/{org}/{month_roman}/{year}',
        sppd_digits: sppd?.digit_count || 3,
        sppd_kode_org: sppd?.kode_organisasi || '',
        reset_annually: spt?.reset_annually ?? true,
      });
    }
  }, [existingPenomoran]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save progress helper ─────────────────────────────────────────────────────
  const saveProgress = async (step: number) => {
    if (!tenantId) return;
    await supabase
      .from('tenants')
      .update({ setup_progress: { last_step: step } })
      .eq('id', tenantId);
  };

  // ── Step 1 submit ─────────────────────────────────────────────────────────────
  const submitInstansi = async (data: InstansiForm) => {
    if (!tenantId || !instansi) { toast.error('Data instansi tidak ditemukan'); return; }
    try {
      let logo_path = instansi.logo_path;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logos/${tenantId}/logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('instansi-assets')
          .upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('instansi-assets').getPublicUrl(path);
        logo_path = urlData.publicUrl;
      }
      const { error } = await supabase.from('instansi').update({
        alamat: data.alamat,
        kabupaten_kota: data.kabupaten_kota,
        provinsi: data.provinsi,
        telepon: data.telepon || null,
        website: data.website || null,
        email: data.email || null,
        logo_path: logo_path || null,
        updated_at: new Date().toISOString(),
      }).eq('id', instansi.id);
      if (error) throw error;
      await saveProgress(2);
      queryClient.invalidateQueries({ queryKey: ['onboarding-instansi'] });
      toast.success('Profil instansi disimpan');
      setCurrentStep(2);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan profil instansi');
    }
  };

  // ── Step 2 submit ─────────────────────────────────────────────────────────────
  const proceedFromStep2 = async (skip = false) => {
    if (!skip && penandatanganList.length === 0) {
      toast.warning('Tambahkan minimal 1 penandatangan, atau pilih lewati');
      return;
    }
    if (!tenantId) return;
    if (penandatanganList.length > 0) {
      const rows = penandatanganList.map(p => ({
        tenant_id: tenantId,
        nama_lengkap: p.nama_lengkap!,
        nip: p.nip!,
        jabatan: p.jabatan!,
        periode_mulai: p.periode_mulai || null,
        periode_selesai: p.periode_selesai || null,
        jenis_dokumen: p.jenis_dokumen || [],
        status_aktif: true,
      }));
      const { error } = await supabase.from('penandatangan').insert(rows);
      if (error) { toast.error('Gagal menyimpan penandatangan: ' + error.message); return; }
      toast.success(`${rows.length} penandatangan berhasil disimpan`);
    }
    await saveProgress(3);
    setCurrentStep(3);
  };

  // ── Step 3 submit ─────────────────────────────────────────────────────────────
  const submitPenomoran = async (data: PenomoranForm) => {
    if (!tenantId) return;
    try {
      const upsertRows = [
        {
          tenant_id: tenantId,
          jenis_dokumen: 'SPT' as const,
          format_pattern: data.spt_pattern,
          digit_count: data.spt_digits,
          separator: '/',
          counter_current: 0,
          counter_year: new Date().getFullYear(),
          reset_annually: data.reset_annually,
          kode_organisasi: data.spt_kode_org || null,
        },
        {
          tenant_id: tenantId,
          jenis_dokumen: 'SPPD' as const,
          format_pattern: data.sppd_pattern,
          digit_count: data.sppd_digits,
          separator: '/',
          counter_current: 0,
          counter_year: new Date().getFullYear(),
          reset_annually: data.reset_annually,
          kode_organisasi: data.sppd_kode_org || null,
        },
      ];

      // Upsert: if rows exist update them, else insert
      for (const row of upsertRows) {
        const existing = existingPenomoran?.find(p => p.jenis_dokumen === row.jenis_dokumen);
        if (existing) {
          await supabase.from('setting_penomoran').update({
            format_pattern: row.format_pattern,
            digit_count: row.digit_count,
            reset_annually: row.reset_annually,
            kode_organisasi: row.kode_organisasi,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await supabase.from('setting_penomoran').insert(row);
        }
      }
      await saveProgress(4);
      queryClient.invalidateQueries({ queryKey: ['onboarding-penomoran'] });
      toast.success('Konfigurasi penomoran disimpan');
      setCurrentStep(4);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan penomoran');
    }
  };

  // ── Finish ────────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!tenantId) return;
    setIsFinishing(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ setup_completed: true, setup_progress: { last_step: 4, completed_at: new Date().toISOString() } })
        .eq('id', tenantId);
      if (error) throw error;
      await refreshProfile();
      toast.success('Selamat datang di SiSPPD! 🎉');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyelesaikan setup');
    } finally {
      setIsFinishing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Sparkles size={14} />
            Setup Awal SiSPPD
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Selamat Datang, {profile?.nama_lengkap?.split(' ')[0]}!
          </h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Selesaikan beberapa langkah pengaturan awal untuk mulai menggunakan SiSPPD
          </p>
          <div className="max-w-md mx-auto mt-4">
            <ProgressBar step={currentStep} total={STEPS.length} />
            <p className="text-xs text-slate-400 mt-1.5 text-right">
              Langkah {currentStep} dari {STEPS.length}
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-[240px_1fr] gap-6 items-start">
          {/* Left: Step indicator */}
          <div className="card p-4 sticky top-6">
            <StepIndicator currentStep={currentStep} />
          </div>

          {/* Right: Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {currentStep === 1 && (
                <Step1InstansiForm
                  form={instansiForm}
                  onSubmit={submitInstansi}
                  logoPreview={logoPreview}
                  onLogoChange={(file, preview) => { setLogoFile(file); setLogoPreview(preview); }}
                  instansi={instansi}
                />
              )}
              {currentStep === 2 && (
                <Step2Penandatangan
                  list={penandatanganList}
                  onAdd={(p) => setPenandatanganList(prev => [...prev, p])}
                  onRemove={(i) => setPenandatanganList(prev => prev.filter((_, idx) => idx !== i))}
                  onBack={() => setCurrentStep(1)}
                  onNext={() => proceedFromStep2(false)}
                  onSkip={() => proceedFromStep2(true)}
                />
              )}
              {currentStep === 3 && (
                <Step3Penomoran
                  form={penomoranForm}
                  onSubmit={submitPenomoran}
                  onBack={() => setCurrentStep(2)}
                />
              )}
              {currentStep === 4 && (
                <Step4Finish
                  instansi={instansi}
                  penandatanganCount={penandatanganList.length}
                  onFinish={handleFinish}
                  isFinishing={isFinishing}
                  onBack={() => setCurrentStep(3)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: PROFIL INSTANSI
// ─────────────────────────────────────────────────────────────────────────────
interface Step1Props {
  form: ReturnType<typeof useForm<InstansiForm>>;
  onSubmit: (data: InstansiForm) => Promise<void>;
  logoPreview: string | null;
  onLogoChange: (file: File, preview: string) => void;
  instansi: Instansi | null | undefined;
}

function Step1InstansiForm({ form, onSubmit, logoPreview, onLogoChange, instansi }: Step1Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran logo maksimal 2 MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => onLogoChange(file, ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="font-bold text-slate-900">Profil Instansi</h2>
          <p className="text-xs text-slate-500 mt-0.5">Lengkapi informasi instansi Anda</p>
        </div>
        {instansi && (
          <span className="badge badge-blue text-xs">{instansi.nama_singkat}</span>
        )}
      </div>
      <form className="card-body space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {/* Logo upload */}
        <div className="flex items-center gap-5">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-400 transition-colors group flex-shrink-0 bg-slate-50"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-blue-500">
                <Upload size={20} />
                <span className="text-[10px] font-medium">Logo</span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Logo Instansi</p>
            <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG — maks. 2 MB</p>
            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => fileInputRef.current?.click()}>
              <Upload size={12} /> Unggah Logo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 form-group">
            <label className="form-label flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-400" /> Alamat Lengkap <span className="required-mark">*</span>
            </label>
            <textarea
              className={`form-textarea ${errors.alamat ? 'is-error' : ''}`}
              placeholder="Jl. Contoh No. 1, Kelurahan, Kecamatan"
              {...register('alamat')}
            />
            {errors.alamat && <p className="form-error">{errors.alamat.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Kabupaten/Kota <span className="required-mark">*</span></label>
            <input className={`form-input ${errors.kabupaten_kota ? 'is-error' : ''}`} placeholder="Kabupaten Contoh" {...register('kabupaten_kota')} />
            {errors.kabupaten_kota && <p className="form-error">{errors.kabupaten_kota.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Provinsi <span className="required-mark">*</span></label>
            <input className={`form-input ${errors.provinsi ? 'is-error' : ''}`} placeholder="Provinsi Contoh" {...register('provinsi')} />
            {errors.provinsi && <p className="form-error">{errors.provinsi.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> Telepon</label>
            <input className="form-input" placeholder="(021) 1234567" {...register('telepon')} />
          </div>

          <div className="form-group">
            <label className="form-label flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> Email Instansi</label>
            <input className={`form-input ${errors.email ? 'is-error' : ''}`} type="email" placeholder="email@instansi.go.id" {...register('email')} />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>

          <div className="col-span-2 form-group">
            <label className="form-label flex items-center gap-1.5"><Globe size={13} className="text-slate-400" /> Website</label>
            <input className={`form-input ${errors.website ? 'is-error' : ''}`} placeholder="https://instansi.go.id" {...register('website')} />
            {errors.website && <p className="form-error">{errors.website.message}</p>}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : <>Simpan & Lanjut <ChevronRight size={16} /></>}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: PENANDATANGAN
// ─────────────────────────────────────────────────────────────────────────────
interface Step2Props {
  list: Partial<Penandatangan>[];
  onAdd: (p: Partial<Penandatangan>) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

function Step2Penandatangan({ list, onAdd, onRemove, onBack, onNext, onSkip }: Step2Props) {
  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm<PenandatanganForm>({
    resolver: zodResolver(penandatanganSchema),
    defaultValues: { jenis_dokumen: ['SPT', 'SPPD'] },
  });
  const watchJenis = watch('jenis_dokumen') || [];

  const addPenandatangan = (data: PenandatanganForm) => {
    onAdd({
      nama_lengkap: data.nama_lengkap,
      nip: data.nip,
      jabatan: data.jabatan,
      periode_mulai: data.periode_mulai,
      periode_selesai: data.periode_selesai,
      jenis_dokumen: data.jenis_dokumen,
      status_aktif: true,
    });
    reset({ jenis_dokumen: ['SPT', 'SPPD'] });
    toast.success('Penandatangan ditambahkan');
  };

  const toggleJenis = (val: string) => {
    if (watchJenis.includes(val)) {
      setValue('jenis_dokumen', watchJenis.filter(j => j !== val));
    } else {
      setValue('jenis_dokumen', [...watchJenis, val]);
    }
  };

  return (
    <div className="space-y-4">
      {list.length === 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Tambah minimal 1 penandatangan</p>
            <p className="text-xs mt-0.5">Penandatangan dibutuhkan untuk membuat SPT dan SPPD. Anda dapat melengkapi ini nanti.</p>
          </div>
        </div>
      )}

      {/* Form tambah */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-slate-900">Tambah Penandatangan</h2>
        </div>
        <form className="card-body space-y-4" onSubmit={handleSubmit(addPenandatangan)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 form-group">
              <label className="form-label">Nama Lengkap <span className="required-mark">*</span></label>
              <input className={`form-input ${errors.nama_lengkap ? 'is-error' : ''}`} placeholder="Drs. Nama Pejabat, M.Si." {...register('nama_lengkap')} />
              {errors.nama_lengkap && <p className="form-error">{errors.nama_lengkap.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">NIP <span className="required-mark">*</span></label>
              <input className={`form-input font-mono text-xs ${errors.nip ? 'is-error' : ''}`} placeholder="196501011990031001" maxLength={18} {...register('nip')} />
              {errors.nip && <p className="form-error">{errors.nip.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Jabatan <span className="required-mark">*</span></label>
              <input className={`form-input ${errors.jabatan ? 'is-error' : ''}`} placeholder="Kepala Dinas" {...register('jabatan')} />
              {errors.jabatan && <p className="form-error">{errors.jabatan.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Periode Mulai <span className="required-mark">*</span></label>
              <input type="date" className={`form-input ${errors.periode_mulai ? 'is-error' : ''}`} {...register('periode_mulai')} />
              {errors.periode_mulai && <p className="form-error">{errors.periode_mulai.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Periode Selesai <span className="required-mark">*</span></label>
              <input type="date" className={`form-input ${errors.periode_selesai ? 'is-error' : ''}`} {...register('periode_selesai')} />
              {errors.periode_selesai && <p className="form-error">{errors.periode_selesai.message}</p>}
            </div>

            <div className="col-span-2 form-group">
              <label className="form-label">Jenis Dokumen <span className="required-mark">*</span></label>
              <div className="flex gap-3">
                {['SPT', 'SPPD'].map(jenis => (
                  <button
                    key={jenis}
                    type="button"
                    onClick={() => toggleJenis(jenis)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      watchJenis.includes(jenis)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileText size={14} /> {jenis}
                  </button>
                ))}
              </div>
              {errors.jenis_dokumen && <p className="form-error">{errors.jenis_dokumen.message as string}</p>}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary btn-sm">
              <Plus size={14} /> Tambahkan
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800">Daftar Penandatangan ({list.length})</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {list.map((p, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <UserRound size={16} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{p.nama_lengkap}</p>
                    <p className="text-xs text-slate-500">{p.jabatan} — NIP {p.nip}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.jenis_dokumen?.map(j => (
                    <span key={j} className="badge badge-blue text-[10px]">{j}</span>
                  ))}
                  <button type="button" onClick={() => onRemove(i)} className="btn btn-ghost btn-icon-sm text-rose-400 hover:text-rose-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <div className="flex gap-2">
          {list.length === 0 && (
            <button type="button" className="btn btn-secondary" onClick={onSkip}>
              Lewati dulu
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onNext} disabled={list.length === 0}>
            Simpan & Lanjut <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: PENOMORAN
// ─────────────────────────────────────────────────────────────────────────────
interface Step3Props {
  form: ReturnType<typeof useForm<PenomoranForm>>;
  onSubmit: (data: PenomoranForm) => Promise<void>;
  onBack: () => void;
}

function Step3Penomoran({ form, onSubmit, onBack }: Step3Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;
  const watched = watch();

  const sptPreview = previewDocumentNumber(watched.spt_pattern || '', {
    counter: 1,
    digitCount: watched.spt_digits || 3,
    kodeOrg: watched.spt_kode_org,
    jenis: 'SPT',
  });
  const sppdPreview = previewDocumentNumber(watched.sppd_pattern || '', {
    counter: 1,
    digitCount: watched.sppd_digits || 3,
    kodeOrg: watched.sppd_kode_org,
    jenis: 'SPPD',
  });

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="font-bold text-slate-900">Konfigurasi Penomoran Dokumen</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tentukan format nomor untuk SPT dan SPPD</p>
        </div>
      </div>
      <form className="card-body space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {/* Pattern tokens info */}
        <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-800 space-y-1">
          <p className="font-semibold mb-2">Token yang tersedia:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
            <span><strong>{'{num}'}</strong> — nomor urut</span>
            <span><strong>{'{year}'}</strong> — tahun (2026)</span>
            <span><strong>{'{month_roman}'}</strong> — bulan romawi</span>
            <span><strong>{'{month}'}</strong> — bulan (01-12)</span>
            <span><strong>{'{org}'}</strong> — kode organisasi</span>
            <span><strong>{'{jenis}'}</strong> — SPT / SPPD</span>
          </div>
        </div>

        {/* Preset selector */}
        <div className="form-group">
          <label className="form-label">Pilih Template Cepat</label>
          <div className="grid grid-cols-1 gap-2">
            {PATTERN_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setValue('spt_pattern', p.label);
                  setValue('sppd_pattern', p.label);
                }}
                className={`text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                  watched.spt_pattern === p.label
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="font-mono font-semibold">{p.label}</span>
                <span className="text-xs text-slate-400 ml-3">→ {p.example}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SPT */}
        <div className="space-y-3 border border-slate-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-green">SPT</span>
            <span className="text-sm font-semibold text-slate-700">Surat Perintah Tugas</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 form-group">
              <label className="form-label">Format Pattern <span className="required-mark">*</span></label>
              <input className={`form-input font-mono text-xs ${errors.spt_pattern ? 'is-error' : ''}`} {...register('spt_pattern')} />
              {errors.spt_pattern && <p className="form-error">{errors.spt_pattern.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Digit Nomor</label>
              <select className="form-select" value={watched.spt_digits} onChange={e => setValue('spt_digits', Number(e.target.value))}>
                <option value={3}>3 digit (001)</option>
                <option value={4}>4 digit (0001)</option>
                <option value={5}>5 digit (00001)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kode Organisasi</label>
              <input className="form-input" placeholder="DINAS" {...register('spt_kode_org')} />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <Eye size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500">Contoh:</span>
            <span className="font-mono text-sm text-slate-800 font-semibold">{sptPreview || '–'}</span>
          </div>
        </div>

        {/* SPPD */}
        <div className="space-y-3 border border-slate-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-blue">SPPD</span>
            <span className="text-sm font-semibold text-slate-700">Surat Perintah Perjalanan Dinas</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 form-group">
              <label className="form-label">Format Pattern <span className="required-mark">*</span></label>
              <input className={`form-input font-mono text-xs ${errors.sppd_pattern ? 'is-error' : ''}`} {...register('sppd_pattern')} />
              {errors.sppd_pattern && <p className="form-error">{errors.sppd_pattern.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Digit Nomor</label>
              <select className="form-select" value={watched.sppd_digits} onChange={e => setValue('sppd_digits', Number(e.target.value))}>
                <option value={3}>3 digit (001)</option>
                <option value={4}>4 digit (0001)</option>
                <option value={5}>5 digit (00001)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kode Organisasi</label>
              <input className="form-input" placeholder="DINAS" {...register('sppd_kode_org')} />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <Eye size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500">Contoh:</span>
            <span className="font-mono text-sm text-slate-800 font-semibold">{sppdPreview || '–'}</span>
          </div>
        </div>

        {/* Reset annually */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-semibold text-slate-700">Reset Nomor Tahunan</p>
            <p className="text-xs text-slate-400">Nomor urut kembali ke 001 setiap awal tahun</p>
          </div>
          <Controller
            name="reset_annually"
            control={form.control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${field.value ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${field.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            )}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ChevronLeft size={16} /> Kembali
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : <>Simpan & Lanjut <ChevronRight size={16} /></>}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: FINISH
// ─────────────────────────────────────────────────────────────────────────────
interface Step4Props {
  instansi: Instansi | null | undefined;
  penandatanganCount: number;
  onFinish: () => void;
  isFinishing: boolean;
  onBack: () => void;
}

function Step4Finish({ instansi, penandatanganCount, onFinish, isFinishing, onBack }: Step4Props) {
  const items = [
    { label: 'Profil Instansi', value: instansi?.nama_singkat || 'Terkonfigurasi', done: true },
    { label: 'Penandatangan', value: penandatanganCount > 0 ? `${penandatanganCount} pejabat` : 'Dilewati', done: penandatanganCount > 0 },
    { label: 'Penomoran Dokumen', value: 'SPT & SPPD', done: true },
  ];

  return (
    <div className="card text-center">
      <div className="card-body py-10 space-y-6">
        {/* Celebration animation */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-blue-200"
        >
          <PartyPopper size={44} className="text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Setup Selesai!</h2>
          <p className="text-slate-500 max-w-sm mx-auto text-sm leading-relaxed">
            Sistem SiSPPD Anda siap digunakan. Berikut ringkasan konfigurasi yang telah dilakukan:
          </p>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-slate-50 rounded-2xl p-5 text-left space-y-3 max-w-sm mx-auto"
        >
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <CheckCircle2 size={12} className={item.done ? 'text-emerald-600' : 'text-slate-300'} />
                </div>
                <span className="text-sm text-slate-600">{item.label}</span>
              </div>
              <span className={`text-xs font-semibold ${item.done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {item.value}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-3 pt-2"
        >
          <button
            className="btn btn-primary btn-lg w-full max-w-xs"
            onClick={onFinish}
            disabled={isFinishing}
          >
            {isFinishing
              ? <><Loader2 size={16} className="animate-spin" /> Memulai...</>
              : <><Sparkles size={16} /> Mulai Gunakan SiSPPD</>
            }
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            <ChevronLeft size={14} /> Kembali ke Penomoran
          </button>
        </motion.div>
      </div>
    </div>
  );
}
