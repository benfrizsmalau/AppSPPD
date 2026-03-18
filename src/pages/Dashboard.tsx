// =================================================================
// SiSPPD v2.1 — Dashboard (Module 14)
// =================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FileText,
  Plane,
  Edit,
  Clock,
  AlertTriangle,
  Settings,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type {
  DashboardStats,
  MonthlyTrend,
  AlertInfo,
  SPT,
  SPPD,
} from '../types';

// ─── Custom Counter Hook ────────────────────────────────────────
function useCountUp(target: number, duration = 1000): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return count;
}

// ─── Stat Card ──────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
  to?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, icon, iconBg, iconColor, loading, to,
}) => {
  const displayVal = useCountUp(loading ? 0 : value);
  const content = (
    <div className="stat-card flex items-center gap-4 hover:-translate-y-0.5 transition-transform duration-200">
      <div className={`stat-icon ${iconBg}`} style={{ color: iconColor }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <>
            <div className="skeleton h-8 w-16 mb-1" />
            <div className="skeleton h-3 w-28" />
          </>
        ) : (
          <>
            <div className="stat-value">{displayVal.toLocaleString('id-ID')}</div>
            <div className="stat-label">{label}</div>
          </>
        )}
      </div>
      {to && !loading && (
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
      )}
    </div>
  );

  if (to && !loading) return <Link to={to} className="block no-underline">{content}</Link>;
  return content;
};

// ─── Status Badge ────────────────────────────────────────────────
type DocStatus = SPT['status'];
const STATUS_CLASS: Record<DocStatus, string> = {
  Draft: 'status-draft',
  'Menunggu Persetujuan': 'status-pending',
  Final: 'status-final',
  Printed: 'status-printed',
  Completed: 'status-completed',
  Cancelled: 'status-cancelled',
  Expired: 'status-expired',
};

const StatusBadge: React.FC<{ status: DocStatus }> = ({ status }) => (
  <span className={STATUS_CLASS[status] ?? 'badge badge-slate'}>{status}</span>
);

// ─── Skeleton helpers ────────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <tr>
    {[120, 180, 100, 80].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className={`skeleton h-4`} style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ─── Recharts custom tooltip ────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}
interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}
const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Alert Banner ────────────────────────────────────────────────
const AlertBanner: React.FC<{ alert: AlertInfo }> = ({ alert }) => {
  const cls = `alert alert-${alert.type}`;
  const icons: Record<AlertInfo['type'], React.ReactNode> = {
    warning: <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />,
    danger:  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />,
    success: <CheckCircle  size={18} className="flex-shrink-0 mt-0.5" />,
    info:    <Settings     size={18} className="flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className={cls}>
      {icons[alert.type]}
      <div className="flex-1">
        <span className="font-semibold">{alert.title}</span>
        {alert.message && <span className="ml-1 font-normal opacity-80">{alert.message}</span>}
      </div>
      {alert.action && (
        <Link
          to={alert.action.href}
          className="btn btn-sm btn-secondary flex-shrink-0 text-xs"
        >
          {alert.action.label}
        </Link>
      )}
    </div>
  );
};

// ─── Top Employees Bar Chart ─────────────────────────────────────
interface TopEmployee {
  nama: string;
  jumlah: number;
}
const TOP_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

const TopEmployeesChart: React.FC<{ data: TopEmployee[]; loading: boolean }> = ({ data, loading }) => (
  <div className="card">
    <div className="card-header">
      <div className="flex items-center gap-2">
        <BarChart2 size={18} className="text-violet-500" />
        <h3 className="text-sm font-bold text-slate-800">Top 5 Pegawai Perjalanan Dinas</h3>
      </div>
    </div>
    <div className="card-body">
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 flex-1" style={{ opacity: 1 - i * 0.15 }} />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state py-8">
          <p className="empty-state-desc">Belum ada data perjalanan dinas.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nama"
              width={110}
              tick={{ fontSize: 11, fill: '#475569' }}
              tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
            <Bar dataKey="jumlah" name="Perjalanan" radius={[0, 6, 6, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={TOP_COLORS[i % TOP_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

// ─── Main Dashboard Component ────────────────────────────────────
const Dashboard: React.FC = () => {
  const { profile, tenantId } = useAuth();
  const navigate = useNavigate();

  // ── Data Fetching ─────────────────────────────────────────────
  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('get_dashboard_stats', { p_tenant_id: tenantId });
      if (error) throw error;
      return data as DashboardStats;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const { data: trendData = [], isLoading: trendLoading } = useQuery<MonthlyTrend[]>({
    queryKey: ['monthly-trend', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('get_monthly_trend', { p_tenant_id: tenantId });
      if (error) throw error;
      return data as MonthlyTrend[];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: recentSPTs = [], isLoading: recentLoading } = useQuery<SPT[]>({
    queryKey: ['recent-spt', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('spt')
        .select('id, nomor_spt, tanggal_penetapan, tujuan_kegiatan, status, created_at, instansi_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as SPT[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const { data: recentSPPDs = [], isLoading: recentSppdLoading } = useQuery<SPPD[]>({
    queryKey: ['recent-sppd', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('sppd')
        .select('id, nomor_sppd, tanggal_penerbitan, maksud_perjalanan, status, created_at, pegawai_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as SPPD[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // Setup checks for alert banners
  const { data: instansiList = [] } = useQuery({
    queryKey: ['instansi-check', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('instansi')
        .select('id, nama_lengkap, logo_path, is_primary')
        .eq('tenant_id', tenantId)
        .eq('is_primary', true)
        .limit(1);
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: penandatanganList = [] } = useQuery({
    queryKey: ['penandatangan-check', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('penandatangan')
        .select('id, status_aktif')
        .eq('tenant_id', tenantId)
        .eq('status_aktif', true)
        .limit(1);
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: penomoranList = [] } = useQuery({
    queryKey: ['penomoran-check', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('setting_penomoran')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: oldDrafts = [] } = useQuery({
    queryKey: ['old-drafts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { data } = await supabase
        .from('spt')
        .select('id, created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'Draft')
        .lt('created_at', cutoff.toISOString())
        .limit(1);
      return data ?? [];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  // Top employees
  const { data: topEmployees = [], isLoading: topLoading } = useQuery<TopEmployee[]>({
    queryKey: ['top-employees', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('spt_pegawai')
        .select('pegawai_id, pegawai:pegawai(nama_lengkap)')
        .eq('pegawai.tenant_id' as string, tenantId)
        .limit(200);
      if (error) throw error;
      // Aggregate client-side
      const counts: Record<number, { nama: string; jumlah: number }> = {};
      (data ?? []).forEach((row) => {
        const r = row as { pegawai_id: number; pegawai: { nama_lengkap: string } | { nama_lengkap: string }[] | null };
        const pegawai = r.pegawai;
        if (!pegawai) return;
        const nama = Array.isArray(pegawai) ? pegawai[0]?.nama_lengkap : (pegawai as { nama_lengkap: string }).nama_lengkap;
        if (!nama) return;
        if (!counts[r.pegawai_id]) counts[r.pegawai_id] = { nama, jumlah: 0 };
        counts[r.pegawai_id].jumlah++;
      });
      return Object.values(counts)
        .sort((a, b) => b.jumlah - a.jumlah)
        .slice(0, 5);
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  // ── Computed values ───────────────────────────────────────────
  const stats = statsData ?? {
    total_pegawai_aktif: 0,
    spt_bulan_ini: 0,
    sppd_bulan_ini: 0,
    total_draft: 0,
    menunggu_persetujuan: 0,
  };

  const alerts: AlertInfo[] = [];
  const primaryInstansi = instansiList[0] as { logo_path?: string; nama_lengkap?: string } | undefined;
  if (!primaryInstansi || !primaryInstansi.logo_path || !primaryInstansi.nama_lengkap) {
    alerts.push({
      type: 'warning',
      title: 'Setup Institusi Belum Lengkap',
      message: 'Logo dan nama instansi belum dikonfigurasi.',
      action: { label: 'Setup Institusi', href: '/settings' },
    });
  }
  if (penandatanganList.length === 0) {
    alerts.push({
      type: 'warning',
      title: 'Penandatangan Tidak Aktif',
      message: 'Belum ada penandatangan aktif yang ditetapkan.',
      action: { label: 'Tambah Penandatangan', href: '/settings' },
    });
  }
  if (penomoranList.length === 0) {
    alerts.push({
      type: 'info',
      title: 'Penomoran Belum Dikonfigurasi',
      message: 'Format nomor dokumen SPT/SPPD belum diatur.',
      action: { label: 'Konfigurasi Penomoran', href: '/settings' },
    });
  }
  if (oldDrafts.length > 0) {
    alerts.push({
      type: 'warning',
      title: 'Draft Lama Terdeteksi',
      message: 'Terdapat draft SPT yang sudah lebih dari 30 hari.',
      action: { label: 'Lihat Draft', href: '/spt?status=Draft' },
    });
  }

  // Merge recent docs
  const recentAllLoading = recentLoading || recentSppdLoading;
  const recentDocs = [
    ...recentSPTs.map(s => ({
      id: s.id,
      type: 'SPT' as const,
      nomor: s.nomor_spt ?? `DRAFT-SPT-${s.id}`,
      deskripsi: Array.isArray(s.tujuan_kegiatan) ? s.tujuan_kegiatan[0] : '',
      status: s.status,
      tanggal: s.created_at,
      href: `/spt/${s.id}`,
    })),
    ...recentSPPDs.map(s => ({
      id: s.id,
      type: 'SPPD' as const,
      nomor: s.nomor_sppd ?? `DRAFT-SPPD-${s.id}`,
      deskripsi: s.maksud_perjalanan,
      status: s.status,
      tanggal: s.created_at,
      href: `/sppd/${s.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    .slice(0, 10);

  // Chart data — use 12-month trend
  const chartData = trendData.map(m => ({
    name: m.nama_bulan.slice(0, 3),
    SPT: m.jumlah_spt,
    SPPD: m.jumlah_sppd,
  }));

  const now = new Date();

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page-enter flex flex-col gap-6">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">
            Selamat datang, {profile?.nama_lengkap?.split(' ')[0] ?? 'Pengguna'} 👋
          </h1>
          <p className="page-subtitle">
            {format(now, 'EEEE, dd MMMM yyyy', { locale: localeID })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/spt/new" className="btn btn-primary btn-sm">
            <FileText size={15} /> Buat SPT
          </Link>
          <Link to="/sppd/new" className="btn btn-secondary btn-sm">
            <Plane size={15} /> Buat SPPD
          </Link>
        </div>
      </div>

      {/* ── Alert Banners ────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
        </div>
      )}

      {statsError && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>Gagal memuat statistik dashboard. Periksa koneksi Supabase.</span>
          <button
            className="btn btn-sm btn-secondary ml-auto"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} /> Coba lagi
          </button>
        </div>
      )}

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Pegawai Aktif"
          value={stats.total_pegawai_aktif}
          icon={<Users size={22} />}
          iconBg="bg-blue-50"
          iconColor="#2563EB"
          loading={statsLoading}
          to="/pegawai"
        />
        <StatCard
          label="SPT Bulan Ini"
          value={stats.spt_bulan_ini}
          icon={<FileText size={22} />}
          iconBg="bg-emerald-50"
          iconColor="#10B981"
          loading={statsLoading}
          to="/spt"
        />
        <StatCard
          label="SPPD Bulan Ini"
          value={stats.sppd_bulan_ini}
          icon={<Plane size={22} />}
          iconBg="bg-violet-50"
          iconColor="#7C3AED"
          loading={statsLoading}
          to="/sppd"
        />
        <StatCard
          label="Total Draft"
          value={stats.total_draft}
          icon={<Edit size={22} />}
          iconBg="bg-amber-50"
          iconColor="#D97706"
          loading={statsLoading}
          to="/spt?status=Draft"
        />
        <StatCard
          label="Menunggu Persetujuan"
          value={stats.menunggu_persetujuan}
          icon={<Clock size={22} />}
          iconBg="bg-rose-50"
          iconColor="#F43F5E"
          loading={statsLoading}
          to="/spt?status=Menunggu+Persetujuan"
        />
      </div>

      {/* ── Charts Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Line Chart */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-slate-800">Tren 12 Bulan — SPT & SPPD</h3>
            </div>
          </div>
          <div className="card-body">
            {trendLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-48 w-full" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="empty-state py-8">
                <p className="empty-state-desc">Belum ada data tren untuk ditampilkan.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Line
                    type="monotone"
                    dataKey="SPT"
                    name="SPT"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="SPPD"
                    name="SPPD"
                    stroke="#7C3AED"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#7C3AED', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Employees */}
        <TopEmployeesChart data={topEmployees} loading={topLoading} />
      </div>

      {/* ── Recent Documents Table ───────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Dokumen Terbaru</h3>
          </div>
          <Link to="/riwayat" className="btn btn-ghost btn-sm text-xs">
            Lihat semua <ArrowRight size={13} />
          </Link>
        </div>

        <div className="table-wrap rounded-t-none border-0 border-t border-slate-100">
          <table className="data-table">
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Nomor Dokumen</th>
                <th>Keterangan</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentAllLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : recentDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    Belum ada dokumen yang dibuat.
                  </td>
                </tr>
              ) : (
                recentDocs.map(doc => (
                  <tr
                    key={`${doc.type}-${doc.id}`}
                    className="cursor-pointer"
                    onClick={() => navigate(doc.href)}
                  >
                    <td>
                      <span className={`badge ${doc.type === 'SPT' ? 'badge-blue' : 'badge-violet'}`}>
                        {doc.type}
                      </span>
                    </td>
                    <td>
                      <span className="doc-number text-slate-800">{doc.nomor}</span>
                    </td>
                    <td>
                      <span className="text-slate-600 truncate-2 max-w-xs block">
                        {doc.deskripsi || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-slate-500 text-xs">
                      {format(new Date(doc.tanggal), 'dd MMM yyyy', { locale: localeID })}
                    </td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td>
                      <ArrowRight size={14} className="text-slate-300" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
