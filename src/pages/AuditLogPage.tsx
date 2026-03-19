import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { AuditLog } from '../types';
import {
  ClipboardList, Download, ChevronDown, ChevronUp,
  Search, Filter, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// ─── JSON Diff Viewer ─────────────────────────────────────────────────────────
interface DiffViewProps {
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}
const DiffView: React.FC<DiffViewProps> = ({ oldData, newData }) => {
  if (!oldData && !newData) return <p className="text-xs text-slate-400 italic">Tidak ada data perubahan.</p>;
  const keys = Array.from(new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})]));
  const changed = keys.filter(k => JSON.stringify((oldData ?? {})[k]) !== JSON.stringify((newData ?? {})[k]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      {oldData !== undefined && (
        <div>
          <p className="font-semibold text-rose-600 mb-1 uppercase tracking-wide">Data Lama</p>
          <div className="bg-rose-50 rounded-lg p-3 font-mono space-y-0.5 max-h-64 overflow-y-auto">
            {keys.map(k => (
              <div key={k} className={`flex gap-2 ${changed.includes(k) ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
                <span className="text-rose-400 shrink-0">{k}:</span>
                <span className="truncate">{JSON.stringify((oldData ?? {})[k] ?? null)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {newData !== undefined && (
        <div>
          <p className="font-semibold text-emerald-600 mb-1 uppercase tracking-wide">Data Baru</p>
          <div className="bg-emerald-50 rounded-lg p-3 font-mono space-y-0.5 max-h-64 overflow-y-auto">
            {keys.map(k => (
              <div key={k} className={`flex gap-2 ${changed.includes(k) ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                <span className="text-emerald-500 shrink-0">{k}:</span>
                <span className="truncate">{JSON.stringify((newData ?? {})[k] ?? null)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Action Badge ─────────────────────────────────────────────────────────────
const ACTION_BADGE: Record<string, string> = {
  INSERT: 'badge badge-green',
  UPDATE: 'badge badge-blue',
  DELETE: 'badge badge-red',
  LOGIN: 'badge badge-cyan',
  LOGOUT: 'badge badge-slate',
  APPROVE: 'badge badge-green',
  REJECT: 'badge badge-red',
  SUBMIT: 'badge badge-blue',
  REVISE: 'badge badge-orange',
};
const getActionBadge = (action: string) => ACTION_BADGE[action.toUpperCase()] ?? 'badge badge-slate';

const PAGE_SIZE = 50;

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT LOG PAGE
// ═════════════════════════════════════════════════════════════════════════════
const AuditLogPage: React.FC = () => {
  const { tenantId } = useAuth();

  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ['audit_logs', tenantId, page, filterAction, filterTable, filterUser, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('*, user:user_profiles(id, nama_lengkap, role)', { count: 'exact' })
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction) q = q.ilike('action', `%${filterAction}%`);
      if (filterTable) q = q.ilike('table_name', `%${filterTable}%`);
      if (filterUser) q = q.ilike('user_id', `%${filterUser}%`);
      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`);

      const { data: logs, count, error } = await q;
      if (error) throw error;
      return { logs: logs ?? [], total: count ?? 0 };
    },
    enabled: !!tenantId,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filteredLogs = search
    ? logs.filter(l =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.table_name.toLowerCase().includes(search.toLowerCase()) ||
        String(l.record_id ?? '').includes(search) ||
        (l.user as unknown as { nama_lengkap: string })?.nama_lengkap?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const exportCSV = () => {
    const rows = [
      ['Waktu', 'Pengguna', 'Aksi', 'Tabel', 'Record ID', 'IP'],
      ...logs.map(l => [
        l.created_at,
        (l.user as unknown as { nama_lengkap: string })?.nama_lengkap ?? l.user_id ?? '',
        l.action,
        l.table_name,
        l.record_id ?? '',
        l.ip_address ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `audit_log_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Audit</h1>
          <p className="page-subtitle">Riwayat seluruh aktivitas dan perubahan data pada sistem.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilter(f => !f)}>
            <Filter size={14} /> Filter {showFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={logs.length === 0}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilter && (
        <div className="card card-body mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="form-group col-span-2 md:col-span-1">
              <label className="form-label text-xs">Cari</label>
              <div className="search-wrap">
                <Search size={13} className="search-icon" />
                <input className="search-input text-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Aksi / tabel / record..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Jenis Aksi</label>
              <select className="form-select text-xs" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
                <option value="">Semua</option>
                {['INSERT','UPDATE','DELETE','LOGIN','LOGOUT','APPROVE','REJECT','SUBMIT','REVISE'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Nama Tabel</label>
              <input className="form-input text-xs" value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0); }} placeholder="spt, sppd, ..." />
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Dari Tanggal</label>
              <input type="date" className="form-input text-xs" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} />
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Sampai Tanggal</label>
              <input type="date" className="form-input text-xs" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} />
            </div>
            <div className="form-group flex items-end">
              <button className="btn btn-secondary btn-sm w-full" onClick={() => { setFilterAction(''); setFilterTable(''); setFilterUser(''); setDateFrom(''); setDateTo(''); setSearch(''); setPage(0); }}>
                Reset Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 mb-3 text-sm text-slate-500">
        <span>Total: <strong className="text-slate-800">{total.toLocaleString('id-ID')}</strong> entri</span>
        {total > PAGE_SIZE && <span>| Halaman {page + 1} dari {totalPages}</span>}
      </div>

      {isLoading ? (
        <div className="card card-body space-y-3">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <ClipboardList size={40} className="text-slate-300" />
            <p className="empty-state-title">Tidak ada entri log</p>
            <p className="empty-state-desc">Coba ubah filter atau rentang tanggal.</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Tabel</th>
                <th>Record ID</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    className={`cursor-pointer ${expanded === log.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpanded(exp => exp === log.id ? null : log.id)}
                  >
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: localeID })}
                    </td>
                    <td>
                      <div className="text-sm font-medium text-slate-700">
                        {(log.user as unknown as { nama_lengkap: string })?.nama_lengkap ?? '—'}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{log.user_id?.substring(0, 8)}...</div>
                    </td>
                    <td>
                      <span className={getActionBadge(log.action)}>{log.action}</span>
                    </td>
                    <td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{log.table_name}</code></td>
                    <td className="font-mono text-xs text-slate-500">{log.record_id ?? '—'}</td>
                    <td className="text-xs text-slate-400 font-mono">{log.ip_address ?? '—'}</td>
                    <td>
                      {(log.old_data || log.new_data) && (
                        <button className="btn btn-ghost btn-icon-sm" onClick={e => { e.stopPropagation(); setExpanded(exp => exp === log.id ? null : log.id); }}>
                          {expanded === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === log.id && (log.old_data || log.new_data) && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-3">
                        <DiffView oldData={log.old_data} newData={log.new_data} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total.toLocaleString('id-ID')} entri
          </p>
          <div className="pagination">
            <button className="page-btn" disabled={page === 0} onClick={() => setPage(0)}>«</button>
            <button className="page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>
                  {pg + 1}
                </button>
              );
            })}
            <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed bottom-6 right-6">
          <div className="bg-slate-800 text-white rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Memuat data...
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
