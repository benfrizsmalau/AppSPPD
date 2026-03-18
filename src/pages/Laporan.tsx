import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { RekapPegawai, MonthlyTrend } from '../types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, Filter, BarChart2, FileText, Users, MapPin, DollarSign, Loader2, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfYear, endOfYear } from 'date-fns';

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'];

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRows = ({ cols, rows = 5 }: { cols: number; rows?: number }) => (
  <>
    {[...Array(rows)].map((_, i) => (
      <tr key={i}>{[...Array(cols)].map((__, j) => (<td key={j}><div className="skeleton h-4 w-full rounded" /></td>))}</tr>
    ))}
  </>
);

// ─── Filter Panel ─────────────────────────────────────────────────────────────
interface FilterState {
  tahun: number;
  bulan: string;
  dateFrom: string;
  dateTo: string;
  unitKerja: string;
}

type LaporanTab = 'rekap_pegawai' | 'rekap_unit' | 'rekap_tujuan' | 'rekap_anggaran' | 'dashboard';

// ─── Rekap Unit Row type ──────────────────────────────────────────────────────
interface RekapUnit {
  unit_kerja: string;
  jumlah_pegawai: number;
  jumlah_spt: number;
  jumlah_sppd: number;
  total_hari: number;
}

interface RekapTujuan {
  tempat_tujuan: string;
  frekuensi: number;
  daftar_pegawai: string;
}

interface RekapAnggaran {
  kode_ma: string;
  nama_ma: string;
  jumlah_sppd: number;
  total_hari: number;
  pagu: number;
  realisasi: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAPORAN PAGE
// ═════════════════════════════════════════════════════════════════════════════
const Laporan: React.FC = () => {
  const { tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<LaporanTab>('rekap_pegawai');
  const [filter, setFilter] = useState<FilterState>({
    tahun: new Date().getFullYear(),
    bulan: '',
    dateFrom: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfYear(new Date()), 'yyyy-MM-dd'),
    unitKerja: '',
  });
  const [showFilter, setShowFilter] = useState(false);

  const dateRange = filter.dateFrom && filter.dateTo
    ? { from: filter.dateFrom, to: filter.dateTo }
    : {
        from: `${filter.tahun}-${filter.bulan ? filter.bulan.padStart(2, '0') : '01'}-01`,
        to: filter.bulan
          ? format(new Date(filter.tahun, Number(filter.bulan), 0), 'yyyy-MM-dd')
          : `${filter.tahun}-12-31`,
      };

  // ── Query: Rekap Pegawai ──────────────────────────────────────────────────
  const { data: rekapPegawai = [], isLoading: loadingPegawai } = useQuery<RekapPegawai[]>({
    queryKey: ['rekap_pegawai', tenantId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rekap_pegawai', {
        p_tenant_id: tenantId,
        p_date_from: dateRange.from,
        p_date_to: dateRange.to,
      });
      if (error) {
        // Fallback: manual aggregation
        const { data: sppds } = await supabase
          .from('sppd')
          .select('*, pegawai:pegawai_id(id, nip, nama_lengkap, jabatan, ref_pangkat(*), ref_golongan(*))')
          .eq('tenant_id', tenantId!)
          .gte('tanggal_berangkat', dateRange.from)
          .lte('tanggal_berangkat', dateRange.to)
          .neq('status', 'Cancelled');

        const map: Record<number, RekapPegawai> = {};
        (sppds ?? []).forEach((s: Record<string, unknown>) => {
          const p = s.pegawai as Record<string, unknown> | null;
          if (!p) return;
          const pid = p.id as number;
          if (!map[pid]) {
            map[pid] = {
              pegawai_id: pid,
              nip: p.nip as string,
              nama_lengkap: p.nama_lengkap as string,
              jabatan: p.jabatan as string,
              unit_kerja: '',
              jumlah_spt: 0,
              jumlah_sppd: 0,
              total_hari: 0,
              daftar_tujuan: '',
            };
          }
          map[pid].jumlah_sppd++;
          map[pid].total_hari += (s.lama_perjalanan as number) ?? 0;
          const tujuan = s.tempat_tujuan as string;
          if (tujuan && !map[pid].daftar_tujuan.includes(tujuan)) {
            map[pid].daftar_tujuan = map[pid].daftar_tujuan ? `${map[pid].daftar_tujuan}, ${tujuan}` : tujuan;
          }
        });
        return Object.values(map).sort((a, b) => b.jumlah_sppd - a.jumlah_sppd);
      }
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // ── Query: Rekap Unit ─────────────────────────────────────────────────────
  const { data: rekapUnit = [], isLoading: loadingUnit } = useQuery<RekapUnit[]>({
    queryKey: ['rekap_unit', tenantId, dateRange],
    queryFn: async () => {
      const { data: sppds } = await supabase
        .from('sppd')
        .select('lama_perjalanan, spt_id, pegawai:pegawai_id(instansi:instansi_id(nama_singkat))')
        .eq('tenant_id', tenantId!)
        .gte('tanggal_berangkat', dateRange.from)
        .lte('tanggal_berangkat', dateRange.to)
        .neq('status', 'Cancelled');

      const map: Record<string, RekapUnit> = {};
      (sppds ?? []).forEach((s: Record<string, unknown>) => {
        const pg = s.pegawai as Record<string, unknown> | null;
        const inst = pg?.instansi as Record<string, unknown> | null;
        const unit = (inst?.nama_singkat as string) ?? 'Tidak Diketahui';
        if (!map[unit]) map[unit] = { unit_kerja: unit, jumlah_pegawai: 0, jumlah_spt: 0, jumlah_sppd: 0, total_hari: 0 };
        map[unit].jumlah_sppd++;
        map[unit].total_hari += (s.lama_perjalanan as number) ?? 0;
        if (s.spt_id) map[unit].jumlah_spt++;
      });
      return Object.values(map).sort((a, b) => b.jumlah_sppd - a.jumlah_sppd);
    },
    enabled: !!tenantId && activeTab === 'rekap_unit',
  });

  // ── Query: Rekap Tujuan ───────────────────────────────────────────────────
  const { data: rekapTujuan = [], isLoading: loadingTujuan } = useQuery<RekapTujuan[]>({
    queryKey: ['rekap_tujuan', tenantId, dateRange],
    queryFn: async () => {
      const { data: sppds } = await supabase
        .from('sppd')
        .select('tempat_tujuan, pegawai:pegawai_id(nama_lengkap)')
        .eq('tenant_id', tenantId!)
        .gte('tanggal_berangkat', dateRange.from)
        .lte('tanggal_berangkat', dateRange.to)
        .neq('status', 'Cancelled');

      const map: Record<string, RekapTujuan> = {};
      (sppds ?? []).forEach((s: Record<string, unknown>) => {
        const tujuan = (s.tempat_tujuan as string) ?? 'Tidak Diketahui';
        const nama = ((s.pegawai as Record<string, unknown>)?.nama_lengkap as string) ?? '';
        if (!map[tujuan]) map[tujuan] = { tempat_tujuan: tujuan, frekuensi: 0, daftar_pegawai: '' };
        map[tujuan].frekuensi++;
        if (nama && !map[tujuan].daftar_pegawai.includes(nama)) {
          map[tujuan].daftar_pegawai = map[tujuan].daftar_pegawai ? `${map[tujuan].daftar_pegawai}, ${nama}` : nama;
        }
      });
      return Object.values(map).sort((a, b) => b.frekuensi - a.frekuensi);
    },
    enabled: !!tenantId && activeTab === 'rekap_tujuan',
  });

  // ── Query: Rekap Anggaran ─────────────────────────────────────────────────
  const { data: rekapAnggaran = [], isLoading: loadingAnggaran } = useQuery<RekapAnggaran[]>({
    queryKey: ['rekap_anggaran', tenantId, dateRange],
    queryFn: async () => {
      const { data: sppds } = await supabase
        .from('sppd')
        .select('lama_perjalanan, mata_anggaran:mata_anggaran_id(kode, nama, pagu)')
        .eq('tenant_id', tenantId!)
        .gte('tanggal_berangkat', dateRange.from)
        .lte('tanggal_berangkat', dateRange.to)
        .neq('status', 'Cancelled');

      const map: Record<string, RekapAnggaran> = {};
      (sppds ?? []).forEach((s: Record<string, unknown>) => {
        const ma = s.mata_anggaran as Record<string, unknown> | null;
        const kode = (ma?.kode as string) ?? 'Tanpa MA';
        const nama = (ma?.nama as string) ?? 'Tanpa Mata Anggaran';
        const pagu = (ma?.pagu as number) ?? 0;
        if (!map[kode]) map[kode] = { kode_ma: kode, nama_ma: nama, jumlah_sppd: 0, total_hari: 0, pagu, realisasi: 0 };
        map[kode].jumlah_sppd++;
        map[kode].total_hari += (s.lama_perjalanan as number) ?? 0;
        // Realisasi is estimated - in production use a dedicated RPC
      });
      return Object.values(map).sort((a, b) => b.jumlah_sppd - a.jumlah_sppd);
    },
    enabled: !!tenantId && activeTab === 'rekap_anggaran',
  });

  // ── Query: Dashboard Charts ───────────────────────────────────────────────
  const { data: monthlyTrend = [], isLoading: loadingTrend } = useQuery<MonthlyTrend[]>({
    queryKey: ['monthly_trend', tenantId, filter.tahun],
    queryFn: async () => {
      const yearFrom = `${filter.tahun}-01-01`;
      const yearTo = `${filter.tahun}-12-31`;

      const [{ data: spts }, { data: sppds }] = await Promise.all([
        supabase.from('spt').select('tanggal_penetapan').eq('tenant_id', tenantId!).gte('tanggal_penetapan', yearFrom).lte('tanggal_penetapan', yearTo).neq('status', 'Cancelled'),
        supabase.from('sppd').select('tanggal_berangkat').eq('tenant_id', tenantId!).gte('tanggal_berangkat', yearFrom).lte('tanggal_berangkat', yearTo).neq('status', 'Cancelled'),
      ]);

      const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
      const trend: MonthlyTrend[] = BULAN.map((b, i) => ({ bulan: i + 1, nama_bulan: b, jumlah_spt: 0, jumlah_sppd: 0 }));

      (spts ?? []).forEach((s: Record<string, unknown>) => {
        const m = new Date(s.tanggal_penetapan as string).getMonth();
        trend[m].jumlah_spt++;
      });
      (sppds ?? []).forEach((s: Record<string, unknown>) => {
        const m = new Date(s.tanggal_berangkat as string).getMonth();
        trend[m].jumlah_sppd++;
      });
      return trend;
    },
    enabled: !!tenantId && activeTab === 'dashboard',
  });

  const { data: topPegawai = [], isLoading: loadingTopPegawai } = useQuery<{ nama: string; jumlah: number }[]>({
    queryKey: ['top_pegawai', tenantId, filter.tahun],
    queryFn: async () => {
      return rekapPegawai
        .slice(0, 10)
        .map(p => ({ nama: p.nama_lengkap.split(' ').slice(0, 2).join(' '), jumlah: p.jumlah_sppd }));
    },
    enabled: !!tenantId && activeTab === 'dashboard' && rekapPegawai.length > 0,
  });

  // ── Export to Excel ───────────────────────────────────────────────────────
  const exportExcel = () => {
    let sheetData: Record<string, unknown>[] = [];
    let filename = 'laporan';

    if (activeTab === 'rekap_pegawai') {
      sheetData = rekapPegawai.map(r => ({
        NIP: r.nip, Nama: r.nama_lengkap, Jabatan: r.jabatan, 'Unit Kerja': r.unit_kerja,
        'Jumlah SPT': r.jumlah_spt, 'Jumlah SPPD': r.jumlah_sppd, 'Total Hari': r.total_hari, Tujuan: r.daftar_tujuan,
      }));
      filename = `rekap_pegawai_${filter.tahun}`;
    } else if (activeTab === 'rekap_unit') {
      sheetData = rekapUnit.map(r => ({ 'Unit Kerja': r.unit_kerja, 'Jumlah Pegawai': r.jumlah_pegawai, 'Jumlah SPT': r.jumlah_spt, 'Jumlah SPPD': r.jumlah_sppd, 'Total Hari': r.total_hari }));
      filename = `rekap_unit_${filter.tahun}`;
    } else if (activeTab === 'rekap_tujuan') {
      sheetData = rekapTujuan.map(r => ({ 'Kota Tujuan': r.tempat_tujuan, Frekuensi: r.frekuensi, 'Daftar Pegawai': r.daftar_pegawai }));
      filename = `rekap_tujuan_${filter.tahun}`;
    } else if (activeTab === 'rekap_anggaran') {
      sheetData = rekapAnggaran.map(r => ({ 'Kode MA': r.kode_ma, Nama: r.nama_ma, 'Jumlah SPPD': r.jumlah_sppd, 'Total Hari': r.total_hari, 'Pagu': r.pagu, 'Realisasi': r.realisasi }));
      filename = `rekap_anggaran_${filter.tahun}`;
    }

    if (!sheetData.length) return;
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const TABS = [
    { id: 'rekap_pegawai' as LaporanTab, label: 'Rekap Pegawai', icon: <Users size={14} /> },
    { id: 'rekap_unit' as LaporanTab, label: 'Rekap Unit Kerja', icon: <FileText size={14} /> },
    { id: 'rekap_tujuan' as LaporanTab, label: 'Rekap Tujuan', icon: <MapPin size={14} /> },
    { id: 'rekap_anggaran' as LaporanTab, label: 'Rekap Anggaran', icon: <DollarSign size={14} /> },
    { id: 'dashboard' as LaporanTab, label: 'Dashboard', icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Laporan &amp; Rekapitulasi</h1>
          <p className="page-subtitle">Analitik dan rekapitulasi perjalanan dinas per periode.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilter(f => !f)}>
            <Filter size={14} /> Filter
          </button>
          {activeTab !== 'dashboard' && (
            <button className="btn btn-primary btn-sm" onClick={exportExcel}>
              <Download size={14} /> Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="card card-body mb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="form-group">
              <label className="form-label text-xs">Tahun</label>
              <select className="form-select text-xs" value={filter.tahun} onChange={e => setFilter(f => ({ ...f, tahun: Number(e.target.value) }))}>
                {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Bulan</label>
              <select className="form-select text-xs" value={filter.bulan} onChange={e => setFilter(f => ({ ...f, bulan: e.target.value }))}>
                <option value="">Semua Bulan</option>
                {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, i) => (
                  <option key={i} value={String(i + 1)}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Dari Tanggal</label>
              <input type="date" className="form-input text-xs" value={filter.dateFrom} onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Sampai Tanggal</label>
              <input type="date" className="form-input text-xs" value={filter.dateTo} onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))} />
            </div>
            <div className="form-group flex items-end">
              <button className="btn btn-secondary btn-sm w-full" onClick={() => setFilter({ tahun: new Date().getFullYear(), bulan: '', dateFrom: format(startOfYear(new Date()), 'yyyy-MM-dd'), dateTo: format(endOfYear(new Date()), 'yyyy-MM-dd'), unitKerja: '' })}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card mb-6">
        <div className="tab-list px-2 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} className={`tab-item flex items-center gap-1.5 ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Rekap Pegawai ──────────────────────────────────────────────── */}
      {activeTab === 'rekap_pegawai' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>NIP</th><th>Nama</th><th>Jabatan</th><th>Unit</th>
                <th className="text-center">SPT</th><th className="text-center">SPPD</th>
                <th className="text-center">Total Hari</th><th>Tujuan</th>
              </tr>
            </thead>
            <tbody>
              {loadingPegawai ? <SkeletonRows cols={9} /> :
               rekapPegawai.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state py-10"><Users size={36} className="text-slate-300" /><p className="empty-state-title mt-2">Tidak ada data untuk periode ini</p></div></td></tr>
              ) : rekapPegawai.map((r, i) => (
                <tr key={r.pegawai_id}>
                  <td className="text-slate-400 text-xs">{i + 1}</td>
                  <td><code className="doc-number text-slate-500">{r.nip}</code></td>
                  <td><span className="font-semibold text-slate-800 text-sm">{r.nama_lengkap}</span></td>
                  <td className="text-xs text-slate-500">{r.jabatan}</td>
                  <td className="text-xs text-slate-500">{r.unit_kerja || '—'}</td>
                  <td className="text-center"><span className="badge badge-blue">{r.jumlah_spt}</span></td>
                  <td className="text-center"><span className="badge badge-green">{r.jumlah_sppd}</span></td>
                  <td className="text-center font-semibold text-slate-700">{r.total_hari}</td>
                  <td className="text-xs text-slate-500 max-w-xs truncate-2">{r.daftar_tujuan || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: Rekap Unit Kerja ───────────────────────────────────────────── */}
      {activeTab === 'rekap_unit' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Unit Kerja</th><th className="text-center">Pegawai</th><th className="text-center">SPT</th><th className="text-center">SPPD</th><th className="text-center">Total Hari</th></tr>
            </thead>
            <tbody>
              {loadingUnit ? <SkeletonRows cols={5} /> :
               rekapUnit.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state py-10"><FileText size={36} className="text-slate-300" /><p className="empty-state-title mt-2">Tidak ada data</p></div></td></tr>
              ) : rekapUnit.map((r, i) => (
                <tr key={i}>
                  <td><span className="font-semibold text-slate-800 text-sm">{r.unit_kerja}</span></td>
                  <td className="text-center">{r.jumlah_pegawai}</td>
                  <td className="text-center"><span className="badge badge-blue">{r.jumlah_spt}</span></td>
                  <td className="text-center"><span className="badge badge-green">{r.jumlah_sppd}</span></td>
                  <td className="text-center font-semibold text-slate-700">{r.total_hari}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: Rekap Tujuan ───────────────────────────────────────────────── */}
      {activeTab === 'rekap_tujuan' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Kota Tujuan</th><th className="text-center">Frekuensi</th><th>Daftar Pegawai</th></tr>
            </thead>
            <tbody>
              {loadingTujuan ? <SkeletonRows cols={4} /> :
               rekapTujuan.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state py-10"><MapPin size={36} className="text-slate-300" /><p className="empty-state-title mt-2">Tidak ada data</p></div></td></tr>
              ) : rekapTujuan.map((r, i) => (
                <tr key={i}>
                  <td className="text-slate-400 text-xs">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-blue-500 shrink-0" />
                      <span className="font-semibold text-slate-800 text-sm">{r.tempat_tujuan}</span>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="badge badge-cyan">{r.frekuensi}x</span>
                  </td>
                  <td className="text-xs text-slate-500 max-w-md truncate-2">{r.daftar_pegawai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: Rekap Anggaran ─────────────────────────────────────────────── */}
      {activeTab === 'rekap_anggaran' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode MA</th><th>Nama</th><th className="text-center">SPPD</th>
                <th className="text-center">Total Hari</th><th className="text-right">Pagu</th>
                <th className="text-right">Realisasi</th><th className="text-right">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {loadingAnggaran ? <SkeletonRows cols={7} /> :
               rekapAnggaran.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state py-10"><DollarSign size={36} className="text-slate-300" /><p className="empty-state-title mt-2">Tidak ada data</p></div></td></tr>
              ) : rekapAnggaran.map((r, i) => {
                const sisa = r.pagu - r.realisasi;
                const pct = r.pagu > 0 ? Math.round((r.realisasi / r.pagu) * 100) : 0;
                return (
                  <tr key={i}>
                    <td><code className="doc-number text-slate-500">{r.kode_ma}</code></td>
                    <td className="text-sm font-medium text-slate-700">{r.nama_ma}</td>
                    <td className="text-center"><span className="badge badge-blue">{r.jumlah_sppd}</span></td>
                    <td className="text-center">{r.total_hari}</td>
                    <td className="text-right font-mono text-xs">Rp {r.pagu.toLocaleString('id-ID')}</td>
                    <td className="text-right">
                      <div className="font-mono text-xs text-slate-700">Rp {r.realisasi.toLocaleString('id-ID')}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="text-xs text-slate-400">{pct}%</div>
                    </td>
                    <td className={`text-right font-mono text-xs font-semibold ${sisa < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Rp {Math.abs(sisa).toLocaleString('id-ID')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: Dashboard Charts ───────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Trend Chart */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-600" />
                <span className="font-bold text-slate-800">Tren SPT &amp; SPPD Bulanan {filter.tahun}</span>
              </div>
            </div>
            <div className="card-body">
              {loadingTrend ? (
                <div className="h-64 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nama_bulan" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="jumlah_spt" name="SPT" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="jumlah_sppd" name="SPPD" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Pegawai */}
            <div className="card">
              <div className="card-header">
                <span className="font-bold text-slate-800">Top 10 Pegawai Perjalanan Dinas</span>
              </div>
              <div className="card-body">
                {loadingTopPegawai || loadingPegawai ? (
                  <div className="h-64 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
                ) : topPegawai.length === 0 ? (
                  <div className="empty-state py-8"><Users size={32} className="text-slate-300" /><p className="text-sm text-slate-400 mt-2">Tidak ada data</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topPegawai} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nama" tick={{ fontSize: 11, fill: '#475569' }} width={90} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="jumlah" name="Jumlah SPPD" fill="#2563EB" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Pie: Distribusi Tujuan */}
            <div className="card">
              <div className="card-header">
                <span className="font-bold text-slate-800">Distribusi Tujuan Perjalanan</span>
              </div>
              <div className="card-body">
                {loadingTujuan ? (
                  <div className="h-64 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
                ) : rekapTujuan.length === 0 ? (
                  <div className="empty-state py-8"><MapPin size={32} className="text-slate-300" /><p className="text-sm text-slate-400 mt-2">Tidak ada data</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={rekapTujuan.slice(0, 8)}
                        dataKey="frekuensi"
                        nameKey="tempat_tujuan"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {rekapTujuan.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Bar: Per Unit */}
          <div className="card">
            <div className="card-header">
              <span className="font-bold text-slate-800">Distribusi Perjalanan per Unit Kerja</span>
            </div>
            <div className="card-body">
              {loadingUnit ? (
                <div className="h-64 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
              ) : rekapUnit.length === 0 ? (
                <div className="empty-state py-8"><BarChart2 size={32} className="text-slate-300" /><p className="text-sm text-slate-400 mt-2">Tidak ada data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rekapUnit.slice(0, 12)} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="unit_kerja" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="jumlah_spt" name="SPT" fill="#2563EB" radius={[3,3,0,0]} />
                    <Bar dataKey="jumlah_sppd" name="SPPD" fill="#10B981" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Laporan;
