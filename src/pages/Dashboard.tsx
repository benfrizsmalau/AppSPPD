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
  LayoutDashboard,
  Bell,
  ChevronRight,
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

// ─── Premium Stat Card ──────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  loading?: boolean;
  to?: string;
}

const PremiumStatCard: React.FC<StatCardProps> = ({
  label, value, icon, gradient, loading, to,
}) => {
  const displayVal = useCountUp(loading ? 0 : value);
  const content = (
    <div className={`stat-card-premium ${gradient}`}>
      <div className="bg-decoration" />
      <div className="stat-icon-wrap">
        {icon}
      </div>
      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton bg-white/20 h-8 w-16" />
            <div className="skeleton bg-white/20 h-3 w-28" />
          </div>
        ) : (
          <>
            <div className="stat-value">{displayVal.toLocaleString('id-ID')}</div>
            <div className="stat-label">{label}</div>
          </>
        )}
      </div>
      {to && !loading && (
        <div className="stat-link">
          <span>Lihat Detail</span>
          <ArrowRight size={12} />
        </div>
      )}
    </div>
  );

  if (to && !loading) return <Link to={to} className="block no-underline group">{content}</Link>;
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

// ─── Chart Tooltip ──────────────────────────────────────────────
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
    <div className="bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 text-xs border border-white/10 glass">
      <p className="font-bold mb-2 border-b border-white/10 pb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-3 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="opacity-70">{p.name}:</span>
          <span className="font-bold ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Alert Pill ──────────────────────────────────────────────────
const AlertPill: React.FC<{ alert: AlertInfo }> = ({ alert }) => {
  const iconMap: Record<AlertInfo['type'], React.ReactNode> = {
    warning: <AlertTriangle size={14} className="text-amber-500" />,
    danger:  <AlertTriangle size={14} className="text-rose-500" />,
    success: <CheckCircle  size={14} className="text-emerald-500" />,
    info:    <Settings     size={14} className="text-blue-500" />,
  };
  return (
    <div className="alert-subtle group hover:bg-white transition-colors duration-200">
      {iconMap[alert.type]}
      <span className="truncate">{alert.title}</span>
      {alert.action && (
        <Link to={alert.action.href} className="ml-auto text-blue-600 hover:underline flex items-center gap-1">
          {alert.action.label} <ChevronRight size={12} />
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
const TOP_COLORS = ['rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0.6)', 'rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)'];

const TopEmployeesChart: React.FC<{ data: TopEmployee[]; loading: boolean }> = ({ data, loading }) => (
  <div className="card overflow-hidden h-full flex flex-col">
    <div className="card-header bg-slate-50/50">
      <div className="flex items-center gap-2">
        <BarChart2 size={18} className="text-blue-500" />
        <h3 className="text-sm font-bold text-slate-800">Top 5 Perjalanan Dinas</h3>
      </div>
    </div>
    <div className="card-body flex-1 flex flex-col justify-center">
      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="space-y-1">
              <div className="skeleton h-2 w-24" />
              <div className="skeleton h-3 w-full" style={{ opacity: 1 - i * 0.15 }} />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state py-4">
          <p className="empty-state-desc">Belum ada data perjalanan.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ left: -10, right: 20, top: 10, bottom: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nama"
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
              width={100}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            <Bar dataKey="jumlah" name="Perjalanan" radius={[0, 4, 4, 0]} barSize={24}>
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

// ─── Main Dashboard ─────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { profile, tenantId } = useAuth();
  const navigate = useNavigate();
  const now = new Date();

  // ── Data Fetching ─────────────────────────────────────────────
  const { data: statsData, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('get_dashboard_stats', { p_tenant_id: tenantId });
      if (error) throw error;
      return data as DashboardStats;
    },
    enabled: !!tenantId,
  });

  const { data: trendData = [], isLoading: trendLoading } = useQuery<MonthlyTrend[]>({
    queryKey: ['monthly-trend', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_trend', { p_tenant_id: tenantId });
      if (error) throw error;
      return data as MonthlyTrend[];
    },
    enabled: !!tenantId,
  });

  const { data: recentDocs = [], isLoading: recentLoading } = useQuery<any[]>({
    queryKey: ['recent-all-docs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [sptRes, sppdRes] = await Promise.all([
        supabase.from('spt').select('id, created_at, status, nomor_spt, tujuan_kegiatan').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
        supabase.from('sppd').select('id, created_at, status, nomor_sppd, maksud_perjalanan').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5)
      ]);
      const spt = (sptRes.data || []).map(s => ({
        id: s.id,
        created_at: s.created_at,
        status: s.status,
        type: 'SPT',
        nomor: s.nomor_spt ?? `DRAFT-SPT-${s.id}`,
        deskripsi: Array.isArray(s.tujuan_kegiatan) ? s.tujuan_kegiatan[0] : (s.tujuan_kegiatan || ''),
        href: `/spt/${s.id}`
      }));
      const sppd = (sppdRes.data || []).map(s => ({
        id: s.id,
        created_at: s.created_at,
        status: s.status,
        type: 'SPPD',
        nomor: s.nomor_sppd ?? `DRAFT-SPPD-${s.id}`,
        deskripsi: s.maksud_perjalanan || '',
        href: `/sppd/${s.id}`
      }));
      return [...spt, ...sppd].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
    },
    enabled: !!tenantId,
  });

  // Setup Checks
  const { data: alerts = [] } = useQuery<AlertInfo[]>({
    queryKey: ['dashboard-alerts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res: AlertInfo[] = [];
      const [instansi, penandatangan, penomoran] = await Promise.all([
        supabase.from('instansi').select('id, nama_lengkap').eq('tenant_id', tenantId).eq('is_primary', true).limit(1),
        supabase.from('penandatangan').select('id').eq('tenant_id', tenantId).eq('status_aktif', true).limit(1),
        supabase.from('setting_penomoran').select('id').eq('tenant_id', tenantId).limit(1)
      ]);
      if (!instansi.data?.[0]?.nama_lengkap) res.push({ type: 'warning', title: 'Setup Institusi Belum Lengkap', message: '', action: { label: 'Atur Sekarang', href: '/settings' } });
      if (!penandatangan.data?.length) res.push({ type: 'warning', title: 'Penandatangan Belum Aktif', message: '', action: { label: 'Tambah', href: '/settings' } });
      if (!penomoran.data?.length) res.push({ type: 'info', title: 'Konfigurasi Penomoran Belum Diatur', message: '', action: { label: 'Atur', href: '/settings' } });
      return res;
    },
    enabled: !!tenantId,
  });

  const { data: topEmployees = [], isLoading: topLoading } = useQuery<TopEmployee[]>({
    queryKey: ['top-employees-dashboard', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('spt_pegawai')
        .select(`
          pegawai_id, 
          pegawai:pegawai_id(nama_lengkap),
          spt:spt_id!inner(tenant_id)
        `)
        .eq('spt.tenant_id', tenantId)
        .limit(200) as any;

      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const name = r.pegawai?.nama_lengkap;
        if (name) counts[name] = (counts[name] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nama, jumlah]) => ({ nama, jumlah }));
    },
    enabled: !!tenantId,
  });

  const chartData = trendData.map(m => ({ name: m.nama_bulan.slice(0, 3), SPT: m.jumlah_spt, SPPD: m.jumlah_sppd }));

  return (
    <div className="page-enter space-y-8 pb-12">
      {/* ── RICH HEADER ────────────────────────────────────────── */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        <div className="relative bg-white/80 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <LayoutDashboard size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none mb-2">
                Halo, {profile?.nama_lengkap?.split(' ')[0] ?? 'Pengguna'}
              </h1>
              <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-blue-500" /> {format(now, 'EEEE, dd MMMM yyyy', { locale: localeID })}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="flex items-center gap-1.5"><Bell size={14} className="text-rose-500" /> {alerts.length} Notifikasi</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/spt/new" className="btn btn-primary shadow-lg shadow-blue-200 px-6">
              <FileText size={16} /> Buat SPT Baru
            </Link>
            <Link to="/sppd/new" className="btn btn-secondary px-6">
              <Plane size={16} /> SPPD Baru
            </Link>
          </div>
        </div>
      </div>

      {/* ── SUBTLE ALERT BAR ───────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => <AlertPill key={i} alert={a} />)}
        </div>
      )}

      {/* ── PREMIUM STAT CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <PremiumStatCard
          label="Total Pegawai"
          value={statsData?.total_pegawai_aktif ?? 0}
          icon={<Users size={24} />}
          gradient="stat-card-blue"
          loading={statsLoading}
          to="/pegawai"
        />
        <PremiumStatCard
          label="SPT Bulan Ini"
          value={statsData?.spt_bulan_ini ?? 0}
          icon={<FileText size={24} />}
          gradient="stat-card-emerald"
          loading={statsLoading}
          to="/spt"
        />
        <PremiumStatCard
          label="SPPD Terbit"
          value={statsData?.sppd_bulan_ini ?? 0}
          icon={<Plane size={24} />}
          gradient="stat-card-violet"
          loading={statsLoading}
          to="/sppd"
        />
        <PremiumStatCard
          label="Draft Dokumen"
          value={statsData?.total_draft ?? 0}
          icon={<Edit size={24} />}
          gradient="stat-card-amber"
          loading={statsLoading}
          to="/spt?status=Draft"
        />
        <PremiumStatCard
          label="Pending Review"
          value={statsData?.menunggu_persetujuan ?? 0}
          icon={<Clock size={24} />}
          gradient="stat-card-rose"
          loading={statsLoading}
          to="/spt?status=Menunggu+Persetujuan"
        />
      </div>

      {/* ── ANALYTICS ROW ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 overflow-hidden flex flex-col">
          <div className="card-header bg-slate-50/50">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Tren Produktivitas Bulanan</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600"></span><span className="text-[10px] uppercase font-bold text-slate-400">SPT</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-600"></span><span className="text-[10px] uppercase font-bold text-slate-400">SPPD</span></div>
            </div>
          </div>
          <div className="card-body flex-1 min-h-[300px] flex items-center justify-center">
            {trendLoading ? (
              <div className="skeleton w-full h-[250px]" />
            ) : !chartData || chartData.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-desc">Belum ada data tren di tahun ini.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="SPT" stroke="#2563EB" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#2563EB', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="SPPD" stroke="#7C3AED" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#7C3AED', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <TopEmployeesChart data={topEmployees} loading={topLoading} />
      </div>

      {/* ── RECENT DOCUMENTS ──────────────────────────────────── */}
      <div className="card border-0 shadow-sm overflow-hidden">
        <div className="card-header border-b-0 pt-8 px-8">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-slate-300" />
            <h3 className="text-lg font-bold text-slate-800">Aktivitas Dokumen Terbaru</h3>
          </div>
          <Link to="/riwayat" className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
            Semua Dokumen <ChevronRight size={16} />
          </Link>
        </div>
        <div className="px-8 pb-8 pt-4">
          <div className="table-wrap border-0 bg-slate-50/50">
            <table className="data-table">
              <thead>
                <tr className="bg-transparent">
                  <th className="pl-6">JENIS</th>
                  <th>NOMOR DOKUMEN</th>
                  <th>KETERANGAN</th>
                  <th>TANGGAL</th>
                  <th className="pr-6">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {recentLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="py-4"><div className="skeleton h-12 w-full" /></td></tr>
                  ))
                ) : recentDocs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-slate-400 font-medium">Buka menu SPPD untuk membuat dokumen baru.</td></tr>
                ) : (
                  recentDocs.map((doc: any) => (
                    <tr key={doc.id} className="cursor-pointer group hover:bg-white" onClick={() => navigate(doc.href)}>
                      <td className="pl-6">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${doc.type === 'SPT' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                          {doc.type}
                        </span>
                      </td>
                      <td className="font-mono text-xs font-bold text-slate-700">{doc.nomor}</td>
                      <td className="max-w-xs"><span className="truncate block text-slate-500">{doc.deskripsi || '—'}</span></td>
                      <td className="text-xs text-slate-400">{format(new Date(doc.created_at), 'dd MMM yyyy')}</td>
                      <td className="pr-6"><StatusBadge status={doc.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
