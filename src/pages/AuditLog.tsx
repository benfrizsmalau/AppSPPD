// =================================================================
// SiSPPD v2.1 — Audit Log Viewer (Module 18)
// =================================================================
import { useState, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  Shield,
  Download,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
} from 'lucide-react';
import { formatDatetime } from '../lib/utils';
import type { AuditLog as AuditLogBase } from '../types';
import * as XLSX from 'xlsx';
import { format, startOfDay, endOfDay, isToday, parseISO } from 'date-fns';
import { getPaginationRange } from '../lib/utils';

// Extended audit log type — database may include these extra columns
interface AuditLogType extends AuditLogBase {
  changed_by?: string;
  changed_by_name?: string;
}

// ─── Constants ───────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'badge-green',
  UPDATE: 'badge-blue',
  DELETE: 'badge-red',
  LOGIN: 'badge-cyan',
  LOGOUT: 'badge-slate',
  PRINT: 'badge-violet',
  FINALIZE: 'badge-yellow',
};

const ACTION_ICONS: Record<string, ReactNode> = {
  INSERT: <Plus size={10} />,
  UPDATE: <Edit2 size={10} />,
  DELETE: <Trash2 size={10} />,
};

const KNOWN_TABLES = [
  'spt', 'sppd', 'pegawai', 'penandatangan',
  'user_profiles', 'instansi', 'mata_anggaran',
  'approval_log', 'notifikasi',
];

const LIMIT = 50;

// ─── Helpers ─────────────────────────────────────────────────────

function getChangedKeys(
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
): Set<string> {
  if (!oldData || !newData) return new Set();
  const changed = new Set<string>();
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  allKeys.forEach(k => {
    if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
      changed.add(k);
    }
  });
  return changed;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

// ─── Sub-components ──────────────────────────────────────────────

interface DataPanelProps {
  title: string;
  data?: Record<string, unknown>;
  changedKeys: Set<string>;
  highlight: 'red' | 'green' | 'none';
}

function DataPanel({ title, data, changedKeys, highlight }: DataPanelProps) {
  if (!data) {
    return (
      <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</p>
        <p className="text-xs text-slate-400 italic">Tidak ada data</p>
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-xl border border-slate-100 bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      </div>
      <div className="p-3 overflow-auto max-h-64">
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(data).map(([k, v]) => {
              const isChanged = changedKeys.has(k);
              const rowClass = isChanged
                ? highlight === 'red'
                  ? 'bg-rose-50'
                  : highlight === 'green'
                  ? 'bg-emerald-50'
                  : ''
                : '';
              const valClass = isChanged
                ? highlight === 'red'
                  ? 'text-rose-700 font-semibold'
                  : highlight === 'green'
                  ? 'text-emerald-700 font-semibold'
                  : ''
                : 'text-slate-700';
              return (
                <tr key={k} className={rowClass}>
                  <td className="py-1 pr-3 font-mono text-slate-400 whitespace-nowrap align-top w-40">
                    {k}
                  </td>
                  <td className={`py-1 break-all ${valClass}`}>{formatValue(v)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ExpandedRowProps {
  log: AuditLogType;
}

function ExpandedRow({ log }: ExpandedRowProps) {
  const changedKeys = getChangedKeys(log.old_data, log.new_data);
  const hasOld = !!log.old_data && Object.keys(log.old_data).length > 0;
  const hasNew = !!log.new_data && Object.keys(log.new_data).length > 0;

  return (
    <tr>
      <td colSpan={6} className="px-4 pb-4 pt-0 bg-blue-50/40">
        <div className="rounded-xl border border-blue-100 bg-white p-4 mt-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Activity size={12} /> Detail Perubahan
            {changedKeys.size > 0 && (
              <span className="badge badge-blue">{changedKeys.size} field berubah</span>
            )}
          </p>
          {!hasOld && !hasNew ? (
            <p className="text-xs text-slate-400 italic">Tidak ada data detail tersimpan.</p>
          ) : (
            <div className="flex gap-4">
              <DataPanel
                title="Data Lama"
                data={log.old_data}
                changedKeys={changedKeys}
                highlight={hasOld && hasNew ? 'red' : 'none'}
              />
              <DataPanel
                title="Data Baru"
                data={log.new_data}
                changedKeys={changedKeys}
                highlight={hasNew && hasOld ? 'green' : 'none'}
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Stats Row ───────────────────────────────────────────────────

interface TodayStats {
  total: number;
  insert: number;
  update: number;
  delete: number;
}

interface StatsRowProps {
  stats: TodayStats;
  loading: boolean;
}

function StatsRow({ stats, loading }: StatsRowProps) {
  const items = [
    { label: 'Total Hari Ini', value: stats.total, color: 'text-slate-900', bg: 'bg-slate-100' },
    { label: 'INSERT Hari Ini', value: stats.insert, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'UPDATE Hari Ini', value: stats.update, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'DELETE Hari Ini', value: stats.delete, color: 'text-rose-700', bg: 'bg-rose-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map(item => (
        <div key={item.label} className={`card p-4 flex items-center gap-4`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
            <Activity size={18} className={item.color} />
          </div>
          <div>
            {loading ? (
              <div className="skeleton h-6 w-10 rounded mb-1" />
            ) : (
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            )}
            <p className="text-xs text-slate-500">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function AuditLog() {
  const { tenantId } = useAuth();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [table, setTable] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expand state: row id -> expanded bool
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasFilters = search || action || table || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setAction('');
    setTable('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // ── Main query ──────────────────────────────────────────────────
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit_log', page, search, action, table, dateFrom, dateTo, tenantId],
    queryFn: async () => {
      if (!tenantId) return { data: [], total: 0 };

      let q = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * LIMIT, page * LIMIT - 1);

      if (action) q = q.eq('action', action);
      if (table) q = q.eq('table_name', table);
      if (search) q = q.ilike('changed_by_name', `%${search}%`);
      if (dateFrom) q = q.gte('created_at', startOfDay(parseISO(dateFrom)).toISOString());
      if (dateTo) q = q.lte('created_at', endOfDay(parseISO(dateTo)).toISOString());

      const { data: rows, error, count } = await q;
      if (error) throw error;
      return { data: rows as AuditLogType[], total: count || 0 };
    },
    enabled: !!tenantId,
  });

  // ── Today stats query ───────────────────────────────────────────
  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ['audit_log_today_stats', tenantId],
    queryFn: async (): Promise<TodayStats> => {
      if (!tenantId) return { total: 0, insert: 0, update: 0, delete: 0 };
      const todayStart = format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ssxxx");
      const todayEnd = format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ssxxx");

      const { data: rows, error } = await supabase
        .from('audit_log')
        .select('action, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      if (error) return { total: 0, insert: 0, update: 0, delete: 0 };

      const todayRows = (rows || []).filter(r => {
        try { return isToday(parseISO(r.created_at)); } catch { return false; }
      });

      return {
        total: todayRows.length,
        insert: todayRows.filter(r => r.action === 'INSERT').length,
        update: todayRows.filter(r => r.action === 'UPDATE').length,
        delete: todayRows.filter(r => r.action === 'DELETE').length,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // ── Export handler ──────────────────────────────────────────────
  const handleExport = async () => {
    if (!tenantId) return;

    let q = supabase
      .from('audit_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (action) q = q.eq('action', action);
    if (table) q = q.eq('table_name', table);
    if (search) q = q.ilike('changed_by_name', `%${search}%`);
    if (dateFrom) q = q.gte('created_at', startOfDay(parseISO(dateFrom)).toISOString());
    if (dateTo) q = q.lte('created_at', endOfDay(parseISO(dateTo)).toISOString());

    const { data: rows, error } = await q;
    if (error || !rows) return;

    const sheetRows = (rows as AuditLogType[]).map(l => ({
      Waktu: formatDatetime(l.created_at),
      Aksi: l.action,
      Tabel: l.table_name,
      'ID Record': l.record_id ?? '',
      'Diubah Oleh': l.changed_by_name ?? l.user_id ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, `audit-log-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // ── Pagination ──────────────────────────────────────────────────
  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);
  const paginationRange = useMemo(
    () => getPaginationRange(page, totalPages),
    [page, totalPages],
  );

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield size={22} className="text-blue-600" />
            Log Audit
          </h1>
          <p className="page-subtitle">Rekam jejak semua perubahan data sistem</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => refetch()}
            title="Refresh"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <StatsRow
        stats={todayStats ?? { total: 0, insert: 0, update: 0, delete: 0 }}
        loading={statsLoading}
      />

      {/* Filter Bar */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search by name */}
            <div className="search-wrap flex-1 min-w-48">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Cari nama pengguna..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Action filter — colored chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {['', 'INSERT', 'UPDATE', 'DELETE'].map(a => {
                const label = a || 'Semua';
                const chipColor = a === 'INSERT'
                  ? (action === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100')
                  : a === 'UPDATE'
                  ? (action === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100')
                  : a === 'DELETE'
                  ? (action === a ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100')
                  : (action === a ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50');
                return (
                  <button
                    key={label}
                    className={`chip ${chipColor}`}
                    onClick={() => { setAction(a); setPage(1); }}
                  >
                    {a && ACTION_ICONS[a]}
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Table filter */}
            <select
              className="form-select w-44"
              value={table}
              onChange={e => { setTable(e.target.value); setPage(1); }}
            >
              <option value="">Semua Tabel</option>
              {KNOWN_TABLES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  className="form-input pl-8 w-40"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  placeholder="Dari tanggal"
                />
              </div>
              <span className="text-slate-400 text-sm">—</span>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  className="form-input pl-8 w-40"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  placeholder="Sampai tanggal"
                />
              </div>
            </div>

            {/* Clear */}
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <X size={14} />
                Hapus Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              <th>Waktu</th>
              <th>Aksi</th>
              <th>Tabel</th>
              <th>ID Record</th>
              <th>Diubah Oleh</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6}>
                    <div className="skeleton h-4 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state py-12">
                    <Shield size={32} className="text-slate-300 mb-3" />
                    <p className="empty-state-title">Tidak ada entri audit</p>
                    <p className="empty-state-desc">
                      {hasFilters
                        ? 'Tidak ada data yang cocok dengan filter saat ini.'
                        : 'Belum ada aktivitas yang tercatat.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data?.data.map(log => {
                const isExpanded = expanded.has(log.id);
                return [
                  <tr
                    key={log.id}
                    className={`cursor-pointer ${isExpanded ? 'selected' : ''}`}
                    onClick={() => toggleExpand(log.id)}
                  >
                    <td className="text-center text-slate-400">
                      {isExpanded
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />}
                    </td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDatetime(log.created_at)}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_COLORS[log.action] ?? 'badge-slate'} gap-1`}>
                        {ACTION_ICONS[log.action]}
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{log.table_name}</td>
                    <td className="text-xs font-mono text-slate-400">
                      {log.record_id ?? '—'}
                    </td>
                    <td className="text-sm text-slate-700">
                      {log.changed_by_name ?? (
                        <span className="text-slate-400 font-mono text-xs">
                          {log.user_id ? `${String(log.user_id).slice(0, 8)}…` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>,
                  isExpanded && <ExpandedRow key={`exp-${log.id}`} log={log} />,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            {data.total} entri total &nbsp;·&nbsp;
            halaman {page} dari {totalPages}
          </p>
          <div className="pagination">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ‹
            </button>
            {paginationRange.map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="page-btn cursor-default">…</span>
              ) : (
                <button
                  key={p}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              ),
            )}
            <button
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
