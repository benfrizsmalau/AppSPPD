// =================================================================
// SiSPPD v2.1 — SPT Detail (Module 05-A)
// =================================================================
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Printer,
  Edit,
  X,
  RotateCcw,
  Plus,
  CheckCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Building2,
  User,
  Clock,
  FileText,
  ListChecks,
  Users,
  Wallet,
  History,
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
  canCreateSPPD,
  canCreateRevision,
} from '../lib/utils';
import { toast } from 'sonner';
import type { SPT, SPTPegawai, ApprovalLog, DocumentStatus } from '../types';

// ─── Local extended types for joined data ─────────────────────────
interface SPTDetail extends Omit<SPT, 'spt_pegawai'> {
  spt_pegawai?: (SPTPegawai & {
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
    };
  })[];
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

// ─── Loading Skeleton ─────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="page-container page-enter">
    <div className="page-header">
      <div className="space-y-2">
        <div className="skeleton h-6 w-20 rounded-lg" />
        <div className="skeleton h-8 w-64 rounded-xl" />
        <div className="skeleton h-4 w-48 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-20 rounded-xl" />
        <div className="skeleton h-9 w-24 rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-48 rounded-2xl lg:col-span-2" />
      <div className="skeleton h-40 rounded-2xl lg:col-span-2" />
    </div>
  </div>
);

// ─── Info Row ─────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({
  label, value, icon,
}) => (
  <div className="flex gap-3 py-3 border-b border-slate-50 last:border-0">
    {icon && (
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 mt-0.5">
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-400">—</span>}</div>
    </div>
  </div>
);

// ─── Section Header ───────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; count?: number }> = ({
  icon, title, count,
}) => (
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
export default function SPTDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId, hasRole } = useAuth();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [komentar, setKomentar] = useState('');
  const [alasan, setAlasan] = useState('');

  // ── Data Fetching ──────────────────────────────────────────────
  const {
    data: spt,
    isLoading,
    isError,
  } = useQuery<SPTDetail>({
    queryKey: ['spt', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spt')
        .select(
          '*, instansi(*), penandatangan:penandatangan_id(*), mata_anggaran(*), spt_pegawai(*, pegawai(*, ref_pangkat(*), ref_golongan(*), instansi(*)))'
        )
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as SPTDetail;
    },
    enabled: !!id,
  });

  const {
    data: approvalLogs = [],
  } = useQuery<ApprovalLogRow[]>({
    queryKey: ['approval_log', 'spt', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_log')
        .select('*, approver:approver_id(nama_lengkap)')
        .eq('dokumen_id', Number(id))
        .eq('jenis_dokumen', 'SPT')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ApprovalLogRow[];
    },
    enabled: !!id,
  });

  // ── Mutations ──────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !spt) throw new Error('Data tidak lengkap');

      // 1. Get next number if not currently numbered
      let nomor = spt.nomor_spt;
      if (!nomor) {
        const { data: nextNo, error: noErr } = await supabase.rpc(
          'get_next_document_number',
          { p_tenant_id: tenantId, p_jenis: 'SPT' }
        );
        if (noErr) throw noErr;
        nomor = nextNo as string;
      }

      // 2. Update SPT Status
      const { error: updateErr } = await supabase
        .from('spt')
        .update({
          status: 'Final' as DocumentStatus,
          nomor_spt: nomor,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (updateErr) throw updateErr;

      // 3. Log to approval_log
      const { error: logErr } = await supabase.from('approval_log').insert({
        tenant_id: tenantId,
        dokumen_id: Number(id),
        jenis_dokumen: 'SPT',
        level: 1, // Simplified for now
        approver_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'APPROVE',
        komentar: komentar || 'Disetujui melalui sistem.',
      });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      toast.success('SPT Berhasil Disetujui & Difinalisasi');
      queryClient.invalidateQueries({ queryKey: ['spt'] });
      queryClient.invalidateQueries({ queryKey: ['approval_log'] });
      setShowApproveModal(false);
      setKomentar('');
    },
    onError: (err: any) => toast.error('Gagal menyetujui: ' + err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant tidak ditemukan');

      // 1. Update SPT Status back to Draft
      const { error: updateErr } = await supabase
        .from('spt')
        .update({ status: 'Draft' as DocumentStatus })
        .eq('id', id!);
      if (updateErr) throw updateErr;

      // 2. Log to approval_log
      const { error: logErr } = await supabase.from('approval_log').insert({
        tenant_id: tenantId,
        dokumen_id: Number(id),
        jenis_dokumen: 'SPT',
        level: 1,
        approver_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'REJECT',
        komentar: komentar || 'Ditolak/revisi oleh Pejabat.',
      });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      toast.info('SPT Ditolak (Kembali ke Draft)');
      queryClient.invalidateQueries({ queryKey: ['spt'] });
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
        { p_tenant_id: tenantId, p_jenis: 'SPT' }
      );
      if (nomorError) throw new Error('Gagal mendapatkan nomor dokumen: ' + nomorError.message);

      const { error } = await supabase
        .from('spt')
        .update({
          status: 'Final' as DocumentStatus,
          nomor_spt: nomor as string,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SPT berhasil difinalisasi');
      queryClient.invalidateQueries({ queryKey: ['spt'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal memfinalisasi SPT'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('spt')
        .update({
          status: 'Cancelled' as DocumentStatus,
          alasan_pembatalan: alasan,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SPT berhasil dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['spt'] });
      setShowCancelModal(false);
      setAlasan('');
    },
    onError: () => toast.error('Gagal membatalkan SPT'),
  });

  const cloneRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!spt || !tenantId) throw new Error('Data tidak lengkap');

      // Clone as new draft with parent_spt_id reference
      const { spt_pegawai, penandatangan, instansi, mata_anggaran, ...base } = spt;

      const { data: newSpt, error } = await supabase
        .from('spt')
        .insert({
          tenant_id: tenantId,
          tanggal_penetapan: base.tanggal_penetapan,
          tempat_penetapan: base.tempat_penetapan,
          dasar_perintah: base.dasar_perintah,
          tujuan_kegiatan: base.tujuan_kegiatan,
          lama_kegiatan: base.lama_kegiatan,
          pembebanan_anggaran: base.pembebanan_anggaran,
          mata_anggaran_id: base.mata_anggaran_id,
          penandatangan_id: base.penandatangan_id,
          instansi_id: base.instansi_id,
          catatan: base.catatan,
          parent_spt_id: base.id,
          status: 'Draft' as DocumentStatus,
          print_count: 0,
        })
        .select()
        .single();
      if (error) throw error;

      // Copy pegawai list
      if (spt_pegawai && spt_pegawai.length > 0 && newSpt) {
        const rows = spt_pegawai.map((sp) => ({
          spt_id: (newSpt as { id: number }).id,
          pegawai_id: sp.pegawai_id,
          urutan: sp.urutan,
        }));
        const { error: pegErr } = await supabase.from('spt_pegawai').insert(rows);
        if (pegErr) throw pegErr;
      }

      return (newSpt as { id: number }).id;
    },
    onSuccess: (newId) => {
      toast.success('Revisi SPT berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['spt'] });
      navigate(`/spt/${newId}`);
    },
    onError: () => toast.error('Gagal membuat revisi SPT'),
  });

  // ── Render States ──────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;

  if (isError || !spt) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-rose-400" />
          </div>
          <p className="empty-state-title">SPT Tidak Ditemukan</p>
          <p className="empty-state-desc">
            Dokumen yang Anda cari tidak tersedia atau telah dihapus.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/spt')}>
            <ArrowLeft size={14} /> Kembali ke Daftar SPT
          </button>
        </div>
      </div>
    );
  }

  const sortedPegawai = [...(spt.spt_pegawai ?? [])].sort((a, b) => a.urutan - b.urutan);

  // ── Main Render ────────────────────────────────────────────────
  return (
    <div className="page-container page-enter">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-ghost btn-sm mb-2"
            onClick={() => navigate('/spt')}
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">Detail SPT</h1>
            <span className={getStatusClass(spt.status)}>{getStatusLabel(spt.status)}</span>
          </div>
          <p className="doc-number mt-1 text-slate-500">
            {spt.nomor_spt ?? (
              <span className="italic text-slate-400">
                DRAFT-{spt.tanggal_penetapan?.replace(/-/g, '') || '________'}
              </span>
            )}
          </p>
        </div>

        {/* ── Action Bar ──────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap items-start">
          {spt.status === 'Menunggu Persetujuan' && hasRole(['Admin', 'Pejabat']) && (
            <div className="flex gap-2 p-1 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <button
                className="btn btn-success btn-sm"
                onClick={() => setShowApproveModal(true)}
              >
                <CheckCircle size={14} /> Setujui SPT
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowRejectModal(true)}
              >
                <RotateCcw size={14} /> Tolak/Revisi
              </button>
            </div>
          )}

          {canEdit(spt.status) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/spt/edit/${id}`)}
            >
              <Edit size={14} /> Edit
            </button>
          )}

          {canFinalize(spt.status) && (
            <button
              className="btn btn-success btn-sm"
              disabled={finalizeMutation.isPending}
              onClick={() => finalizeMutation.mutate()}
            >
              <CheckCircle size={14} />
              {finalizeMutation.isPending ? 'Memproses...' : 'Finalisasi'}
            </button>
          )}

          {canPrint(spt.status) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/print/spt/${id}`)}
            >
              <Printer size={14} /> Cetak
            </button>
          )}

          {canCreateSPPD(spt.status) && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => navigate(`/sppd/new?spt_id=${id}`)}
            >
              <Plus size={14} /> Buat SPPD
            </button>
          )}

          {canCreateRevision(spt.status) && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={cloneRevisionMutation.isPending}
              onClick={() => cloneRevisionMutation.mutate()}
            >
              <RotateCcw size={14} />
              {cloneRevisionMutation.isPending ? 'Menyalin...' : 'Buat Revisi'}
            </button>
          )}

          {canCancel(spt.status) && (
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
      {spt.status === 'Cancelled' && spt.alasan_pembatalan && (
        <div className="alert alert-danger mb-6 flex items-start gap-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Dokumen Dibatalkan</p>
            <p className="text-sm">{spt.alasan_pembatalan}</p>
            {spt.cancelled_at && (
              <p className="text-xs opacity-70 mt-1">{formatDatetime(spt.cancelled_at)}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Document Info Card ──────────────────────────────── */}
        <div className="card card-hover">
          <SectionHeader icon={<FileText size={15} />} title="Informasi Dokumen" />
          <div className="card-body divide-y-0">
            <InfoRow
              icon={<Calendar size={14} />}
              label="Tanggal Penetapan"
              value={formatDateIndonesian(spt.tanggal_penetapan)}
            />
            <InfoRow
              icon={<MapPin size={14} />}
              label="Tempat Penetapan"
              value={spt.tempat_penetapan}
            />
            {spt.instansi && (
              <InfoRow
                icon={<Building2 size={14} />}
                label="Instansi"
                value={
                  <div>
                    <span className="font-semibold">{spt.instansi.nama_singkat}</span>
                    <span className="text-slate-500 ml-1.5 text-xs">— {spt.instansi.nama_lengkap}</span>
                  </div>
                }
              />
            )}
            <InfoRow
              icon={<Clock size={14} />}
              label="Lama Kegiatan"
              value={`${spt.lama_kegiatan} hari`}
            />
            {spt.penandatangan && (
              <InfoRow
                icon={<User size={14} />}
                label="Penandatangan"
                value={
                  <div>
                    <p className="font-semibold">{formatNamaLengkap(spt.penandatangan)}</p>
                    <p className="text-xs text-slate-500">{spt.penandatangan.jabatan}</p>
                    {spt.penandatangan.nip && (
                      <p className="doc-number text-slate-400 mt-0.5">{spt.penandatangan.nip}</p>
                    )}
                  </div>
                }
              />
            )}
            <InfoRow
              label="Dibuat"
              value={formatDatetime(spt.created_at)}
            />
            <InfoRow
              label="Diperbarui"
              value={formatDatetime(spt.updated_at)}
            />
            {spt.finalized_at && (
              <InfoRow
                label="Difinalisasi"
                value={formatDatetime(spt.finalized_at)}
              />
            )}
            {spt.last_printed_at && (
              <InfoRow
                label="Terakhir Dicetak"
                value={`${formatDatetime(spt.last_printed_at)} (${spt.print_count}×)`}
              />
            )}
          </div>
        </div>

        {/* ── Dasar Perintah + Tujuan Kegiatan ────────────────── */}
        <div className="card card-hover">
          <SectionHeader icon={<ListChecks size={15} />} title="Tujuan & Dasar Perintah" />
          <div className="card-body space-y-5">
            {/* Tujuan */}
            <div>
              <p className="form-label mb-2">Tujuan Kegiatan</p>
              {spt.tujuan_kegiatan?.length ? (
                <ol className="space-y-1.5">
                  {spt.tujuan_kegiatan.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-400 italic">Tidak ada tujuan kegiatan</p>
              )}
            </div>

            {/* Dasar Perintah */}
            {(spt.dasar_perintah?.length ?? 0) > 0 && (
              <div>
                <p className="form-label mb-2">Dasar Perintah</p>
                <div className="space-y-2">
                  {spt.dasar_perintah.map((d, i) => {
                    const jenis = d.jenis ?? 'surat';
                    const badgeColor =
                      jenis === 'surat'   ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      jenis === 'lisan'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-slate-50 text-slate-600 border-slate-200';
                    const badgeLabel =
                      jenis === 'surat'   ? 'Surat Resmi' :
                      jenis === 'lisan'   ? 'Perintah Lisan' : 'Lainnya';
                    return (
                      <div key={d.id ?? i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <span className={`mt-0.5 flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          {jenis === 'surat' && d.nomor && (
                            <p className="text-xs font-mono text-slate-500 mb-0.5">
                              {d.nomor} &bull; {formatDateIndonesian(d.tanggal ?? '')}
                            </p>
                          )}
                          <p className="text-sm text-slate-800">{d.perihal}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Pelaksana Table ──────────────────────────────────── */}
        <div className="card card-hover lg:col-span-2">
          <SectionHeader
            icon={<Users size={15} />}
            title="Pelaksana Tugas"
            count={sortedPegawai.length}
          />
          <div className="card-body p-0">
            {sortedPegawai.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">Belum ada pelaksana ditambahkan</p>
              </div>
            ) : (
              <div className="table-wrap rounded-t-none border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      <th>Nama Lengkap</th>
                      <th>NIP</th>
                      <th>Jabatan</th>
                      <th>Pangkat / Golongan</th>
                      <th>Unit Kerja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPegawai.map((sp, i) => (
                      <tr key={sp.id}>
                        <td className="text-center font-mono text-xs text-slate-500">{i + 1}</td>
                        <td className="font-semibold text-slate-800">
                          {sp.pegawai
                            ? formatNamaLengkap(sp.pegawai)
                            : <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td>
                          <span className="doc-number text-slate-600">{sp.pegawai?.nip ?? '—'}</span>
                        </td>
                        <td>{sp.pegawai?.jabatan ?? '—'}</td>
                        <td>
                          {sp.pegawai?.ref_pangkat?.nama && sp.pegawai?.ref_golongan?.nama
                            ? `${sp.pegawai.ref_pangkat.nama} / ${sp.pegawai.ref_golongan.nama}`
                            : sp.pegawai?.ref_pangkat?.nama
                              ?? sp.pegawai?.ref_golongan?.nama
                              ?? '—'}
                        </td>
                        <td>{sp.pegawai?.instansi?.nama_singkat ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Pembebanan Anggaran ──────────────────────────────── */}
        {(spt.pembebanan_anggaran || spt.mata_anggaran) && (
          <div className="card card-hover lg:col-span-2">
            <SectionHeader icon={<Wallet size={15} />} title="Pembebanan Anggaran" />
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {spt.pembebanan_anggaran && (
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Pembebanan Anggaran
                    </p>
                    <p className="text-sm font-medium text-slate-800">{spt.pembebanan_anggaran}</p>
                  </div>
                )}
                {spt.mata_anggaran && (
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Mata Anggaran
                    </p>
                    <p className="text-sm font-bold text-slate-800">{spt.mata_anggaran.nama}</p>
                    <p className="doc-number text-blue-600 mt-0.5">{spt.mata_anggaran.kode}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Catatan ──────────────────────────────────────────── */}
        {spt.catatan && (
          <div className="card card-hover lg:col-span-2">
            <SectionHeader icon={<FileText size={15} />} title="Catatan" />
            <div className="card-body">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{spt.catatan}</p>
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
                      {/* Dot */}
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 ${ACTION_COLORS[log.action] ?? 'bg-slate-400'}`}
                      >
                        {i + 1}
                      </div>
                      {/* Content */}
                      <div className="flex-1 pb-1">
                        <div className="bg-slate-50 rounded-xl p-3.5">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">
                                {ACTION_LABELS[log.action] ?? log.action}
                              </p>
                              {log.approver?.nama_lengkap && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  oleh <span className="font-medium text-slate-700">{log.approver.nama_lengkap}</span>
                                  {' '}(Level {log.level})
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

      {/* ── Cancel Modal ─────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelModal(false)}>
          <div className="modal-panel modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Batalkan SPT</h2>
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
                <p>Pembatalan SPT tidak dapat diurungkan. Pastikan Anda memiliki alasan yang valid.</p>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Alasan Pembatalan <span className="required-mark">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan alasan pembatalan SPT ini..."
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
                {cancelMutation.isPending ? 'Memproses...' : 'Batalkan SPT'}
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
                Persetujuan ini akan secara otomatis menerbitkan <strong>Nomor SPT Resmi</strong> dan memfinalisasi dokumen.
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
