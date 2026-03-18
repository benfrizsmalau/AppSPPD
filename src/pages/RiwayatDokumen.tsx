import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subYears, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import {
  Search, Printer, Edit2, XCircle, RotateCcw, Loader2, Download,
  FileText, Map, Calendar, ChevronLeft, ChevronRight, Archive,
  X, Eye,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { SPPD, SPT, DocumentStatus, PaginatedResult } from '../types';

const PAGE_SIZE = 20;

type DocType = 'all' | 'SPT' | 'SPPD';

interface DocRow {
  id: number;
  type: 'SPT' | 'SPPD';
  nomor: string | null;
  pelaksana: string;
  tujuan: string;
  tanggal: string;
  status: DocumentStatus;
  print_count: number;
  last_printed_at: string | null;
  raw: SPT | SPPD;
}

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

const ALL_STATUSES: DocumentStatus[] = [
  'Draft', 'Menunggu Persetujuan', 'Final', 'Printed', 'Completed', 'Cancelled', 'Expired',
];

const ARCHIVE_CUTOFF = subYears(new Date(), 2).toISOString().split('T')[0];

// ── Fetch combined documents ──────────────────────────────────────────────────
async function fetchDocs(params: {
  tenantId: string;
  page: number;
  search: string;
  docType: DocType;
  status: 'all' | DocumentStatus;
  dateFrom: string;
  dateTo: string;
  penandatanganId: number | '';
  showArchive: boolean;
}): Promise<PaginatedResult<DocRow>> {
  const { tenantId, page, search, docType, status, dateFrom, dateTo, penandatanganId, showArchive } = params;
  const from = (page - 1) * PAGE_SIZE;

  const fetchSPT = docType === 'all' || docType === 'SPT';
  const fetchSPPD = docType === 'all' || docType === 'SPPD';

  const sptQuery = async (): Promise<DocRow[]> => {
    if (!fetchSPT) return [];
    let q = supabase.from('spt')
      .select('id, nomor_spt, tanggal_penetapan, status, print_count, last_printed_at, tujuan_kegiatan, penandatangan_id, spt_pegawai:spt_pegawai(pegawai:pegawai_id(nama_lengkap))')
      .eq('tenant_id', tenantId);
    if (status !== 'all') q = q.eq('status', status);
    if (dateFrom) q = q.gte('tanggal_penetapan', dateFrom);
    if (dateTo) q = q.lte('tanggal_penetapan', dateTo);
    if (penandatanganId) q = q.eq('penandatangan_id', penandatanganId);
    if (!showArchive) q = q.or(`status.neq.Final,tanggal_penetapan.gte.${ARCHIVE_CUTOFF}`);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((s: any) => ({
      id: s.id,
      type: 'SPT' as const,
      nomor: s.nomor_spt ?? null,
      pelaksana: s.spt_pegawai?.map((sp: any) => sp.pegawai?.nama_lengkap).filter(Boolean).join(', ') || '—',
      tujuan: Array.isArray(s.tujuan_kegiatan) ? s.tujuan_kegiatan[0] ?? '—' : '—',
      tanggal: s.tanggal_penetapan,
      status: s.status as DocumentStatus,
      print_count: s.print_count ?? 0,
      last_printed_at: s.last_printed_at,
      raw: s as SPT,
    }));
  };

  const sppdQuery = async (): Promise<DocRow[]> => {
    if (!fetchSPPD) return [];
    let q = supabase.from('sppd')
      .select('id, nomor_sppd, tanggal_berangkat, status, print_count, last_printed_at, maksud_perjalanan, tempat_tujuan, penandatangan_id, pegawai:pegawai_id(nama_lengkap, nip)')
      .eq('tenant_id', tenantId);
    if (status !== 'all') q = q.eq('status', status);
    if (dateFrom) q = q.gte('tanggal_berangkat', dateFrom);
    if (dateTo) q = q.lte('tanggal_berangkat', dateTo);
    if (penandatanganId) q = q.eq('penandatangan_id', penandatanganId);
    if (!showArchive) q = q.or(`status.neq.Final,tanggal_berangkat.gte.${ARCHIVE_CUTOFF}`);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((s: any) => ({
      id: s.id,
      type: 'SPPD' as const,
      nomor: s.nomor_sppd ?? null,
      pelaksana: s.pegawai?.nama_lengkap ?? '—',
      tujuan: s.tempat_tujuan ?? s.maksud_perjalanan ?? '—',
      tanggal: s.tanggal_berangkat,
      status: s.status as DocumentStatus,
      print_count: s.print_count ?? 0,
      last_printed_at: s.last_printed_at,
      raw: s as SPPD,
    }));
  };

  const [sptRows, sppdRows] = await Promise.all([sptQuery(), sppdQuery()]);

  let combined = [...sptRows, ...sppdRows].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );

  // Client-side text search (nomor, pelaksana, tujuan)
  if (search) {
    const lower = search.toLowerCase();
    combined = combined.filter(
      r =>
        (r.nomor ?? '').toLowerCase().includes(lower) ||
        r.pelaksana.toLowerCase().includes(lower) ||
        r.tujuan.toLowerCase().includes(lower)
    );
  }

  const total = combined.length;
  const paged = combined.slice(from, from + PAGE_SIZE);

  return {
    data: paged,
    total,
    page,
    limit: PAGE_SIZE,
    total_pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
const RiwayatDokumen: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState<DocType>('all');
  const [status, setStatus] = useState<'all' | DocumentStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [penandatanganId, setPenandatanganId] = useState<number | ''>('');
  const [showArchive, setShowArchive] = useState(false);
  const [previewRow, setPreviewRow] = useState<DocRow | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((v: string) => {
    setSearchRaw(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(v); setPage(1); }, 350);
  }, []);

  useEffect(() => { setPage(1); }, [docType, status, dateFrom, dateTo, penandatanganId, showArchive]);

  // Penandatangan list for filter
  const { data: penandatanganList = [] } = useQuery({
    queryKey: ['penandatangan-all', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('penandatangan')
        .select('id, nama_lengkap, jabatan').eq('tenant_id', tenantId!).eq('status_aktif', true);
      if (error) throw error;
      return data as { id: number; nama_lengkap: string; jabatan: string }[];
    },
    enabled: !!tenantId,
  });

  const queryKey = ['riwayat-docs', tenantId, page, search, docType, status, dateFrom, dateTo, penandatanganId, showArchive];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchDocs({
      tenantId: tenantId!, page, search, docType, status, dateFrom, dateTo, penandatanganId, showArchive,
    }),
    enabled: !!tenantId,
    placeholderData: prev => prev,
    staleTime: 30_000,
  });

  // Print tracking mutation
  const printMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: 'SPT' | 'SPPD' }) => {
      const table = type === 'SPT' ? 'spt' : 'sppd';
      const { data: current } = await supabase.from(table).select('print_count').eq('id', id).single();
      const { error } = await supabase.from(table).update({
        print_count: (current?.print_count ?? 0) + 1,
        last_printed_at: new Date().toISOString(),
        ...(type === 'SPPD' ? { status: 'Printed' } : {}),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, { type, id }) => {
      queryClient.invalidateQueries({ queryKey: ['riwayat-docs'] });
      window.open(`/print/${type.toLowerCase()}/${id}`, '_blank');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: 'SPT' | 'SPPD' }) => {
      const table = type === 'SPT' ? 'spt' : 'sppd';
      const { error } = await supabase.from(table).update({
        status: 'Cancelled', cancelled_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riwayat-docs'] });
      toast.success('Dokumen dibatalkan.');
      setPreviewRow(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

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

  // Export
  const handleExport = () => {
    const exportData = rows.map(r => ({
      Tipe: r.type,
      Nomor: r.nomor ?? '',
      Pelaksana: r.pelaksana,
      'Tujuan/Kegiatan': r.tujuan,
      Tanggal: format(parseISO(r.tanggal), 'dd/MM/yyyy', { locale: localeID }),
      Status: r.status,
      'Jumlah Cetak': r.print_count,
      'Terakhir Cetak': r.last_printed_at
        ? format(parseISO(r.last_printed_at), 'dd/MM/yyyy HH:mm', { locale: localeID })
        : '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Dokumen');
    XLSX.writeFile(wb, `Riwayat_Dokumen_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Data diekspor ke Excel.');
  };

  const resetFilters = () => {
    setSearch(''); setSearchRaw(''); setDocType('all'); setStatus('all');
    setDateFrom(''); setDateTo(''); setPenandatanganId(''); setShowArchive(false);
  };

  const hasActiveFilter = search || docType !== 'all' || status !== 'all' || dateFrom || dateTo || penandatanganId;

  // SPT-specific fields for preview
  const getPreviewFields = (row: DocRow) => {
    if (row.type === 'SPT') {
      const s = row.raw as SPT;
      return [
        ['Nomor', s.nomor_spt ?? '(Draft)'],
        ['Tanggal Penetapan', s.tanggal_penetapan ? format(parseISO(s.tanggal_penetapan), 'dd MMMM yyyy', { locale: localeID }) : '—'],
        ['Tempat Penetapan', s.tempat_penetapan],
        ['Tujuan Kegiatan', Array.isArray(s.tujuan_kegiatan) ? s.tujuan_kegiatan.join('; ') : '—'],
        ['Lama Kegiatan', `${s.lama_kegiatan} hari`],
        ['Status', s.status],
        ['Jumlah Cetak', String(s.print_count ?? 0)],
      ];
    } else {
      const s = row.raw as SPPD;
      return [
        ['Nomor', s.nomor_sppd ?? '(Draft)'],
        ['Pelaksana', row.pelaksana],
        ['Tempat Tujuan', s.tempat_tujuan],
        ['Tanggal Berangkat', s.tanggal_berangkat ? format(parseISO(s.tanggal_berangkat), 'dd MMMM yyyy', { locale: localeID }) : '—'],
        ['Tanggal Kembali', s.tanggal_kembali ? format(parseISO(s.tanggal_kembali), 'dd MMMM yyyy', { locale: localeID }) : '—'],
        ['Lama Perjalanan', `${s.lama_perjalanan} hari`],
        ['Maksud', s.maksud_perjalanan],
        ['Status', s.status],
        ['Jumlah Cetak', String(s.print_count ?? 0)],
        ['Terakhir Cetak', s.last_printed_at ? format(parseISO(s.last_printed_at), 'dd MMM yyyy HH:mm', { locale: localeID }) : '—'],
      ];
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Riwayat Dokumen</h1>
          <p className="page-subtitle">Pencarian dan arsip seluruh dokumen SPT & SPPD</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn btn-sm ${showArchive ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowArchive(v => !v)}
          >
            <Archive size={15} />
            {showArchive ? 'Sembunyikan Arsip' : 'Tampilkan Arsip'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card card-body flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="search-wrap md:col-span-2">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input form-input"
              placeholder="Cari nomor dokumen, nama/NIP pegawai, tujuan/kegiatan..."
              value={searchRaw}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="form-group">
            <label className="form-label">Tgl Mulai</label>
            <input type="date" className="form-input" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tgl Akhir</label>
            <input type="date" className="form-input" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipe Dokumen</label>
            <select className="form-select" value={docType}
              onChange={e => setDocType(e.target.value as DocType)}>
              <option value="all">Semua Tipe</option>
              <option value="SPT">SPT</option>
              <option value="SPPD">SPPD</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={status}
              onChange={e => setStatus(e.target.value as any)}>
              <option value="all">Semua Status</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div className="form-group">
            <label className="form-label">Penandatangan</label>
            <select className="form-select" value={penandatanganId}
              onChange={e => setPenandatanganId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Semua Penandatangan</option>
              {penandatanganList.map(p => (
                <option key={p.id} value={p.id}>{p.nama_lengkap} — {p.jabatan}</option>
              ))}
            </select>
          </div>
          {hasActiveFilter && (
            <button className="btn btn-ghost btn-sm self-end" onClick={resetFilters}>
              <X size={14} /> Reset Semua Filter
            </button>
          )}
        </div>

        {showArchive && (
          <div className="alert alert-info">
            <Archive size={14} />
            <span className="text-xs">Menampilkan dokumen arsip (Final lebih dari 2 tahun).</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex gap-4" style={{ minHeight: 0 }}>
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="card">
            <div className="card-header">
              <span className="text-sm font-semibold text-slate-700">
                {isFetching ? 'Memuat...' : `${total} dokumen`}
              </span>
            </div>
            <div className="table-wrap rounded-none border-0">
              {isLoading ? (
                <div className="empty-state">
                  <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
                  <p className="text-slate-400 text-sm">Memuat riwayat dokumen...</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} className="text-slate-300 mb-3" />
                  <p className="empty-state-title">Tidak ada dokumen ditemukan</p>
                  <p className="empty-state-desc">Coba ubah filter pencarian.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipe</th>
                      <th>Nomor</th>
                      <th>Pelaksana</th>
                      <th>Tujuan/Kegiatan</th>
                      <th>Tanggal</th>
                      <th>Status</th>
                      <th>Cetak</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={`${row.type}-${row.id}-${idx}`}
                        className={`cursor-pointer ${previewRow?.id === row.id && previewRow?.type === row.type ? 'selected' : ''}`}
                        onClick={() => setPreviewRow(prev =>
                          prev?.id === row.id && prev?.type === row.type ? null : row
                        )}
                      >
                        <td>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${row.type === 'SPT' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {row.type === 'SPT' ? <FileText size={13} /> : <Map size={13} />}
                          </div>
                        </td>
                        <td>
                          {row.nomor ? (
                            <span className="doc-number text-slate-700">{row.nomor}</span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Draft</span>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">{row.type}</p>
                        </td>
                        <td>
                          <p className="text-sm font-medium text-slate-700 max-w-[140px] truncate">{row.pelaksana}</p>
                        </td>
                        <td>
                          <p className="text-sm text-slate-600 max-w-[180px] truncate">{row.tujuan}</p>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 text-slate-600 text-sm whitespace-nowrap">
                            <Calendar size={12} className="text-slate-400" />
                            {format(parseISO(row.tanggal), 'dd MMM yyyy', { locale: localeID })}
                          </div>
                        </td>
                        <td>
                          <span className={getStatusClass(row.status)}>{row.status}</span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-500">{row.print_count}×</span>
                          {row.last_printed_at && (
                            <p className="text-xs text-slate-400">
                              {format(parseISO(row.last_printed_at), 'dd/MM/yy', { locale: localeID })}
                            </p>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              title="Preview"
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setPreviewRow(prev =>
                                prev?.id === row.id && prev?.type === row.type ? null : row
                              )}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              title="Cetak"
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => printMutation.mutate({ id: row.id, type: row.type })}
                              disabled={printMutation.isPending}
                            >
                              <Printer size={14} />
                            </button>
                            {row.status === 'Draft' && (
                              <button
                                title="Edit"
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => navigate(`/${row.type.toLowerCase()}/edit/${row.id}`)}
                              >
                                <Edit2 size={14} />
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

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">Halaman {page} dari {totalPages} · {total} total</p>
                <div className="pagination">
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  {pageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} className="page-btn cursor-default text-slate-400">…</span>
                    ) : (
                      <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p as number)}>{p}</button>
                    )
                  )}
                  <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Preview Panel */}
        <AnimatePresence>
          {previewRow && (
            <motion.div
              key={`preview-${previewRow.type}-${previewRow.id}`}
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ width: 400, flexShrink: 0 }}
            >
              <div className="card sticky top-6 flex flex-col gap-0 overflow-hidden">
                {/* Panel Header */}
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${previewRow.type === 'SPT' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {previewRow.type === 'SPT' ? <FileText size={13} /> : <Map size={13} />}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{previewRow.type} Detail</span>
                  </div>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setPreviewRow(null)}>
                    <X size={15} />
                  </button>
                </div>

                {/* Nomor & Status */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="doc-number text-slate-700 text-sm">{previewRow.nomor ?? '(Draft)'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(parseISO(previewRow.tanggal), 'dd MMMM yyyy', { locale: localeID })}
                    </p>
                  </div>
                  <span className={getStatusClass(previewRow.status)}>{previewRow.status}</span>
                </div>

                {/* Fields */}
                <div className="px-5 py-4 flex-1 overflow-y-auto" style={{ maxHeight: '380px' }}>
                  <table className="w-full text-xs">
                    <tbody>
                      {getPreviewFields(previewRow).map(([k, v]) => (
                        <tr key={k} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-3 text-slate-500 w-32 align-top leading-snug">{k}</td>
                          <td className="py-2 font-medium text-slate-700 align-top leading-snug break-words">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Action Buttons */}
                <div className="card-header border-t border-slate-100 flex-wrap gap-2">
                  <button
                    className="btn btn-secondary btn-sm flex-1"
                    onClick={() => printMutation.mutate({ id: previewRow.id, type: previewRow.type })}
                    disabled={printMutation.isPending}
                  >
                    {printMutation.isPending
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Printer size={13} />}
                    Cetak
                  </button>
                  {previewRow.status === 'Draft' && (
                    <button
                      className="btn btn-primary btn-sm flex-1"
                      onClick={() => navigate(`/${previewRow.type.toLowerCase()}/edit/${previewRow.id}`)}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  )}
                  {(previewRow.status === 'Draft' || previewRow.status === 'Menunggu Persetujuan') && (
                    <button
                      className="btn btn-danger btn-sm flex-1"
                      onClick={() => cancelMutation.mutate({ id: previewRow.id, type: previewRow.type })}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending
                        ? <Loader2 size={13} className="animate-spin" />
                        : <XCircle size={13} />}
                      Batalkan
                    </button>
                  )}
                  {(previewRow.status === 'Final' || previewRow.status === 'Printed' || previewRow.status === 'Cancelled') && (
                    <button
                      className="btn btn-secondary btn-sm flex-1"
                      onClick={async () => {
                        const table = previewRow.type === 'SPT' ? 'spt' : 'sppd';
                        const { data: src } = await supabase.from(table).select('*').eq('id', previewRow.id).single();
                        if (!src) return;
                        const { id: _id, created_at: _c, updated_at: _u, status: _s,
                          nomor_spt: _n1, nomor_sppd: _n2, print_count: _p,
                          last_printed_at: _l, finalized_at: _f, ...rest } = src;
                        const parentKey = previewRow.type === 'SPT' ? 'parent_spt_id' : 'parent_sppd_id';
                        const { error } = await supabase.from(table).insert({
                          ...rest, status: 'Draft', [parentKey]: previewRow.id, print_count: 0,
                        });
                        if (error) toast.error(error.message);
                        else {
                          queryClient.invalidateQueries({ queryKey: ['riwayat-docs'] });
                          toast.success('Revisi berhasil dibuat sebagai Draft baru.');
                          setPreviewRow(null);
                        }
                      }}
                    >
                      <RotateCcw size={13} /> Revisi
                    </button>
                  )}
                </div>

                {/* Print count info */}
                {previewRow.print_count > 0 && (
                  <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-400">
                      Dicetak {previewRow.print_count}× ·{' '}
                      {previewRow.last_printed_at
                        ? `Terakhir ${format(parseISO(previewRow.last_printed_at), 'dd MMM yyyy HH:mm', { locale: localeID })}`
                        : ''}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RiwayatDokumen;
