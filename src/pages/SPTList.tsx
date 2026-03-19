// =================================================================
// SiSPPD v2.1 — SPT List (Module 04)
// =================================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Edit2,
  Printer,
  Plane,
  Ban,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Calendar,
  X,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { SPT, DocumentStatus, PaginatedResult } from '../types';

// ─── Constants ───────────────────────────────────────────────────
const PAGE_SIZE = 25;

type StatusFilter = 'All' | DocumentStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Semua', value: 'All' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Menunggu Persetujuan', value: 'Menunggu Persetujuan' },
  { label: 'Final', value: 'Final' },
  { label: 'Dicetak', value: 'Printed' },
  { label: 'Selesai', value: 'Completed' },
  { label: 'Dibatalkan', value: 'Cancelled' },
];

// ─── Sub-components ───────────────────────────────────────────────

const StatusBadge: React.FC<{ status: DocumentStatus }> = ({ status }) => {
  const glowClass = status === 'Final' || status === 'Printed' || status === 'Completed' 
    ? 'status-final-glow' 
    : status === 'Menunggu Persetujuan' 
    ? 'status-pending-glow' 
    : 'status-draft-glow';
    
  return (
    <span className={`badge-glow ${glowClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
};

const SkeletonRow: React.FC = () => (
  <tr>
    {[40, 160, 110, 200, 80, 60, 80].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="skeleton h-4 rounded" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ─── Confirm Delete Modal ─────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  spt: SPT | null;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

const ConfirmCancelModal: React.FC<ConfirmModalProps> = ({
  open, spt, onCancel, onConfirm, isPending,
}) => {
  if (!open || !spt) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Batalkan SPT</h2>
          <button className="btn btn-ghost btn-sm p-1" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-rose-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">
                Apakah Anda yakin ingin membatalkan SPT ini?
              </p>
              <p className="text-sm text-slate-500">
                Dokumen{' '}
                <span className="font-mono text-slate-700">{spt.nomor_spt ?? `#${spt.id}`}</span>{' '}
                akan ditandai sebagai <strong>Dibatalkan</strong>. Tindakan ini tidak dapat diurungkan.
              </p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={isPending}>
            Batal
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Memproses…
              </span>
            ) : (
              <>
                <Ban size={16} /> Ya, Batalkan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Row Actions Dropdown ─────────────────────────────────────────
interface RowActionsProps {
  spt: SPT;
  onView: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onBuatSPPD: () => void;
  onCancel: () => void;
  onRevise: () => void;
}

const RowActions: React.FC<RowActionsProps> = ({
  spt, onView, onEdit, onPrint, onBuatSPPD, onCancel, onRevise,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isDraft = spt.status === 'Draft';
  const isFinal = spt.status === 'Final';
  const isActive = spt.status !== 'Cancelled' && spt.status !== 'Completed';
  const canRevise = spt.status === 'Final' || spt.status === 'Cancelled';

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-secondary btn-sm gap-1"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >
        Aksi <ChevronDown size={13} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-100 shadow-lg z-30 w-44 py-1 dropdown-enter"
          onClick={e => e.stopPropagation()}
        >
          <ActionItem icon={<Eye size={14} />} label="Lihat" onClick={() => { setOpen(false); onView(); }} />
          {isDraft && (
            <ActionItem icon={<Edit2 size={14} />} label="Edit" onClick={() => { setOpen(false); onEdit(); }} />
          )}
          <ActionItem icon={<Printer size={14} />} label="Cetak" onClick={() => { setOpen(false); onPrint(); }} />
          {isFinal && (
            <ActionItem
              icon={<Plane size={14} />}
              label="Buat SPPD"
              onClick={() => { setOpen(false); onBuatSPPD(); }}
              className="text-violet-700 hover:bg-violet-50"
            />
          )}
          {canRevise && (
            <ActionItem
              icon={<RefreshCw size={14} />}
              label="Buat Revisi"
              onClick={() => { setOpen(false); onRevise(); }}
              className="text-amber-700 hover:bg-amber-50"
            />
          )}
          {isActive && spt.status !== 'Printed' && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <ActionItem
                icon={<Ban size={14} />}
                label="Batalkan"
                onClick={() => { setOpen(false); onCancel(); }}
                className="text-rose-600 hover:bg-rose-50"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ActionItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}> = ({ icon, label, onClick, className = 'text-slate-700 hover:bg-slate-50' }) => (
  <button
    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium transition-colors duration-100 ${className}`}
    onClick={onClick}
  >
    {icon} {label}
  </button>
);

// ─── Main SPTList Component ───────────────────────────────────────
const SPTList: React.FC = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State ──────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialStatus = (searchParams.get('status') as StatusFilter) ?? 'All';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<SPT | null>(null);

  // 300ms debounce on search
  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ── Data Fetching ──────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery<PaginatedResult<SPT>>({
    queryKey: ['spt-list', tenantId, debouncedSearch, statusFilter, startDate, endDate, page],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');

      let query = supabase
        .from('spt')
        .select(
          `id, nomor_spt, tanggal_penetapan, tempat_penetapan, tujuan_kegiatan,
           status, created_at, lama_kegiatan, pembebanan_anggaran,
           spt_pegawai:spt_pegawai(id, pegawai_id, urutan, pegawai:pegawai(id, nama_lengkap, jabatan))`,
          { count: 'exact' }
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }
      if (debouncedSearch) {
        query = query.or(
          `nomor_spt.ilike.%${debouncedSearch}%,tujuan_kegiatan.cs.{${debouncedSearch}},tempat_penetapan.ilike.%${debouncedSearch}%`
        );
      }
      if (startDate) query = query.gte('tanggal_penetapan', startDate);
      if (endDate)   query = query.lte('tanggal_penetapan', endDate);

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      const total = count ?? 0;
      return {
        data: (data ?? []) as unknown as SPT[],
        total,
        page,
        limit: PAGE_SIZE,
        total_pages: Math.ceil(total / PAGE_SIZE),
      };
    },
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });

  // Status counts query
  const { data: statusCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['spt-status-counts', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await supabase
        .from('spt')
        .select('status')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      const counts: Record<string, number> = { All: data?.length ?? 0 };
      (data ?? []).forEach(r => {
        counts[r.status] = (counts[r.status] ?? 0) + 1;
      });
      return counts;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // ── Mutations ──────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('spt')
        .update({
          status: 'Cancelled' as DocumentStatus,
          cancelled_at: new Date().toISOString(),
          alasan_pembatalan: 'Dibatalkan oleh operator.',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('SPT berhasil dibatalkan.');
      queryClient.invalidateQueries({ queryKey: ['spt-list'] });
      queryClient.invalidateQueries({ queryKey: ['spt-status-counts'] });
      setCancelTarget(null);
    },
    onError: (e: Error) => {
      toast.error(`Gagal membatalkan: ${e.message}`);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleStatusFilter = (s: StatusFilter) => {
    setStatusFilter(s);
    setPage(1);
    setSearchParams(s !== 'All' ? { status: s } : {}, { replace: true });
  };

  const sptList = data?.data ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalCount = data?.total ?? 0;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page-enter flex flex-col gap-5">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="premium-header">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-4 ring-white/50">
                <FileText size={28} className="text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight">Surat Perintah Tugas</h1>
            </div>
            <p className="max-w-md font-medium">
              Manajemen dokumen penugasan pegawai dengan sistem penomoran otomatis dan integrasi real-time.
            </p>
          </div>
          <Link 
            to="/spt/new" 
            className="btn btn-primary h-14 px-8 rounded-2xl shadow-xl shadow-blue-500/25 flex items-center gap-3 group transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
              <Plus size={20} className="text-white" />
            </div>
            <span className="font-bold text-lg">Tambah SPT</span>
          </Link>
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickStatCard 
          label="Total SPT" 
          value={statusCounts.All || 0} 
          icon={<FileText size={18} />} 
          color="blue" 
        />
        <QuickStatCard 
          label="Menunggu" 
          value={statusCounts['Menunggu Persetujuan'] || 0} 
          icon={<AlertTriangle size={18} />} 
          color="amber" 
        />
        <QuickStatCard 
          label="Selesai" 
          value={(statusCounts.Final || 0) + (statusCounts.Printed || 0)} 
          icon={<RefreshCw size={18} />} 
          color="emerald" 
        />
        <QuickStatCard 
          label="Draft" 
          value={statusCounts.Draft || 0} 
          icon={<Edit2 size={18} />} 
          color="slate" 
        />
      </div>

      {/* ── Status Filter Chips ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`chip ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => handleStatusFilter(f.value)}
          >
            {f.label}
            {statusCounts[f.value] !== undefined && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold
                ${statusFilter === f.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {statusCounts[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search & Date Filters ────────────────────────────── */}
      <div className="bg-white/50 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center shadow-sm">
        <div className="search-wrap flex-1 min-w-0 bg-white shadow-inner border-slate-100 h-11">
          <Search size={18} className="search-icon text-slate-400" />
          <input
            type="text"
            className="search-input text-sm h-full"
            placeholder="Cari nomor SPT, tujuan atau lokasi…"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 h-11 rounded-xl border border-slate-100 shadow-inner">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              className="bg-transparent border-none focus:ring-0 text-xs font-semibold text-slate-700 w-32"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
            />
            <span className="text-slate-300">—</span>
            <input
              type="date"
              className="bg-transparent border-none focus:ring-0 text-xs font-semibold text-slate-700 w-32"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>
          
          <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1" />
          
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {STATUS_FILTERS.slice(0, 4).map(f => (
              <button
                key={f.value}
                className={`px-4 h-9 rounded-xl text-xs font-bold transition-all
                  ${statusFilter === f.value 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'bg-white text-slate-600 border border-slate-100 hover:border-blue-200'}`}
                onClick={() => handleStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="premium-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10">No</th>
              <th>Nomor SPT</th>
              <th>Tanggal</th>
              <th>Tujuan Kegiatan</th>
              <th className="text-center">Pelaksana</th>
              <th>Status</th>
              <th className="text-right pr-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : sptList.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <FileText size={40} className="text-slate-200 mb-3" />
                    <p className="empty-state-title">Tidak ada data SPT</p>
                    <p className="empty-state-desc">
                      {debouncedSearch || statusFilter !== 'All'
                        ? 'Tidak ada SPT yang sesuai dengan filter saat ini.'
                        : 'Mulai buat SPT pertama untuk instansi Anda.'}
                    </p>
                    {!debouncedSearch && statusFilter === 'All' && (
                      <Link to="/spt/new" className="btn btn-primary btn-sm">
                        <Plus size={15} /> Buat SPT Baru
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sptList.map((spt, idx) => {
                const ageInDays = differenceInDays(new Date(), new Date(spt.created_at));
                const isExpiredDraft = spt.status === 'Draft' && ageInDays > 30;
                const pegawaiList = spt.spt_pegawai ?? [];
                const firstTujuan = Array.isArray(spt.tujuan_kegiatan)
                  ? spt.tujuan_kegiatan[0]
                  : '';

                return (
                  <tr
                    key={spt.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/spt/${spt.id}`)}
                  >
                    <td className="text-slate-400 text-xs">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>

                    <td>
                      <span className="doc-number text-slate-800">
                        {spt.nomor_spt ?? (
                          <span className="text-slate-400 italic">
                            DRAFT-{spt.tanggal_penetapan?.replace(/-/g, '') || '________'}
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap text-slate-600 text-xs">
                      {format(new Date(spt.tanggal_penetapan), 'dd MMM yyyy', { locale: localeID })}
                    </td>

                    <td className="max-w-xs">
                      <p className="text-slate-700 text-sm truncate-2">
                        {firstTujuan || '—'}
                      </p>
                    </td>

                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="flex -space-x-2">
                          {pegawaiList.slice(0, 3).map((sp: { id: number; pegawai?: { nama_lengkap: string } }, i: number) => (
                            <div
                              key={sp.id}
                              title={sp.pegawai?.nama_lengkap}
                              className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold
                                         flex items-center justify-center border-2 border-white flex-shrink-0"
                              style={{ zIndex: 3 - i }}
                            >
                              {sp.pegawai?.nama_lengkap.charAt(0).toUpperCase() ?? '?'}
                            </div>
                          ))}
                        </div>
                        {pegawaiList.length > 3 && (
                          <span className="text-xs text-slate-400 font-semibold ml-1">
                            +{pegawaiList.length - 3}
                          </span>
                        )}
                        {pegawaiList.length === 0 && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={spt.status} />
                        {isExpiredDraft && (
                          <span className="badge badge-slate text-[10px]">Exp</span>
                        )}
                      </div>
                    </td>

                    <td className="text-right pr-4" onClick={e => e.stopPropagation()}>
                      <RowActions
                        spt={spt}
                        onView={() => navigate(`/spt/${spt.id}`)}
                        onEdit={() => navigate(`/spt/edit/${spt.id}`)}
                        onPrint={() => window.open(`/print/spt/${spt.id}`, '_blank')}
                        onBuatSPPD={() => navigate(`/sppd/new?spt_id=${spt.id}`)}
                        onCancel={() => setCancelTarget(spt)}
                        onRevise={() => navigate(`/spt/new?parent=${spt.id}`)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Menampilkan {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–
            {Math.min(page * PAGE_SIZE, totalCount)} dari {totalCount} data
            {isFetching && !isLoading && (
              <span className="ml-2 text-blue-500 text-xs animate-pulse">Memuat…</span>
            )}
          </span>
          <div className="pagination">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const pg = computePageNumber(i, page, totalPages);
              if (pg === null) return <span key={i} className="px-1 text-slate-300">…</span>;
              return (
                <button
                  key={pg}
                  className={`page-btn ${pg === page ? 'active' : ''}`}
                  onClick={() => setPage(pg)}
                >
                  {pg}
                </button>
              );
            })}
            <button
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Cancel Confirm Modal ─────────────────────────────── */}
      <ConfirmCancelModal
        open={!!cancelTarget}
        spt={cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        isPending={cancelMutation.isPending}
      />
    </div>
  );
};

// ─── Pagination helper ────────────────────────────────────────────
function computePageNumber(
  index: number,
  current: number,
  total: number
): number | null {
  // Show: 1, ..., current-1, current, current+1, ..., last
  const pages: (number | null)[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push(null);
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push(null);
    pages.push(total);
  }
  return pages[index] ?? null;
}

const QuickStatCard: React.FC<{ 
  label: string; 
  value: number; 
  icon: React.ReactNode; 
  color: string 
}> = ({ label, value, icon, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-indigo-500/5 text-blue-700 border-blue-100 shadow-blue-500/5',
    amber: 'from-amber-500/20 to-orange-500/5 text-amber-700 border-amber-100 shadow-amber-500/5',
    emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-700 border-emerald-100 shadow-emerald-500/5',
    slate: 'from-slate-500/20 to-slate-500/5 text-slate-700 border-slate-200 shadow-slate-500/5',
  };
  
  const iconColorMap: Record<string, string> = {
    blue: 'bg-blue-600 shadow-blue-500/40',
    amber: 'bg-amber-600 shadow-amber-500/40',
    emerald: 'bg-emerald-600 shadow-emerald-500/40',
    slate: 'bg-slate-600 shadow-slate-500/40',
  };
  
  return (
    <div className={`p-5 rounded-[1.5rem] border bg-gradient-to-br ${colorMap[color]} flex items-center gap-5 bg-white shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconColorMap[color]} text-white shadow-lg`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.1em] opacity-50 mb-0.5">{label}</p>
        <p className="text-2xl font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
};

export default SPTList;
