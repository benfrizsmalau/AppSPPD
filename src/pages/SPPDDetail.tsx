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
interface SPPDDetail extends Omit<SPPD, 'sppd_pengikut' | 'pegawai' | 'instansi' | 'penandatangan' | 'spt'> {
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
  const { tenantId } = useAuth();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [alasan, setAlasan] = useState('');

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
        .select(
          '*, spt(*), pegawai(*, ref_pangkat(*), ref_golongan(*), instansi(*)), instansi(*), penandatangan:penandatangan_id(*), sppd_pengikut(*), sppd_realisasi(*), mata_anggaran_rel:mata_anggaran_id(*)'
        )
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
  const sortedRealisasi = [...(sppd.sppd_realisasi ?? [])].sort((a, b) => a.section - b.section);
  const isCompleted = sppd.status === 'Completed';

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

        {/* ── Realisasi Section (Completed) ───────────────────── */}
        {isCompleted && (
          <div className="card card-hover lg:col-span-2">
            <SectionHeader
              icon={<CheckCircle size={15} />}
              title="Realisasi Perjalanan"
              count={sortedRealisasi.length}
            />
            <div className="card-body">
              {sortedRealisasi.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-400">Belum ada data realisasi tercatat</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sortedRealisasi.map((r) => (
                    <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                          {r.section}
                        </span>
                        <p className="font-semibold text-slate-700 text-sm">
                          {SECTION_LABELS[r.section] ?? `Bagian ${r.section}`}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {r.tanggal && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-400 w-20 flex-shrink-0">Tanggal</span>
                            <span className="font-medium text-slate-700">{formatDateIndonesian(r.tanggal)}</span>
                          </div>
                        )}
                        {r.lokasi && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-400 w-20 flex-shrink-0">Lokasi</span>
                            <span className="font-medium text-slate-700">{r.lokasi}</span>
                          </div>
                        )}
                        {r.nama_pejabat && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-400 w-20 flex-shrink-0">Pejabat</span>
                            <div>
                              <p className="font-medium text-slate-700">{r.nama_pejabat}</p>
                              {r.jabatan_pejabat && (
                                <p className="text-slate-400">{r.jabatan_pejabat}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {r.catatan && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-400 w-20 flex-shrink-0">Catatan</span>
                            <span className="text-slate-700 italic">{r.catatan}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
    </div>
  );
}
