// =================================================================
// SiSPPD v2.1 — SPPD Detail (Module 06-A)
// =================================================================
import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Printer,
  Edit,
  X,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Building2,
  User,
  Clock,
  FileText,
  Users,
  Wallet,
  History,
  ArrowRight,
  Plane,
  Link2,
  BadgeCheck,
  Plus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  formatDateIndonesian,
  formatDatetime,
  formatNamaLengkap,
  getStatusClass,
  getStatusLabel,
  canEdit,
  canFinalize,
  canPrint,
  canCancel,
  canCreateRevision,
} from '../lib/utils';
import { toast } from 'sonner';
import type { SPPD, SPPDPengikut, SPPDRealisasi, ApprovalLog, DocumentStatus } from '../types';

// ─── Local extended types for joined data ─────────────────────────
interface SPPDDetail extends Omit<SPPD, 'sppd_pengikut' | 'sppd_realisasi' | 'pegawai' | 'instansi' | 'penandatangan' | 'spt' | 'mata_anggaran_rel'> {
  spt?: {
    id: number;
    nomor_spt?: string;
    status: DocumentStatus;
  } | null;
  pegawai?: {
    id: number;
    nip: string;
    nama_lengkap: string;
    gelar_depan?: string;
    gelar_belakang?: string;
    jabatan: string;
    ref_pangkat?: { id: number; nama: string };
    ref_golongan?: { id: number; nama: string };
    instansi?: { id: number; nama_singkat: string; nama_lengkap: string };
  } | null;
  penandatangan?: {
    id: number;
    nip: string;
    nama_lengkap: string;
    jabatan: string;
  } | null;
  instansi?: {
    id: number;
    nama_singkat: string;
    nama_lengkap: string;
  } | null;
  mata_anggaran_rel?: {
    id: number;
    kode: string;
    nama: string;
  } | null;
  sppd_pengikut?: SPPDPengikut[];
  sppd_realisasi?: SPPDRealisasi[];
}

interface ApprovalLogRow extends Omit<ApprovalLog, 'approver'> {
  approver?: { nama_lengkap: string } | null;
}

// ─── Action label map ─────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  SUBMIT: 'Diajukan',
  APPROVE: 'Disetujui',
  REJECT: 'Ditolak',
  REVISE: 'Diminta Revisi',
  BYPASS: 'Dilewati',
};

const ACTION_COLORS: Record<string, string> = {
  SUBMIT: 'bg-blue-500',
  APPROVE: 'bg-emerald-500',
  REJECT: 'bg-rose-500',
  REVISE: 'bg-amber-500',
  BYPASS: 'bg-slate-400',
};

const SECTION_LABELS: Record<number, string> = {
  1: 'Keberangkatan',
  2: 'Tiba di Tujuan',
  3: 'Kembali dari Tujuan',
  4: 'Tiba Kembali',
};

// ─── Loading Skeleton ─────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="page-container page-enter">
    <div className="page-header">
      <div className="space-y-2">
        <div className="skeleton h-6 w-20 rounded-lg" />
        <div className="skeleton h-8 w-72 rounded-xl" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded-xl" />
        <div className="skeleton h-9 w-24 rounded-xl" />
        <div className="skeleton h-9 w-28 rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="skeleton h-56 rounded-2xl" />
      <div className="skeleton h-56 rounded-2xl" />
      <div className="skeleton h-44 rounded-2xl" />
      <div className="skeleton h-44 rounded-2xl" />
      <div className="skeleton h-40 rounded-2xl lg:col-span-2" />
    </div>
  </div>
);

// ─── Info Row ─────────────────────────────────────────────────────
const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="flex gap-3 py-3 border-b border-slate-50 last:border-0">
    {icon && (
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 mt-0.5">
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm text-slate-800 font-medium">
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  </div>
);

// ─── Section Header ───────────────────────────────────────────────
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  count?: number;
}> = ({ icon, title, count }) => (
  <div className="card-header">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <h3 className="font-bold text-slate-800">{title}</h3>
      {count !== undefined && (
        <span className="badge badge-blue">{count}</span>
      )}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────
export default function SPPDDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId, hasRole } = useAuth();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [komentar, setKomentar] = useState('');
  const [alasan, setAlasan] = useState('');
  const [showRealisasiModal, setShowRealisasiModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [realisasiForm, setRealisasiForm] = useState({
    tanggal: '',
    lokasi: '',
    nama_pejabat: '',
    jabatan_pejabat: '',
    catatan: '',
  });

  // ── Data Fetching ──────────────────────────────────────────────
  const {
    data: sppd,
    isLoading,
    isError,
  } = useQuery<SPPDDetail>({
    queryKey: ['sppd', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sppd')
        .select(`
          *,
          spt:spt_id(*),
          pegawai:pegawai_id(*, ref_pangkat:pangkat_id(*), ref_golongan:golongan_id(*), unit_kerja:unit_kerja_id(*)),
          instansi:instansi_id(*),
          penandatangan:penandatangan_id(*),
          sppd_pengikut(*),
          sppd_realisasi(*),
          mata_anggaran:mata_anggaran_id(*)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as SPPDDetail;
    },
    enabled: !!id,
  });

  const {
    data: approvalLogs = [],
  } = useQuery<ApprovalLogRow[]>({
    queryKey: ['approval_log', 'sppd', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_log')
        .select('*, approver:approver_id(nama_lengkap)')
        .eq('dokumen_id', Number(id))
        .eq('jenis_dokumen', 'SPPD')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ApprovalLogRow[];
    },
    enabled: !!id,
  });

  // ── Mutations ──────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !sppd) throw new Error('Data tidak lengkap');

      // 1. Get next number if not currently numbered
      let nomor = sppd.nomor_sppd;
      if (!nomor) {
        const { data: nextNo, error: noErr } = await supabase.rpc(
          'get_next_document_number',
          { p_tenant_id: tenantId, p_jenis: 'SPPD' }
        );
        if (noErr) throw noErr;
        nomor = nextNo as string;
      }

      // 2. Update SPPD Status
      const { error: updateErr } = await supabase
        .from('sppd')
        .update({
          status: 'Final' as DocumentStatus,
          nomor_sppd: nomor,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (updateErr) throw updateErr;

      // 3. Log to approval_log
      const { error: logErr } = await supabase.from('approval_log').insert({
        tenant_id: tenantId,
        dokumen_id: Number(id),
        jenis_dokumen: 'SPPD',
        level: 1,
        approver_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'APPROVE',
        komentar: komentar || 'Disetujui melalui sistem.',
      });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      toast.success('SPPD Berhasil Disetujui & Difinalisasi');
      queryClient.invalidateQueries({ queryKey: ['sppd'] });
      queryClient.invalidateQueries({ queryKey: ['approval_log'] });
      setShowApproveModal(false);
      setKomentar('');
    },
    onError: (err: any) => toast.error('Gagal menyetujui: ' + err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant tidak ditemukan');

      // 1. Update SPPD Status back to Draft
      const { error: updateErr } = await supabase
        .from('sppd')
        .update({ status: 'Draft' as DocumentStatus })
        .eq('id', id!);
      if (updateErr) throw updateErr;

      // 2. Log to approval_log
      const { error: logErr } = await supabase.from('approval_log').insert({
        tenant_id: tenantId,
        dokumen_id: Number(id),
        jenis_dokumen: 'SPPD',
        level: 1,
        approver_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'REJECT',
        komentar: komentar || 'Ditolak/revisi oleh Pejabat.',
      });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      toast.info('SPPD Ditolak (Kembali ke Draft)');
      queryClient.invalidateQueries({ queryKey: ['sppd'] });
      queryClient.invalidateQueries({ queryKey: ['approval_log'] });
      setShowRejectModal(false);
      setKomentar('');
    },
    onError: (err: any) => toast.error('Gagal memproses penolakan: ' + err.message),
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant tidak ditemukan');

      const { data: nomor, error: nomorError } = await supabase.rpc(
        'get_next_document_number',
        { p_tenant_id: tenantId, p_jenis: 'SPPD' }
      );
      if (nomorError) throw new Error('Gagal mendapatkan nomor dokumen: ' + nomorError.message);

      const { error } = await supabase
        .from('sppd')
        .update({
          status: 'Final' as DocumentStatus,
          nomor_sppd: nomor as string,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SPPD berhasil difinalisasi');
      queryClient.invalidateQueries({ queryKey: ['sppd'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal memfinalisasi SPPD'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sppd')
        .update({
          status: 'Cancelled' as DocumentStatus,
          alasan_pembatalan: alasan,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SPPD berhasil dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['sppd'] });
      setShowCancelModal(false);
      setAlasan('');
    },
    onError: () => toast.error('Gagal membatalkan SPPD'),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sppd')
        .update({
          status: 'Completed' as DocumentStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SPPD berhasil ditandai Selesai');
      queryClient.invalidateQueries({ queryKey: ['sppd'] });
      setShowCompleteModal(false);
    },
    onError: () => toast.error('Gagal menandai SPPD selesai'),
  });
  
  const saveRealisasiMutation = useMutation({
    mutationFn: async () => {
      if (!id || selectedSection === null) return;
      const payload = {
        sppd_id: Number(id),
        section: selectedSection,
        tanggal: realisasiForm.tanggal || null,
        lokasi: realisasiForm.lokasi || null,
        nama_pejabat: realisasiForm.nama_pejabat || null,
        jabatan_pejabat: realisasiForm.jabatan_pejabat || null,
        catatan: realisasiForm.catatan || null,
      };

      const { error } = await supabase
        .from('sppd_realisasi')
        .upsert(payload, { onConflict: 'sppd_id, section' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Data realisasi berhasil disimpan');
      queryClient.invalidateQueries({ queryKey: ['sppd', id] });
      setShowRealisasiModal(false);
    },
    onError: (err: any) => toast.error('Gagal menyimpan realisasi: ' + err.message),
  });

  const cloneRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!sppd || !tenantId) throw new Error('Data tidak lengkap');

      const { spt, pegawai, penandatangan, instansi, sppd_pengikut, sppd_realisasi, mata_anggaran_rel, ...base } = sppd;

      const { data: newSppd, error } = await supabase
        .from('sppd')
        .insert({
          tenant_id: tenantId,
          spt_id: base.spt_id,
          pegawai_id: base.pegawai_id,
          pejabat_pemberi_perintah_id: base.pejabat_pemberi_perintah_id,
          tingkat_perjalanan: base.tingkat_perjalanan,
          maksud_perjalanan: base.maksud_perjalanan,
          alat_angkut: base.alat_angkut,
          tempat_berangkat: base.tempat_berangkat,
          tempat_tujuan: base.tempat_tujuan,
          lama_perjalanan: base.lama_perjalanan,
          tanggal_berangkat: base.tanggal_berangkat,
          tanggal_kembali: base.tanggal_kembali,
          instansi_id: base.instansi_id,
          mata_anggaran_id: base.mata_anggaran_id,
          keterangan_lain: base.keterangan_lain,
          tempat_penerbitan: base.tempat_penerbitan,
          tanggal_penerbitan: base.tanggal_penerbitan,
          penandatangan_id: base.penandatangan_id,
          kop_surat: base.kop_surat,
          parent_sppd_id: base.id,
          status: 'Draft' as DocumentStatus,
          print_count: 0,
        })
        .select()
        .single();
      if (error) throw error;

      // Copy pengikut
      if (sppd_pengikut && sppd_pengikut.length > 0 && newSppd) {
        const rows = sppd_pengikut.map((p) => ({
          sppd_id: (newSppd as { id: number }).id,
          tipe: p.tipe,
          pegawai_id: p.pegawai_id,
          nama: p.nama,
          umur: p.umur,
          keterangan: p.keterangan,
          urutan: p.urutan,
        }));
        const { error: pengErr } = await supabase.from('sppd_pengikut').insert(rows);
        if (pengErr) throw pengErr;
      }

      return (newSppd as { id: number }).id;
    },
    onSuccess: (newId) => {
      toast.success('Revisi SPPD berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['sppd'] });
      navigate(`/sppd/${newId}`);
    },
    onError: () => toast.error('Gagal membuat revisi SPPD'),
  });

  // ── Render States ──────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;

  if (isError || !sppd) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-rose-400" />
          </div>
          <p className="empty-state-title">SPPD Tidak Ditemukan</p>
          <p className="empty-state-desc">
            Dokumen yang Anda cari tidak tersedia atau telah dihapus.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/sppd')}>
            <ArrowLeft size={14} /> Kembali ke Daftar SPPD
          </button>
        </div>
      </div>
    );
  }

  const sortedPengikut = [...(sppd.sppd_pengikut ?? [])].sort((a, b) => a.urutan - b.urutan);
  const isFinalOrPrinted = ['Final', 'Printed', 'Completed'].includes(sppd.status);

  const handleOpenRealisasi = (sectionNum: number) => {
    const existing = sppd.sppd_realisasi?.find(r => r.section === sectionNum);
    setSelectedSection(sectionNum);
    setRealisasiForm({
      tanggal: existing?.tanggal || '',
      lokasi: existing?.lokasi || (sectionNum === 1 ? sppd.tempat_berangkat : sectionNum === 2 ? sppd.tempat_tujuan : ''),
      nama_pejabat: existing?.nama_pejabat || '',
      jabatan_pejabat: existing?.jabatan_pejabat || '',
      catatan: existing?.catatan || '',
    });
    setShowRealisasiModal(true);
  };

  // ── Main Render ────────────────────────────────────────────────
  return (
    <div className="page-container page-enter">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-ghost btn-sm mb-2"
            onClick={() => navigate('/sppd')}
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">Detail SPPD</h1>
            <span className={getStatusClass(sppd.status)}>{getStatusLabel(sppd.status)}</span>
          </div>
          <p className="doc-number mt-1 text-slate-500">
            {sppd.nomor_sppd ?? <span className="italic text-slate-400">Belum bernomor (Draft)</span>}
          </p>
        </div>

        {/* ── Action Bar ──────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap items-start">
          {sppd.status === 'Menunggu Persetujuan' && hasRole(['Admin', 'Pejabat']) && (
            <div className="flex gap-2 p-1 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <button
                className="btn btn-success btn-sm"
                onClick={() => setShowApproveModal(true)}
              >
                <CheckCircle size={14} /> Setujui SPPD
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowRejectModal(true)}
              >
                <RotateCcw size={14} /> Tolak/Revisi
              </button>
            </div>
          )}

          {canEdit(sppd.status) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/sppd/${id}/edit`)}
            >
              <Edit size={14} /> Edit
            </button>
          )}

          {canFinalize(sppd.status) && (
            <button
              className="btn btn-success btn-sm"
              disabled={finalizeMutation.isPending}
              onClick={() => finalizeMutation.mutate()}
            >
              <CheckCircle size={14} />
              {finalizeMutation.isPending ? 'Memproses...' : 'Finalisasi'}
            </button>
          )}

          {canPrint(sppd.status) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/print/sppd/${id}`)}
            >
              <Printer size={14} /> Cetak
            </button>
          )}

          {['Final', 'Printed'].includes(sppd.status) && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => setShowCompleteModal(true)}
            >
              <BadgeCheck size={14} /> Tandai Selesai
            </button>
          )}

          {canCreateRevision(sppd.status) && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={cloneRevisionMutation.isPending}
              onClick={() => cloneRevisionMutation.mutate()}
            >
              <RotateCcw size={14} />
              {cloneRevisionMutation.isPending ? 'Menyalin...' : 'Buat Revisi'}
            </button>
          )}

          {canCancel(sppd.status) && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowCancelModal(true)}
            >
              <X size={14} /> Batalkan
            </button>
          )}
        </div>
      </div>

      {/* ── Cancellation notice ────────────────────────────────── */}
      {sppd.status === 'Cancelled' && sppd.alasan_pembatalan && (
        <div className="alert alert-danger mb-6">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Dokumen Dibatalkan</p>
            <p className="text-sm">{sppd.alasan_pembatalan}</p>
            {sppd.cancelled_at && (
              <p className="text-xs opacity-70 mt-1">{formatDatetime(sppd.cancelled_at)}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Identity / Pelaksana Card ────────────────────────── */}
        <div className="card card-hover">
          <SectionHeader icon={<User size={15} />} title="Identitas Pelaksana" />
          <div className="card-body divide-y-0">
            {/* Linked SPT */}
            {sppd.spt && (
              <InfoRow
                icon={<Link2 size={14} />}
                label="Berdasarkan SPT"
                value={
                  <Link
                    to={`/spt/${sppd.spt.id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-semibold doc-number"
                  >
                    {sppd.spt.nomor_spt ?? `SPT #${sppd.spt.id}`}
                  </Link>
                }
              />
            )}

            {sppd.pegawai && (
              <>
                <InfoRow
                  icon={<User size={14} />}
                  label="Nama"
                  value={
                    <div>
                      <p className="font-bold text-slate-900">{formatNamaLengkap(sppd.pegawai)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{sppd.pegawai.jabatan}</p>
                    </div>
                  }
                />
                <InfoRow
                  label="NIP"
                  value={<span className="doc-number">{sppd.pegawai.nip}</span>}
                />
                {(sppd.pegawai.ref_pangkat || sppd.pegawai.ref_golongan) && (
                  <InfoRow
                    label="Pangkat / Golongan"
                    value={
                      [sppd.pegawai.ref_pangkat?.nama, sppd.pegawai.ref_golongan?.nama]
                        .filter(Boolean)
                        .join(' / ') || '—'
                    }
                  />
                )}
                {sppd.pegawai.instansi && (
                  <InfoRow
                    icon={<Building2 size={14} />}
                    label="Unit Kerja"
                    value={sppd.pegawai.instansi.nama_singkat}
                  />
                )}
              </>
            )}

            {sppd.instansi && (
              <InfoRow
                icon={<Building2 size={14} />}
                label="Instansi Penerbit"
                value={
                  <div>
                    <p className="font-semibold">{sppd.instansi.nama_singkat}</p>
                    <p className="text-xs text-slate-500">{sppd.instansi.nama_lengkap}</p>
                  </div>
                }
              />
            )}

            {sppd.penandatangan && (
              <InfoRow
                icon={<User size={14} />}
                label="Penandatangan"
                value={
                  <div>
                    <p className="font-semibold">{formatNamaLengkap(sppd.penandatangan)}</p>
                    <p className="text-xs text-slate-500">{sppd.penandatangan.jabatan}</p>
                    <p className="doc-number text-slate-400 mt-0.5">{sppd.penandatangan.nip}</p>
                  </div>
                }
              />
            )}
          </div>
        </div>

        {/* ── Perjalanan Card ──────────────────────────────────── */}
        <div className="card card-hover">
          <SectionHeader icon={<Plane size={15} />} title="Detail Perjalanan" />
          <div className="card-body divide-y-0">
            {/* Route visual */}
            <div className="py-3 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rute</p>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="flex-1 text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Berangkat dari</p>
                  <p className="font-bold text-slate-800">{sppd.tempat_berangkat}</p>
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <ArrowRight size={14} className="text-blue-600" />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Tujuan</p>
                  <p className="font-bold text-slate-800">{sppd.tempat_tujuan}</p>
                </div>
              </div>
            </div>

            <InfoRow
              icon={<Calendar size={14} />}
              label="Tanggal Berangkat"
              value={formatDateIndonesian(sppd.tanggal_berangkat)}
            />
            <InfoRow
              icon={<Calendar size={14} />}
              label="Tanggal Kembali"
              value={formatDateIndonesian(sppd.tanggal_kembali)}
            />
            <InfoRow
              icon={<Clock size={14} />}
              label="Lama Perjalanan"
              value={<span className="font-bold">{sppd.lama_perjalanan} hari</span>}
            />
            {sppd.alat_angkut && (
              <InfoRow
                icon={<Plane size={14} />}
                label="Alat Angkut"
                value={sppd.alat_angkut}
              />
            )}
            {sppd.tingkat_perjalanan && (
              <InfoRow
                label="Tingkat Perjalanan"
                value={sppd.tingkat_perjalanan}
              />
            )}
            <InfoRow
              icon={<FileText size={14} />}
              label="Maksud Perjalanan"
              value={sppd.maksud_perjalanan}
            />
            {sppd.tanggal_penerbitan && (
              <InfoRow
                label="Tanggal Penerbitan"
                value={formatDateIndonesian(sppd.tanggal_penerbitan)}
              />
            )}
            {sppd.tempat_penerbitan && (
              <InfoRow
                icon={<MapPin size={14} />}
                label="Tempat Penerbitan"
                value={sppd.tempat_penerbitan}
              />
            )}
            <InfoRow
              label="Dibuat"
              value={formatDatetime(sppd.created_at)}
            />
            {sppd.finalized_at && (
              <InfoRow
                label="Difinalisasi"
                value={formatDatetime(sppd.finalized_at)}
              />
            )}
            {sppd.completed_at && (
              <InfoRow
                label="Diselesaikan"
                value={formatDatetime(sppd.completed_at)}
              />
            )}
            {sppd.last_printed_at && (
              <InfoRow
                label="Terakhir Dicetak"
                value={`${formatDatetime(sppd.last_printed_at)} (${sppd.print_count}×)`}
              />
            )}
          </div>
        </div>

        {/* ── Anggaran Card ────────────────────────────────────── */}
        {(sppd.mata_anggaran_rel || sppd.keterangan_lain) && (
          <div className="card card-hover">
            <SectionHeader icon={<Wallet size={15} />} title="Anggaran" />
            <div className="card-body space-y-4">
              {sppd.mata_anggaran_rel && (
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Mata Anggaran
                  </p>
                  <p className="font-bold text-slate-800">{sppd.mata_anggaran_rel.nama}</p>
                  <p className="doc-number text-blue-600 mt-0.5">{sppd.mata_anggaran_rel.kode}</p>
                </div>
              )}
              {sppd.keterangan_lain && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Keterangan Lain
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{sppd.keterangan_lain}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pengikut Table ───────────────────────────────────── */}
        {sortedPengikut.length > 0 && (
          <div className="card card-hover">
            <SectionHeader
              icon={<Users size={15} />}
              title="Pengikut"
              count={sortedPengikut.length}
            />
            <div className="card-body p-0">
              <div className="table-wrap rounded-t-none border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      <th>Nama</th>
                      <th>NIP / Usia</th>
                      <th>Jabatan</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPengikut.map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-center font-mono text-xs text-slate-500">{i + 1}</td>
                        <td className="font-semibold text-slate-800">
                          {p.tipe === 'pegawai' && p.pegawai
                            ? formatNamaLengkap(p.pegawai)
                            : (p.nama ?? '—')}
                        </td>
                        <td>
                          {p.tipe === 'pegawai' && p.pegawai
                            ? <span className="doc-number">{p.pegawai.nip}</span>
                            : p.umur
                              ? `${p.umur} tahun`
                              : '—'}
                        </td>
                        <td>
                          {p.tipe === 'pegawai' && p.pegawai
                            ? p.pegawai.jabatan
                            : '—'}
                        </td>
                        <td>{p.keterangan ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Realisasi Section ────────────────────────────────── */}
        {isFinalOrPrinted && (
          <div className="card card-hover lg:col-span-2">
            <div className="card-header flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle size={15} />
                </div>
                <h3 className="font-bold text-slate-800">Realisasi & Lembar Belakang</h3>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bagian I–IV</p>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((num) => {
                  const data = sppd.sppd_realisasi?.find((r) => r.section === num);
                  return (
                    <div key={num} className={`group relative p-4 rounded-2xl border-2 transition-all ${data ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-200 dashed'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center ${data ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {num === 1 ? 'I' : num === 2 ? 'II' : num === 3 ? 'III' : 'IV'}
                          </span>
                          <p className="font-bold text-slate-700 text-xs uppercase tracking-tight">
                            {SECTION_LABELS[num]}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenRealisasi(num)}
                          className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Edit size={12} />
                        </button>
                      </div>

                      {data ? (
                        <div className="space-y-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Waktu & Lokasi</span>
                            <p className="text-xs font-semibold text-slate-700">
                              {data.tanggal ? formatDateIndonesian(data.tanggal) : '—'} 
                              <br />
                              <span className="text-slate-500 font-normal">{data.lokasi || '—'}</span>
                            </p>
                          </div>
                          {data.nama_pejabat && (
                            <div className="flex flex-col pt-1 border-t border-slate-50">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Pengesah</span>
                              <p className="text-[11px] font-bold text-slate-700 truncate">{data.nama_pejabat}</p>
                              <p className="text-[10px] text-slate-500 truncate">{data.jabatan_pejabat}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 cursor-pointer" onClick={() => handleOpenRealisasi(num)}>
                          <div className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-400 mb-2">
                            <Plus size={14} />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Isi Data</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Approval / History Log ───────────────────────────── */}
        <div className="card card-hover lg:col-span-2">
          <SectionHeader
            icon={<History size={15} />}
            title="Riwayat Persetujuan"
            count={approvalLogs.length}
          />
          <div className="card-body">
            {approvalLogs.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400">Belum ada riwayat persetujuan</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3.5 top-4 bottom-4 w-0.5 bg-slate-100" />
                <div className="space-y-4">
                  {approvalLogs.map((log, i) => (
                    <div key={log.id} className="flex gap-4 relative">
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 ${ACTION_COLORS[log.action] ?? 'bg-slate-400'}`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="bg-slate-50 rounded-xl p-3.5">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">
                                {ACTION_LABELS[log.action] ?? log.action}
                              </p>
                              {log.approver?.nama_lengkap && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  oleh{' '}
                                  <span className="font-medium text-slate-700">
                                    {log.approver.nama_lengkap}
                                  </span>{' '}
                                  (Level {log.level})
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 whitespace-nowrap">
                              {formatDatetime(log.created_at)}
                            </p>
                          </div>
                          {log.komentar && (
                            <p className="text-xs text-slate-600 mt-2 italic border-t border-slate-200 pt-2">
                              "{log.komentar}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tandai Selesai Modal ─────────────────────────────────── */}
      {showCompleteModal && (
        <div className="modal-backdrop" onClick={() => setShowCompleteModal(false)}>
          <div className="modal-panel modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Tandai SPPD Selesai</h2>
              <button
                className="btn-icon btn-ghost"
                onClick={() => setShowCompleteModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="alert alert-info">
                <CheckCircle size={16} className="flex-shrink-0" />
                <p>
                  Konfirmasi bahwa perjalanan dinas telah selesai dilaksanakan. Status dokumen
                  akan berubah menjadi <strong>Selesai</strong>.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl space-y-1.5">
                <p className="text-xs text-slate-500">Pelaksana</p>
                <p className="font-semibold text-slate-800">{formatNamaLengkap(sppd.pegawai)}</p>
                <p className="text-sm text-slate-600">
                  {sppd.tempat_berangkat} → {sppd.tempat_tujuan}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateIndonesian(sppd.tanggal_berangkat)} — {formatDateIndonesian(sppd.tanggal_kembali)}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCompleteModal(false)}
              >
                Batal
              </button>
              <button
                className="btn btn-success"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
              >
                <CheckCircle size={14} />
                {completeMutation.isPending ? 'Memproses...' : 'Tandai Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ─────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelModal(false)}>
          <div className="modal-panel modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Batalkan SPPD</h2>
              <button
                className="btn-icon btn-ghost"
                onClick={() => setShowCancelModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="alert alert-warning">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <p>Pembatalan SPPD tidak dapat diurungkan. Pastikan Anda memiliki alasan yang valid.</p>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Alasan Pembatalan <span className="required-mark">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan alasan pembatalan SPPD ini..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCancelModal(false);
                  setAlasan('');
                }}
              >
                Tutup
              </button>
              <button
                className="btn btn-danger"
                disabled={!alasan.trim() || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? 'Memproses...' : 'Batalkan SPPD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Realisasi Modal ────────────────────────────────────────── */}
      {showRealisasiModal && (
        <div className="modal-backdrop" onClick={() => setShowRealisasiModal(false)}>
          <div className="modal-panel modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                  {selectedSection === 1 ? 'I' : selectedSection === 2 ? 'II' : selectedSection === 3 ? 'III' : 'IV'}
                </span>
                Edit Data Realisasi
              </h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowRealisasiModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                {SECTION_LABELS[selectedSection!] ?? ''}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    className="form-input"
                    value={realisasiForm.tanggal}
                    onChange={(e) => setRealisasiForm({ ...realisasiForm, tanggal: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Lokasi</label>
                  <input
                    type="text"
                    className="form-input"
                    value={realisasiForm.lokasi}
                    onChange={(e) => setRealisasiForm({ ...realisasiForm, lokasi: e.target.value })}
                    placeholder="Nama Kota/Tempat"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Pejabat (Lokasi)</label>
                <input
                  type="text"
                  className="form-input"
                  value={realisasiForm.nama_pejabat}
                  onChange={(e) => setRealisasiForm({ ...realisasiForm, nama_pejabat: e.target.value })}
                  placeholder="Nama Lengkap Pejabat"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Jabatan</label>
                <input
                  type="text"
                  className="form-input"
                  value={realisasiForm.jabatan_pejabat}
                  onChange={(e) => setRealisasiForm({ ...realisasiForm, jabatan_pejabat: e.target.value })}
                  placeholder="Contoh: Kepala Dinas / Kabag Umum"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Catatan</label>
                <textarea
                  className="form-textarea"
                  value={realisasiForm.catatan}
                  onChange={(e) => setRealisasiForm({ ...realisasiForm, catatan: e.target.value })}
                  rows={2}
                  placeholder="Tambahkan catatan jika diperlukan..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRealisasiModal(false)}>
                Batal
              </button>
              <button
                className="btn btn-primary"
                disabled={saveRealisasiMutation.isPending}
                onClick={() => saveRealisasiMutation.mutate()}
              >
                {saveRealisasiMutation.isPending ? 'Menyimpan...' : 'Simpan Realisasi'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Approve Modal ────────────────────────────────────────── */}
      {showApproveModal && (
        <div className="modal-backdrop" onClick={() => setShowApproveModal(false)}>
          <div className="modal-panel modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={18} />
                Setujui Dokumen
              </h2>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-slate-600">
                Persetujuan ini akan secara otomatis menerbitkan <strong>Nomor SPPD Resmi</strong> dan memfinalisasi dokumen.
              </p>
              <div className="form-group">
                <label className="form-label text-xs">Catatan Opsional</label>
                <textarea
                  className="form-textarea"
                  value={komentar}
                  onChange={(e) => setKomentar(e.target.value)}
                  placeholder="Contoh: Dokumen sesuai, silakan dilanjutkan."
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>
                Batal
              </button>
              <button
                className="btn btn-success"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? 'Memproses...' : 'Setujui & Terbitkan Nomor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal-panel modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title flex items-center gap-2">
                <RotateCcw className="text-rose-500" size={18} />
                Tolak / Minta Revisi
              </h2>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-slate-600">
                Dokumen akan dikembalikan ke status <strong>Draft</strong> agar operator dapat melakukan perbaikan.
              </p>
              <div className="form-group">
                <label className="form-label text-xs">Alasan Penolakan <span className="required-mark">*</span></label>
                <textarea
                  className="form-textarea"
                  value={komentar}
                  onChange={(e) => setKomentar(e.target.value)}
                  placeholder="Jelaskan alasan penolakan atau bagian yang perlu direvisi..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                Batal
              </button>
              <button
                className="btn btn-danger"
                disabled={!komentar.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                {rejectMutation.isPending ? 'Memproses...' : 'Tolak & Kembalikan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
