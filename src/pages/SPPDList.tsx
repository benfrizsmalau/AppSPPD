import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Search, Printer, Edit2, Eye, CheckCircle2, XCircle,
  RotateCcw, Loader2, MapPin, Calendar, ChevronLeft, ChevronRight,
  FileText, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { SPPD, DocumentStatus, PaginatedResult } from '../types';

const PAGE_SIZE = 25;

type FilterStatus = 'all' | DocumentStatus;

const STATUS_CHIPS: { label: string; value: FilterStatus }[] = [
  { label: 'Semua', value: 'all' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Menunggu Persetujuan', value: 'Menunggu Persetujuan' },
  { label: 'Final', value: 'Final' },
  { label: 'Printed', value: 'Printed' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

function getStatusClass(status: DocumentStatus): string {
  const map: Record<DocumentStatus, string> = {
    Draft: 'status-draft',
    'Menunggu Persetujuan': 'status-pending',
    Final: 'status-final',
    Printed: 'status-printed',
    Completed: 'status-completed',
    Cancelled: 'status-cancelled',
    Expired: 'status-expired',
  };
  return map[status] ?? 'badge badge-slate';
}

interface SPPDRow extends Omit<SPPD, 'pegawai' | 'penandatangan'> {
  pegawai: { nama_lengkap: string; nip: string } | null;
  penandatangan: { nama_lengkap: string } | null;
}

async function fetchSPPDs(params: {
  tenantId: string;
  page: number;
  search: string;
  status: FilterStatus;
  dateFrom: string;
  dateTo: string;
}): Promise<PaginatedResult<SPPDRow>> {
  const { tenantId, page, search, status, dateFrom, dateTo } = params;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('sppd')
    .select(
      '*, pegawai:pegawai_id(nama_lengkap, nip), penandatangan:penandatangan_id(nama_lengkap)',
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') query = query.eq('status', status);
  if (dateFrom) query = query.gte('tanggal_berangkat', dateFrom);
  if (dateTo) query = query.lte('tanggal_berangkat', dateTo);
  if (search) {
    query = query.or(
      `nomor_sppd.ilike.%${search}%,tempat_tujuan.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data ?? []) as SPPDRow[],
    total: count ?? 0,
    page,
    limit: PAGE_SIZE,
    total_pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

const SPPDList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    id: number; type: 'selesai' | 'batalkan' | 'revisi'; nomor?: string
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((v: string) => {
    setSearchRaw(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(v); setPage(1); }, 350);
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, dateFrom, dateTo]);

  const queryKey = ['sppd-list', tenantId, page, search, statusFilter, dateFrom, dateTo];

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchSPPDs({ tenantId: tenantId!, page, search, status: statusFilter, dateFrom, dateTo }),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: DocumentStatus; reason?: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'Completed') patch.completed_at = new Date().toISOString();
      if (status === 'Cancelled') { patch.cancelled_at = new Date().toISOString(); if (reason) patch.alasan_pembatalan = reason; }
      const { error } = await supabase.from('sppd').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sppd-list'] });
      toast.success(
        vars.status === 'Completed' ? 'SPPD ditandai selesai.' :
        vars.status === 'Cancelled' ? 'SPPD dibatalkan.' : 'Status diperbarui.'
      );
      setConfirmAction(null);
    },
    onError: (e: Error) => toast.error('Gagal memperbarui status: ' + e.message),
  });

  const createRevisiMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data: src, error: fe } = await supabase.from('sppd').select('*').eq('id', id).single();
      if (fe) throw fe;
      const { nomor_sppd: _, id: _id, created_at: _c, updated_at: _u, finalized_at: _f,
        status: _s, print_count: _p, last_printed_at: _l, pdf_file_path: _pdf, ...rest } = src;
      const { error: ie } = await supabase.from('sppd').insert({
        ...rest, status: 'Draft', parent_sppd_id: id, print_count: 0,
      });
      if (ie) throw ie;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sppd-list'] });
      toast.success('Revisi SPPD berhasil dibuat sebagai Draft baru.');
      setConfirmAction(null);
    },
    onError: (e: Error) => toast.error('Gagal membuat revisi: ' + e.message),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  const handleAction = (type: 'selesai' | 'batalkan' | 'revisi', id: number, nomor?: string) => {
    setConfirmAction({ id, type, nomor: nomor ?? `#${id}` });
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    const { id, type } = confirmAction;
    if (type === 'selesai') updateStatusMutation.mutate({ id, status: 'Completed' });
    else if (type === 'batalkan') updateStatusMutation.mutate({ id, status: 'Cancelled' });
    else if (type === 'revisi') createRevisiMutation.mutate(id);
  };

  const pageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const p = page;
    const pages: (number | '...')[] = [1];
    if (p > 3) pages.push('...');
    for (let i = Math.max(2, p - 1); i <= Math.min(totalPages - 1, p + 1); i++) pages.push(i);
    if (p < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Surat Perintah Perjalanan Dinas</h1>
          <p className="page-subtitle">Kelola seluruh dokumen SPPD ASN di instansi Anda</p>
        </div>
        <Link to="/sppd/new" className="btn btn-primary">
          <Plus size={16} />
          Tambah SPPD
        </Link>
      </div>

      {/* Status Chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map(c => (
          <button
            key={c.value}
            className={`chip ${statusFilter === c.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Search & Date Filter */}
      <div className="card card-body flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="form-label mb-1">Cari</label>
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input form-input"
              placeholder="Nomor SPPD, nama/NIP pegawai, tujuan..."
              value={searchRaw}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="form-group">
            <label className="form-label">Tgl Berangkat (dari)</label>
            <input type="date" className="form-input" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Sampai</label>
            <input type="date" className="form-input" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
          {(dateFrom || dateTo || search) && (
            <div className="form-group justify-end">
              <label className="form-label invisible">reset</label>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                setDateFrom(''); setDateTo(''); setSearchRaw(''); setSearch('');
              }}>Reset Filter</button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="alert alert-danger">
          <AlertTriangle size={16} />
          <span>Gagal memuat data: {(error as Error).message}</span>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-semibold text-slate-700">
            {isFetching ? 'Memuat...' : `${total} dokumen ditemukan`}
          </span>
        </div>
        <div className="table-wrap rounded-none border-0">
          {isLoading ? (
            <div className="empty-state">
              <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
              <p className="text-slate-400 text-sm">Memuat data SPPD...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} className="text-slate-300 mb-3" />
              <p className="empty-state-title">Belum ada SPPD</p>
              <p className="empty-state-desc">Coba ubah filter atau buat SPPD baru.</p>
              <Link to="/sppd/new" className="btn btn-primary btn-sm">
                <Plus size={14} /> Buat SPPD
              </Link>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nomor SPPD</th>
                  <th>Pelaksana</th>
                  <th>Tujuan</th>
                  <th>Tgl Berangkat</th>
                  <th>Lama</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/sppd/${row.id}`)}
                  >
                    <td className="text-slate-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>
                      {row.nomor_sppd ? (
                        <span className="doc-number text-blue-700">{row.nomor_sppd}</span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Belum dinomori</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {row.pegawai?.nama_lengkap?.charAt(0) ?? '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm leading-tight">
                            {row.pegawai?.nama_lengkap ?? '-'}
                          </p>
                          <p className="text-slate-400 text-xs">{row.pegawai?.nip ?? '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-slate-700">
                        <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="text-sm">{row.tempat_tujuan}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-slate-600 text-sm">
                        <Calendar size={12} className="text-slate-400" />
                        {row.tanggal_berangkat
                          ? format(new Date(row.tanggal_berangkat), 'dd MMM yyyy', { locale: localeID })
                          : '-'}
                      </div>
                    </td>
                    <td className="text-slate-600 text-sm">{row.lama_perjalanan} hari</td>
                    <td>
                      <span className={getStatusClass(row.status)}>{row.status}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          title="Lihat detail"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => navigate(`/sppd/${row.id}`)}
                        >
                          <Eye size={15} />
                        </button>
                        {row.status === 'Draft' && (
                          <button
                            title="Edit"
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => navigate(`/sppd/edit/${row.id}`)}
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        <button
                          title="Cetak"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => window.open(`/print/sppd/${row.id}`, '_blank')}
                        >
                          <Printer size={15} />
                        </button>
                        {(row.status === 'Final' || row.status === 'Printed') && (
                          <button
                            title="Tandai Selesai"
                            className="btn btn-ghost btn-icon btn-sm text-emerald-600"
                            onClick={() => handleAction('selesai', row.id, row.nomor_sppd)}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        {(row.status === 'Draft' || row.status === 'Menunggu Persetujuan') && (
                          <button
                            title="Batalkan"
                            className="btn btn-ghost btn-icon btn-sm text-rose-500"
                            onClick={() => handleAction('batalkan', row.id, row.nomor_sppd)}
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                        {(row.status === 'Final' || row.status === 'Printed' || row.status === 'Cancelled') && (
                          <button
                            title="Buat Revisi"
                            className="btn btn-ghost btn-icon btn-sm text-violet-600"
                            onClick={() => handleAction('revisi', row.id, row.nomor_sppd)}
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Halaman {page} dari {totalPages} &bull; {total} total
            </p>
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              {pageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="page-btn cursor-default text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    className={`page-btn ${page === p ? 'active' : ''}`}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="page-btn"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {confirmAction.type === 'selesai' && 'Tandai Selesai'}
                {confirmAction.type === 'batalkan' && 'Batalkan SPPD'}
                {confirmAction.type === 'revisi' && 'Buat Revisi'}
              </h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmAction(null)}>
                <XCircle size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-slate-600 text-sm">
                {confirmAction.type === 'selesai' &&
                  `Tandai SPPD ${confirmAction.nomor} sebagai Completed? Tindakan ini tidak dapat dibatalkan.`}
                {confirmAction.type === 'batalkan' &&
                  `Batalkan SPPD ${confirmAction.nomor}? Status akan berubah menjadi Cancelled.`}
                {confirmAction.type === 'revisi' &&
                  `Buat salinan revisi dari SPPD ${confirmAction.nomor} sebagai Draft baru?`}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmAction(null)}>Batal</button>
              <button
                className={`btn btn-sm ${confirmAction.type === 'batalkan' ? 'btn-danger' : confirmAction.type === 'selesai' ? 'btn-success' : 'btn-primary'}`}
                onClick={confirmAndExecute}
                disabled={updateStatusMutation.isPending || createRevisiMutation.isPending}
              >
                {(updateStatusMutation.isPending || createRevisiMutation.isPending)
                  ? <Loader2 size={14} className="animate-spin" />
                  : confirmAction.type === 'selesai' ? 'Ya, Tandai Selesai'
                  : confirmAction.type === 'batalkan' ? 'Ya, Batalkan'
                  : 'Ya, Buat Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SPPDList;
