import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addDays, format, parseISO, isAfter } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import {
  ArrowLeft, Save, FileCheck, Plus, Trash2, GripVertical, Info,
  AlertTriangle, Loader2, User, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type {
  SPPD, SPPDPengikut, Pegawai, Penandatangan,
  MataAnggaran, Instansi, RefTingkatPerjalanan, RefAlatAngkut, SPT, DocumentStatus,
} from '../types';

// ── Zod Schema ───────────────────────────────────────────────────────────────
const pengikutSchema = z.object({
  tipe: z.enum(['pegawai', 'manual']),
  pegawai_id: z.number().optional().nullable(),
  nama: z.string().optional(),
  umur: z.number().min(1).max(120).optional().nullable(),
  keterangan: z.string().optional(),
  urutan: z.number(),
});

const sppdSchema = z.object({
  spt_id: z.number().optional().nullable(),
  pegawai_id: z.number({ message: 'Pilih pegawai pelaksana' }),
  pejabat_pemberi_perintah_id: z.number().optional().nullable(),
  tingkat_perjalanan: z.string().optional(),
  maksud_perjalanan: z.string().min(5, 'Isi maksud perjalanan minimal 5 karakter'),
  alat_angkut: z.string().optional(),
  tempat_berangkat: z.string().min(1, 'Wajib diisi'),
  tempat_tujuan: z.string().min(1, 'Wajib diisi'),
  lama_perjalanan: z.number().min(1).max(365),
  tanggal_berangkat: z.string().min(1, 'Wajib diisi'),
  tanggal_penerbitan: z.string().min(1, 'Wajib diisi'),
  instansi_id: z.number().optional().nullable(),
  mata_anggaran_id: z.number().optional().nullable(),
  keterangan_lain: z.string().optional(),
  penandatangan_id: z.number().optional().nullable(),
  kop_surat: z.enum(['skpd', 'bupati', 'sekda']),
  pengikut: z.array(pengikutSchema).max(3, 'Maksimal 3 pengikut'),
});

type FormValues = z.infer<typeof sppdSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeKembali(berangkat: string, lama: number): string {
  try {
    if (!berangkat || lama < 1) return '';
    return format(addDays(parseISO(berangkat), lama - 1), 'yyyy-MM-dd');
  } catch { return ''; }
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Supabase fetch helpers ────────────────────────────────────────────────────
async function fetchSPPDById(id: number) {
  const { data, error } = await supabase
    .from('sppd')
    .select('*, pegawai:pegawai_id(*), penandatangan:penandatangan_id(*), sppd_pengikut(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as SPPD & { sppd_pengikut: SPPDPengikut[] };
}

// ── Component ─────────────────────────────────────────────────────────────────
const SPPDForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const sptIdFromUrl = searchParams.get('spt_id');
  const isEdit = !!id;
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<1 | 2 | 3 | 4>(1);
  const [showPengikutForm, setShowPengikutForm] = useState(false);
  const [pengikutFormTipe, setPengikutFormTipe] = useState<'pegawai' | 'manual'>('pegawai');
  const [pengikutPegawaiId, setPengikutPegawaiId] = useState<number | ''>('');
  const [pengikutNama, setPengikutNama] = useState('');
  const [pengikutUmur, setPengikutUmur] = useState<number | ''>('');
  const [pengikutKet, setPengikutKet] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data: existingSPPD, isLoading: loadingExisting } = useQuery({
    queryKey: ['sppd-detail', id],
    queryFn: () => fetchSPPDById(Number(id)),
    enabled: isEdit,
  });

  const { data: pegawaiList = [] } = useQuery<Pegawai[]>({
    queryKey: ['pegawai-select', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pegawai')
        .select('id, nip, nama_lengkap, jabatan, pangkat_id, golongan_id, ref_pangkat:pangkat_id(nama), ref_golongan:golongan_id(nama)')
        .eq('tenant_id', tenantId!).eq('status_aktif', true).order('nama_lengkap');
      if (error) throw error;
      return (data ?? []) as unknown as Pegawai[];
    },
    enabled: !!tenantId,
  });

  const { data: linkedSPT } = useQuery<SPT>({
    queryKey: ['spt-detail', sptIdFromUrl],
    queryFn: async () => {
      const { data, error } = await supabase.from('spt')
        .select('*, spt_pegawai(*, pegawai(*))')
        .eq('id', Number(sptIdFromUrl))
        .single();
      if (error) throw error;
      return data as SPT;
    },
    enabled: !!sptIdFromUrl && !isEdit,
  });

  const { data: sptList = [] } = useQuery<SPT[]>({
    queryKey: ['spt-final', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('spt')
        .select('id, nomor_spt, tanggal_penetapan, status')
        .eq('tenant_id', tenantId!).neq('status', 'Draft').order('tanggal_penetapan', { ascending: false });
      if (error) throw error;
      return data as SPT[];
    },
    enabled: !!tenantId,
  });

  const { data: penandatanganList = [] } = useQuery<Penandatangan[]>({
    queryKey: ['penandatangan-sppd', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('penandatangan')
        .select('*').eq('tenant_id', tenantId!).eq('status_aktif', true);
      if (error) throw error;
      return (data as Penandatangan[]).filter(p => p.jenis_dokumen?.includes('SPPD'));
    },
    enabled: !!tenantId,
  });

  const { data: mataAnggaranList = [] } = useQuery<MataAnggaran[]>({
    queryKey: ['mata-anggaran', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('mata_anggaran')
        .select('*').eq('tenant_id', tenantId!).eq('is_active', true).order('kode');
      if (error) throw error;
      return data as MataAnggaran[];
    },
    enabled: !!tenantId,
  });

  const { data: instansiList = [] } = useQuery<Instansi[]>({
    queryKey: ['instansi', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('instansi').select('*').eq('tenant_id', tenantId!);
      if (error) throw error;
      return data as Instansi[];
    },
    enabled: !!tenantId,
  });

  const { data: tingkatList = [] } = useQuery<RefTingkatPerjalanan[]>({
    queryKey: ['ref-tingkat-perjalanan'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_tingkat_perjalanan').select('*').order('kode');
      if (error) throw error;
      return data as RefTingkatPerjalanan[];
    },
  });

  const { data: alatAngkutList = [] } = useQuery<RefAlatAngkut[]>({
    queryKey: ['ref-alat-angkut'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_alat_angkut').select('*').order('nama');
      if (error) throw error;
      return data as RefAlatAngkut[];
    },
  });

  // ── Form setup ─────────────────────────────────────────────────────────────
  const [defaultValues] = useState<Partial<FormValues>>({
    lama_perjalanan: 1,
    tanggal_berangkat: format(new Date(), 'yyyy-MM-dd'),
    tanggal_penerbitan: format(new Date(), 'yyyy-MM-dd'),
    kop_surat: 'skpd',
    pengikut: [],
  });

  const {
    register, control, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(sppdSchema),
    defaultValues: defaultValues,
  });

  const { fields: pengikutFields, append: appendPengikut, remove: removePengikut, move: movePengikut } = useFieldArray({
    control, name: 'pengikut',
  });

  // Populate form when editing
  useEffect(() => {
    if (!existingSPPD) return;
    const s = existingSPPD;
    setValue('spt_id', s.spt_id ?? null);
    setValue('pegawai_id', s.pegawai_id);
    setValue('pejabat_pemberi_perintah_id', s.pejabat_pemberi_perintah_id ?? null);
    setValue('tingkat_perjalanan', s.tingkat_perjalanan ?? '');
    setValue('maksud_perjalanan', s.maksud_perjalanan);
    setValue('alat_angkut', s.alat_angkut ?? '');
    setValue('tempat_berangkat', s.tempat_berangkat);
    setValue('tempat_tujuan', s.tempat_tujuan);
    setValue('lama_perjalanan', s.lama_perjalanan);
    setValue('tanggal_berangkat', s.tanggal_berangkat);
    setValue('tanggal_penerbitan', s.tanggal_penerbitan);
    setValue('instansi_id', s.instansi_id ?? null);
    setValue('mata_anggaran_id', s.mata_anggaran_id ?? null);
    setValue('keterangan_lain', s.keterangan_lain ?? '');
    setValue('penandatangan_id', s.penandatangan_id ?? null);
    setValue('kop_surat', s.kop_surat ?? 'skpd');
    if (s.sppd_pengikut?.length) {
      setValue('pengikut', s.sppd_pengikut.map(p => ({
        tipe: p.tipe,
        pegawai_id: p.pegawai_id ?? null,
        nama: p.nama ?? '',
        umur: p.umur ?? null,
        keterangan: p.keterangan ?? '',
        urutan: p.urutan,
      })));
    }
  }, [existingSPPD, setValue]);

  // Pre-fill from linked SPT
  useEffect(() => {
    if (!linkedSPT || isEdit) return;
    const s = linkedSPT;
    setValue('spt_id', s.id);
    setValue('maksud_perjalanan', s.tujuan_kegiatan?.join(', ') || '');
    setValue('lama_perjalanan', s.lama_kegiatan || 1);
    setValue('tanggal_berangkat', s.tanggal_penetapan); // Default to SPT date
    
    // Default to first pegawai in SPT if any
    if (s.spt_pegawai && s.spt_pegawai.length > 0) {
      setValue('pegawai_id', s.spt_pegawai[0].pegawai_id);
    }
  }, [linkedSPT, isEdit, setValue]);

  // Watched values for computed fields and preview
  const watchedBerangkat = watch('tanggal_berangkat');
  const watchedLama = watch('lama_perjalanan');
  const watchedPegawai = watch('pegawai_id');
  const watchedSptId = watch('spt_id');
  const watchedTujuan = watch('tempat_tujuan');
  const watchedMaksud = watch('maksud_perjalanan');
  const watchedPenandatangan = watch('penandatangan_id');
  const watchedPengikut = watch('pengikut');

  const tanggalKembali = computeKembali(watchedBerangkat, watchedLama);

  // SPT date validation
  const selectedSpt = sptList.find(s => s.id === watchedSptId);
  const sptDateWarning = selectedSpt && watchedBerangkat && isAfter(parseISO(selectedSpt.tanggal_penetapan), parseISO(watchedBerangkat))
    ? `Tanggal berangkat harus >= tanggal SPT (${format(parseISO(selectedSpt.tanggal_penetapan), 'dd MMM yyyy', { locale: localeID })})`
    : null;

  // Selected pegawai details
  const selectedPegawai = pegawaiList.find(p => p.id === watchedPegawai);

  // Overlap check (debounced on submit)
  const checkOverlap = useCallback(async (pegawaiId: number, berangkat: string, kembali: string, currentId?: number) => {
    if (!pegawaiId || !berangkat || !kembali) return null;
    let q = supabase.from('sppd')
      .select('id, nomor_sppd, tanggal_berangkat, tanggal_kembali')
      .eq('pegawai_id', pegawaiId)
      .not('status', 'in', '("Cancelled","Completed","Expired")')
      .lte('tanggal_berangkat', kembali)
      .gte('tanggal_kembali', berangkat);
    if (currentId) q = q.neq('id', currentId);
    const { data } = await q;
    return data?.length ? data[0] : null;
  }, []);

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ values, targetStatus }: { values: FormValues; targetStatus: DocumentStatus }) => {
      const { pengikut, ...sppdData } = values;
      const kembali = computeKembali(sppdData.tanggal_berangkat, sppdData.lama_perjalanan);

      // Overlap check
      if (targetStatus !== 'Draft' && watchedPegawai) {
        const overlap = await checkOverlap(watchedPegawai, sppdData.tanggal_berangkat, kembali, isEdit ? Number(id) : undefined);
        if (overlap) {
          throw new Error(`Pegawai memiliki SPPD yang tumpang tindih (${overlap.nomor_sppd || `#${overlap.id}`})`);
        }
      }

      const payload = {
        ...sppdData,
        tanggal_kembali: kembali,
        tenant_id: tenantId!,
        status: targetStatus,
        spt_id: sppdData.spt_id ?? null,
        pejabat_pemberi_perintah_id: sppdData.pejabat_pemberi_perintah_id ?? null,
        instansi_id: sppdData.instansi_id ?? null,
        mata_anggaran_id: sppdData.mata_anggaran_id ?? null,
        penandatangan_id: sppdData.penandatangan_id ?? null,
        tingkat_perjalanan: sppdData.tingkat_perjalanan || null,
        alat_angkut: sppdData.alat_angkut || null,
        keterangan_lain: sppdData.keterangan_lain || null,
      };

      let sppdId: number;
      let finalNomor: string | null = null;

      if (targetStatus !== 'Draft') {
        // Only generate number if it doesn't already have one
        const alreadyHasNomor = (isEdit && existingSPPD?.nomor_sppd);
        if (!alreadyHasNomor) {
          const { data: nomorData, error: rpcErr } = await supabase.rpc('get_next_document_number', {
            p_jenis: 'SPPD',
            p_tenant_id: tenantId
          });
          if (rpcErr) throw rpcErr;
          finalNomor = nomorData;
        }
      }

      if (isEdit) {
        const updatePayload: any = { ...payload };
        if (finalNomor) updatePayload.nomor_sppd = finalNomor;
        
        const { error } = await supabase.from('sppd').update(updatePayload).eq('id', Number(id));
        if (error) throw error;
        sppdId = Number(id);
        // Remove old pengikut
        await supabase.from('sppd_pengikut').delete().eq('sppd_id', sppdId);
      } else {
        const { data: inserted, error } = await supabase
          .from('sppd')
          .insert({ ...payload, nomor_sppd: finalNomor, print_count: 0 })
          .select('id')
          .single();
        if (error) throw error;
        sppdId = inserted.id;
      }

      // Insert pengikut
      if (pengikut.length) {
        const pengikutRows = pengikut.map((p, i) => ({
          sppd_id: sppdId,
          tipe: p.tipe,
          pegawai_id: p.tipe === 'pegawai' ? p.pegawai_id : null,
          nama: p.nama || (p.tipe === 'pegawai' ? pegawaiList.find(px => px.id === p.pegawai_id)?.nama_lengkap : null),
          umur: p.umur ?? null,
          keterangan: p.keterangan ?? null,
          urutan: i + 1,
        }));
        const { error: pe } = await supabase.from('sppd_pengikut').insert(pengikutRows);
        if (pe) throw pe;
      }

      // Mark status
      if (!isEdit && targetStatus === 'Menunggu Persetujuan') {
        await supabase.from('sppd').update({ status: 'Menunggu Persetujuan' }).eq('id', sppdId);
      }

      return sppdId;
    },
    onSuccess: (_sppdId, { targetStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['sppd-list'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['sppd-detail', id] });
      toast.success(
        targetStatus === 'Draft' ? 'Draft SPPD disimpan.' :
        targetStatus === 'Completed' ? 'SPPD ditandai selesai.' :
        'SPPD berhasil difinalisasi!'
      );
      navigate('/sppd');
    },
    onError: (e: Error) => {
      setOverlapWarning(e.message);
      toast.error(e.message);
    },
  });

  const onSubmit = (targetStatus: DocumentStatus) => handleSubmit(values => {
    setOverlapWarning(null);
    saveMutation.mutate({ values, targetStatus });
  })();

  // Mark completed (edit mode only)
  const markCompleted = async () => {
    if (!id) return;
    const { error } = await supabase.from('sppd').update({
      status: 'Completed', completed_at: new Date().toISOString(),
    }).eq('id', Number(id));
    if (error) toast.error(error.message);
    else {
      toast.success('SPPD ditandai selesai.');
      queryClient.invalidateQueries({ queryKey: ['sppd-list'] });
      navigate('/sppd');
    }
  };

  // ── Pengikut helpers ───────────────────────────────────────────────────────
  const handleAddPengikut = () => {
    if (pengikutFields.length >= 3) { toast.warning('Maksimal 3 pengikut.'); return; }
    if (pengikutFormTipe === 'pegawai' && !pengikutPegawaiId) { toast.error('Pilih pegawai.'); return; }
    if (pengikutFormTipe === 'manual' && !pengikutNama.trim()) { toast.error('Isi nama pengikut.'); return; }

    const pegawaiData = pegawaiList.find(p => p.id === Number(pengikutPegawaiId));
    appendPengikut({
      tipe: pengikutFormTipe,
      pegawai_id: pengikutFormTipe === 'pegawai' ? Number(pengikutPegawaiId) : null,
      nama: pengikutFormTipe === 'manual' ? pengikutNama : (pegawaiData?.nama_lengkap ?? ''),
      umur: pengikutUmur !== '' ? Number(pengikutUmur) : null,
      keterangan: pengikutKet,
      urutan: pengikutFields.length + 1,
    });
    setPengikutPegawaiId('');
    setPengikutNama('');
    setPengikutUmur('');
    setPengikutKet('');
    setShowPengikutForm(false);
  };

  // ── Preview helpers ────────────────────────────────────────────────────────
  const previewPenandatangan = penandatanganList.find(p => p.id === watchedPenandatangan);
  const previewPegawai = pegawaiList.find(p => p.id === watchedPegawai);
  const previewInstansi = instansiList.find(i => i.is_primary) ?? instansiList[0];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const canComplete = isEdit && (existingSPPD?.status === 'Final' || existingSPPD?.status === 'Printed');

  const SECTIONS = [
    { id: 1, label: 'Identitas Perjalanan' },
    { id: 2, label: 'Jadwal' },
    { id: 3, label: 'Anggaran & TTD' },
    { id: 4, label: 'Pengikut' },
  ] as const;

  return (
    <div className="page-enter max-w-screen-xl mx-auto pt-8 px-4 pb-12">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="premium-header mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="btn bg-white/80 hover:bg-white text-slate-600 w-12 h-12 rounded-2xl shadow-sm border border-slate-200/50 flex items-center justify-center transition-all active:scale-95"
              onClick={() => navigate('/sppd')}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                <Link to="/sppd" className="hover:text-blue-500 transition-colors text-slate-400">Surat Perjalanan Dinas</Link>
                <ChevronRight size={10} className="text-slate-300" />
                <span className="text-blue-500">{isEdit ? `Dokumen #${id}` : 'Proses Baru'}</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {isEdit ? 'Edit SPPD' : 'Buat SPPD Baru'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canComplete && (
              <button className="btn btn-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 px-6" onClick={markCompleted}>
                <CheckCircle2 size={16} /> Tandai Selesai
              </button>
            )}
            <button
              className="btn btn-secondary px-6"
              onClick={() => onSubmit('Draft')}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Draft
            </button>
            <button
              className="btn btn-primary px-8 shadow-blue-500/25"
              onClick={() => onSubmit('Menunggu Persetujuan')}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
              Finalisasi
            </button>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {overlapWarning && (
        <div className="alert alert-danger">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>{overlapWarning}</span>
        </div>
      )}
      {sptDateWarning && (
        <div className="alert alert-warning">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>{sptDateWarning}</span>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr minmax(0, 420px)' }}>
        {/* LEFT — Form */}
        <div className="flex flex-col gap-5">
          {/* Section Nav */}
          <div className="flex items-center justify-between gap-2 mb-2 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100/50">
            {SECTIONS.map((s, i) => (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 ${activeSection === s.id ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:bg-white/50'}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${activeSection === s.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {s.id}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider hidden lg:block">{s.label}</span>
                </button>
                {i < SECTIONS.length - 1 && (
                  <ChevronRight size={12} className="text-slate-300 hidden md:block" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Section 1 — Identitas */}
          {activeSection === 1 && (
            <div className="card card-body flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-800">Identitas Perjalanan</h3>

              <div className="form-group">
                <label className="form-label">Referensi SPT (Opsional)</label>
                <Controller name="spt_id" control={control} render={({ field }) => (
                  <select
                    className="form-select"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">-- Tidak ada SPT --</option>
                    {sptList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nomor_spt || `DRAFT-${format(parseISO(s.tanggal_penetapan), 'yyyyMMdd')}`} — {format(parseISO(s.tanggal_penetapan), 'dd MMM yyyy', { locale: localeID })}
                      </option>
                    ))}
                  </select>
                )} />
              </div>

              <div className="form-group mb-5">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Jenis Kop Surat</label>
                <Controller name="kop_surat" control={control} render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'skpd', icon: '🏢', label: 'SKPD' },
                      { value: 'bupati', icon: '👑', label: 'Bupati' },
                      { value: 'sekda', icon: '🏛️', label: 'Sekda' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border-2 transition-all ${
                          field.value === opt.value 
                            ? 'border-blue-500 bg-blue-50 shadow-sm opacity-100' 
                            : 'border-slate-100 bg-white hover:border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span className="text-lg mb-0.5">{opt.icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-tight ${field.value === opt.value ? 'text-blue-700' : 'text-slate-500'}`}>{opt.label}</span>
                        {field.value === opt.value && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            <CheckCircle2 size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )} />
              </div>

              <div className="form-group">
                <label className="form-label">Pegawai Pelaksana <span className="required-mark">*</span></label>
                <Controller name="pegawai_id" control={control} render={({ field }) => (
                  <select
                    className={`form-select ${errors.pegawai_id ? 'is-error' : ''}`}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">Pilih Pegawai</option>
                    {pegawaiList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nama_lengkap} — NIP. {p.nip}
                      </option>
                    ))}
                  </select>
                )} />
                {selectedPegawai && (
                  <p className="form-hint">
                    {selectedPegawai.jabatan}
                    {selectedPegawai.ref_pangkat ? ` · ${selectedPegawai.ref_pangkat.nama}` : ''}
                    {selectedPegawai.ref_golongan ? ` (${selectedPegawai.ref_golongan.nama})` : ''}
                  </p>
                )}
                {errors.pegawai_id && <p className="form-error"><AlertTriangle size={12} />{errors.pegawai_id.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Pejabat Pemberi Perintah</label>
                <Controller name="pejabat_pemberi_perintah_id" control={control} render={({ field }) => (
                  <select
                    className="form-select"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Pilih Pejabat</option>
                    {pegawaiList.map(p => (
                      <option key={p.id} value={p.id}>{p.nama_lengkap} — {p.jabatan}</option>
                    ))}
                  </select>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Tingkat Perjalanan</label>
                  <select className="form-select" {...register('tingkat_perjalanan')}>
                    <option value="">Pilih</option>
                    {tingkatList.map(t => (
                      <option key={t.id} value={t.kode}>{t.kode} — {t.deskripsi}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Alat Angkut</label>
                  <select className="form-select" {...register('alat_angkut')}>
                    <option value="">Pilih</option>
                    {alatAngkutList.map(a => (
                      <option key={a.id} value={a.nama}>{a.nama}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Maksud Perjalanan <span className="required-mark">*</span></label>
                <textarea
                  className={`form-textarea ${errors.maksud_perjalanan ? 'is-error' : ''}`}
                  rows={4}
                  placeholder="Jelaskan tujuan dan keperluan perjalanan dinas..."
                  {...register('maksud_perjalanan')}
                />
                {errors.maksud_perjalanan && <p className="form-error"><AlertTriangle size={12} />{errors.maksud_perjalanan.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Instansi</label>
                <Controller name="instansi_id" control={control} render={({ field }) => (
                  <select
                    className="form-select"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Pilih Instansi</option>
                    {instansiList.map(i => (
                      <option key={i.id} value={i.id}>{i.nama_singkat}</option>
                    ))}
                  </select>
                )} />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" className="btn btn-primary" onClick={() => setActiveSection(2)}>
                  Lanjut ke Jadwal <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Section 2 — Jadwal */}
          {activeSection === 2 && (
            <div className="card card-body flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-800">Jadwal Perjalanan</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Tempat Berangkat <span className="required-mark">*</span></label>
                  <input type="text" className={`form-input ${errors.tempat_berangkat ? 'is-error' : ''}`}
                    placeholder="Kota asal" {...register('tempat_berangkat')} />
                  {errors.tempat_berangkat && <p className="form-error"><AlertTriangle size={12} />{errors.tempat_berangkat.message}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Tempat Tujuan <span className="required-mark">*</span></label>
                  <input type="text" className={`form-input ${errors.tempat_tujuan ? 'is-error' : ''}`}
                    placeholder="Kota tujuan" {...register('tempat_tujuan')} />
                  {errors.tempat_tujuan && <p className="form-error"><AlertTriangle size={12} />{errors.tempat_tujuan.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Tanggal Berangkat <span className="required-mark">*</span></label>
                  <input type="date" className={`form-input ${errors.tanggal_berangkat ? 'is-error' : ''}`}
                    {...register('tanggal_berangkat')} />
                  {errors.tanggal_berangkat && <p className="form-error"><AlertTriangle size={12} />{errors.tanggal_berangkat.message}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Lama Perjalanan (hari) <span className="required-mark">*</span></label>
                  <input
                    type="number" min={1} max={365}
                    className={`form-input ${errors.lama_perjalanan ? 'is-error' : ''}`}
                    {...register('lama_perjalanan', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Tanggal Kembali <span className="text-slate-400 font-normal text-xs">(Otomatis)</span></label>
                  <input
                    type="date"
                    className="form-input"
                    value={tanggalKembali}
                    disabled
                    readOnly
                  />
                  <p className="form-hint">Dihitung otomatis: berangkat + ({watchedLama} - 1) hari</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Penerbitan <span className="required-mark">*</span></label>
                  <input type="date" className={`form-input ${errors.tanggal_penerbitan ? 'is-error' : ''}`}
                    {...register('tanggal_penerbitan')} />
                </div>
              </div>

              <div className="flex justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveSection(1)}>
                  <ArrowLeft size={14} /> Kembali
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setActiveSection(3)}>
                  Lanjut ke Anggaran <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Section 3 — Anggaran & Penandatangan */}
          {activeSection === 3 && (
            <div className="card card-body flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-800">Anggaran & Penandatangan</h3>

              <div className="form-group">
                <label className="form-label">Mata Anggaran</label>
                <Controller name="mata_anggaran_id" control={control} render={({ field }) => (
                  <select
                    className="form-select"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">-- Pilih Mata Anggaran --</option>
                    {mataAnggaranList.map(m => (
                      <option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>
                    ))}
                  </select>
                )} />
              </div>

              <div className="form-group">
                <label className="form-label">Penandatangan</label>
                <Controller name="penandatangan_id" control={control} render={({ field }) => (
                  <select
                    className="form-select"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">-- Pilih Penandatangan --</option>
                    {penandatanganList.map(p => (
                      <option key={p.id} value={p.id}>{p.nama_lengkap} — {p.jabatan}</option>
                    ))}
                  </select>
                )} />
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan Lain</label>
                <textarea className="form-textarea" rows={3} {...register('keterangan_lain')} />
              </div>

              <div className="flex justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveSection(2)}>
                  <ArrowLeft size={14} /> Kembali
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setActiveSection(4)}>
                  Lanjut ke Pengikut <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Section 4 — Pengikut */}
          {activeSection === 4 && (
            <div className="card card-body flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Pengikut Perjalanan</h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPengikutForm(v => !v)}
                  disabled={pengikutFields.length >= 3}
                >
                  <Plus size={14} /> Tambah Pengikut
                </button>
              </div>

              {pengikutFields.length >= 3 && (
                <div className="alert alert-warning">
                  <AlertTriangle size={14} />
                  <span>Maksimal 3 pengikut telah ditambahkan.</span>
                </div>
              )}

              {/* Pengikut mini form */}
              {showPengikutForm && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input type="radio" name="pqTipe" value="pegawai"
                        checked={pengikutFormTipe === 'pegawai'}
                        onChange={() => setPengikutFormTipe('pegawai')} />
                      Pegawai
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input type="radio" name="pqTipe" value="manual"
                        checked={pengikutFormTipe === 'manual'}
                        onChange={() => setPengikutFormTipe('manual')} />
                      Manual
                    </label>
                  </div>

                  {pengikutFormTipe === 'pegawai' ? (
                    <div className="form-group">
                      <label className="form-label">Pilih Pegawai</label>
                      <select
                        className="form-select"
                        value={pengikutPegawaiId}
                        onChange={e => setPengikutPegawaiId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">Pilih...</option>
                        {pegawaiList
                          .filter(p => p.id !== watchedPegawai && !watchedPengikut.some(px => px.tipe === 'pegawai' && px.pegawai_id === p.id))
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.nama_lengkap} — NIP. {p.nip}</option>
                          ))
                        }
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="form-group">
                        <label className="form-label">Nama</label>
                        <input type="text" className="form-input" value={pengikutNama}
                          onChange={e => setPengikutNama(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Umur</label>
                        <input type="number" min={1} max={120} className="form-input"
                          value={pengikutUmur}
                          onChange={e => setPengikutUmur(e.target.value ? Number(e.target.value) : '')} />
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Keterangan (Opsional)</label>
                    <input type="text" className="form-input" value={pengikutKet}
                      onChange={e => setPengikutKet(e.target.value)} />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setShowPengikutForm(false)}>Batal</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleAddPengikut}>
                      <Plus size={13} /> Tambahkan
                    </button>
                  </div>
                </div>
              )}

              {/* Pengikut list */}
              {pengikutFields.length === 0 ? (
                <div className="empty-state py-8">
                  <User size={32} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">Belum ada pengikut ditambahkan.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pengikutFields.map((field, idx) => {
                    const p = pegawaiList.find(px => px.id === field.pegawai_id);
                    const displayName = field.tipe === 'pegawai' ? (p?.nama_lengkap ?? '-') : (field.nama ?? '-');
                    return (
                      <div key={field.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                        <GripVertical size={16} className="drag-handle text-slate-400" />
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initials(displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{displayName}</p>
                          <p className="text-xs text-slate-400">
                            {field.tipe === 'pegawai' ? `NIP. ${p?.nip ?? '-'}` : `Umur: ${field.umur ?? '-'}`}
                            {field.keterangan ? ` · ${field.keterangan}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {idx > 0 && (
                            <button type="button" className="btn btn-ghost btn-icon-sm text-slate-400"
                              onClick={() => movePengikut(idx, idx - 1)}>↑</button>
                          )}
                          {idx < pengikutFields.length - 1 && (
                            <button type="button" className="btn btn-ghost btn-icon-sm text-slate-400"
                              onClick={() => movePengikut(idx, idx + 1)}>↓</button>
                          )}
                          <button type="button" className="btn btn-ghost btn-icon-sm text-rose-400"
                            onClick={() => removePengikut(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-slate-100">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveSection(3)}>
                  <ArrowLeft size={14} /> Kembali
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary border-slate-200" onClick={() => onSubmit('Draft')} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Draft
                  </button>
                  <button type="button" className="btn btn-primary shadow-blue-500/25" onClick={() => onSubmit('Menunggu Persetujuan')} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />} Finalisasi SPPD
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Preview */}
        <div className="sticky top-6 h-fit">
          <div className="preview-panel overflow-y-auto max-h-[calc(100vh-120px)]">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">
              Preview Dokumen
            </p>
            {/* Header instansi */}
            <div className="text-center mb-4 border-b-2 border-black pb-3">
              <p className="font-bold text-sm uppercase">{previewInstansi?.nama_lengkap ?? '[INSTANSI]'}</p>
              <p className="text-xs">{previewInstansi?.alamat ?? ''}</p>
              <p className="text-xs">Telp. {previewInstansi?.telepon ?? '-'}</p>
            </div>
            <p className="font-bold text-center text-sm uppercase underline mb-4">
              SURAT PERINTAH PERJALANAN DINAS
            </p>
            <p className="text-xs text-center mb-4">
              Nomor: {existingSPPD?.nomor_sppd ?? '................................'}
            </p>

            <table className="w-full text-xs mb-4" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Pejabat Yang Memberi Perintah', pegawaiList.find(p => p.id === watch('pejabat_pemberi_perintah_id'))?.jabatan ?? '—'],
                  ['Nama / NIP', previewPegawai ? `${previewPegawai.nama_lengkap} / ${previewPegawai.nip}` : '—'],
                  ['Jabatan', previewPegawai?.jabatan ?? '—'],
                  ['Tingkat Biaya Perjalanan', watch('tingkat_perjalanan') || '—'],
                  ['Maksud Perjalanan', watchedMaksud || '—'],
                  ['Alat Angkut', watch('alat_angkut') || '—'],
                  ['Tempat Berangkat', watch('tempat_berangkat') || '—'],
                  ['Tempat Tujuan', watchedTujuan || '—'],
                  ['Lama Perjalanan', watchedLama ? `${watchedLama} hari` : '—'],
                  ['Tgl Berangkat', watchedBerangkat ? format(parseISO(watchedBerangkat), 'dd MMMM yyyy', { locale: localeID }) : '—'],
                  ['Tgl Kembali', tanggalKembali ? format(parseISO(tanggalKembali), 'dd MMMM yyyy', { locale: localeID }) : '—'],
                  ['Pengikut', watchedPengikut.length > 0
                    ? `${watchedPengikut.length} orang (${watchedPengikut.map(p => p.tipe === 'pegawai' ? (pegawaiList.find(px => px.id === p.pegawai_id)?.nama_lengkap) : p.nama).join(', ')})`
                    : '—'
                  ],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-0.5 pr-2 text-slate-600 w-40">{k}</td>
                    <td className="py-0.5 pr-1 w-4">:</td>
                    <td className="py-0.5 font-medium">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {watchedPengikut.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold mb-1">Pengikut:</p>
                <ol className="text-xs list-decimal list-inside space-y-0.5">
                  {watchedPengikut.map((p, i) => {
                    const pg = pegawaiList.find(px => px.id === p.pegawai_id);
                    return <li key={i}>{p.tipe === 'pegawai' ? pg?.nama_lengkap : p.nama}</li>;
                  })}
                </ol>
              </div>
            )}

            <div className="mt-6 text-right text-xs">
              <p>
                {watch('tempat_tujuan') || '.......................'},{' '}
                {watch('tanggal_penerbitan')
                  ? format(parseISO(watch('tanggal_penerbitan')), 'dd MMMM yyyy', { locale: localeID })
                  : '................................'}
              </p>
              <p className="mt-1">{previewPenandatangan?.jabatan ?? '................................'}</p>
              <div className="h-12" />
              <p className="font-bold underline">{previewPenandatangan?.nama_lengkap ?? '................................'}</p>
              <p>NIP. {previewPenandatangan?.nip ?? '................................'}</p>
            </div>
          </div>

          {/* Tips */}
          <div className="alert alert-info mt-3 text-xs">
            <Info size={14} className="flex-shrink-0" />
            <span>Preview diperbarui saat Anda mengetik. Klik Finalisasi untuk menetapkan nomor SPPD.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SPPDForm;
